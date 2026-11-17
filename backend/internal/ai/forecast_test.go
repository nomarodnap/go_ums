package ai

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestBuildForecastCacheKeyLengthLimit(t *testing.T) {
	cases := []struct {
		name string
		dept string
	}{
		{"all scope", ""},
		{"short dept id", "dept-101"},
		{"very long dept id", strings.Repeat("department-identifier-", 6)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key := BuildForecastCacheKey(UserScope{IsAdmin: tc.dept == "", DepartmentID: tc.dept}, 2027, 12)
			if len(key) > 64 {
				t.Fatalf("cache key exceeds system_settings VARCHAR(64): len=%d (%s)", len(key), key)
			}
			if !strings.HasPrefix(key, "ai_fc:") {
				t.Fatalf("expected ai_fc prefix, got %s", key)
			}
		})
	}
}

func TestThaiFiscalYearCEAndBUDHelpers(t *testing.T) {
	if got := ThaiFiscalYearCE(10, 2026); got != 2027 {
		t.Fatalf("expected Oct 2026 -> FY 2027 CE, got %d", got)
	}
	if got := ThaiFiscalYearCE(9, 2026); got != 2026 {
		t.Fatalf("expected Sep 2026 -> FY 2026 CE, got %d", got)
	}
	if got := ThaiFiscalYearCE(11, 2569); got != 2027 {
		t.Fatalf("expected Nov 2569 BE -> FY 2027 CE, got %d", got)
	}
	if got := toFiscalYearBE(2026); got != 2569 {
		t.Fatalf("expected 2026 -> 2569 BE, got %d", got)
	}
	if got := toFiscalYearBE(2569); got != 2569 {
		t.Fatalf("expected 2569 -> 2569 BE, got %d", got)
	}
}

func TestComputeExpenseTimeSeriesEmptyDataset(t *testing.T) {
	fixedNow := time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC)
	ts := ComputeExpenseTimeSeries(nil, fixedNow, 6)
	if ts.SampleMonths != 0 {
		t.Fatalf("expected 0 sample months, got %d", ts.SampleMonths)
	}
	if ts.ConfidenceLevel != "LOW" {
		t.Fatalf("expected LOW confidence on empty history, got %s", ts.ConfidenceLevel)
	}
	if ts.Series == nil || len(ts.Series) != 0 {
		t.Fatalf("expected empty non-nil Series slice, got %+v", ts.Series)
	}
	if len(ts.UtilityBreakdown) != 5 {
		t.Fatalf("expected 5 canonical utilities in breakdown, got %d", len(ts.UtilityBreakdown))
	}
}

func TestComputeExpenseTimeSeriesTrendAndIntervals(t *testing.T) {
	fixedNow := time.Date(2026, 11, 15, 0, 0, 0, 0, time.UTC)
	records := []MonthlyUtilityRecord{
		{YearCE: 2026, Month: 6, UtilityType: "ค่าไฟฟ้า", BillCount: 5, Amount: 8000},
		{YearCE: 2026, Month: 6, UtilityType: "ค่าประปา&น้ำบาดาล", BillCount: 2, Amount: 2000},
		{YearCE: 2026, Month: 7, UtilityType: "ค่าไฟฟ้า", BillCount: 5, Amount: 8800},
		{YearCE: 2026, Month: 7, UtilityType: "ค่าประปา&น้ำบาดาล", BillCount: 2, Amount: 2200},
		{YearCE: 2026, Month: 8, UtilityType: "ค่าไฟฟ้า", BillCount: 5, Amount: 9600},
		{YearCE: 2026, Month: 8, UtilityType: "ค่าประปา&น้ำบาดาล", BillCount: 2, Amount: 2400},
		{YearCE: 2026, Month: 9, UtilityType: "ค่าไฟฟ้า", BillCount: 5, Amount: 10400},
		{YearCE: 2026, Month: 9, UtilityType: "ค่าประปา&น้ำบาดาล", BillCount: 2, Amount: 2600},
	}

	ts := ComputeExpenseTimeSeries(records, fixedNow, 3)
	if ts.SampleMonths != 4 {
		t.Fatalf("expected 4 active sample months, got %d", ts.SampleMonths)
	}
	if ts.ConfidenceLevel != "MEDIUM" {
		t.Fatalf("expected MEDIUM confidence for 4 months, got %s", ts.ConfidenceLevel)
	}
	if len(ts.Series) != 7 {
		t.Fatalf("expected 4 historical + 3 forecast points = 7, got %d", len(ts.Series))
	}
	if ts.NextMonthPredicted <= ts.LatestMonthActual {
		t.Fatalf("expected upward trend forecast (> %v), got %v", ts.LatestMonthActual, ts.NextMonthPredicted)
	}
	if ts.NextMonthLowerBound >= ts.NextMonthPredicted || ts.NextMonthUpperBound <= ts.NextMonthPredicted {
		t.Fatalf("expected calibrated confidence band around prediction: low=%v pred=%v high=%v",
			ts.NextMonthLowerBound, ts.NextMonthPredicted, ts.NextMonthUpperBound)
	}

	// Sum of category forecasts must equal total next month prediction coherently
	var catSum float64
	for _, u := range ts.UtilityBreakdown {
		catSum += u.NextMonthPredicted
	}
	if math.Abs(catSum-ts.NextMonthPredicted) > 1.0 {
		t.Fatalf("expected utility breakdown sum (%v) to reconcile with nextMonthPredicted (%v)", catSum, ts.NextMonthPredicted)
	}
}

func TestComputeExpenseTimeSeriesSeasonalityAndPartialMonthGuard(t *testing.T) {
	fixedNow := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	records := make([]MonthlyUtilityRecord, 0, 16)

	// 15 full months spanning Jul 2025 .. Sep 2026 with strong April/May summer peak
	for i := 0; i < 16; i++ {
		ym := (2025*12 + 7) + i
		m, y := ymToMonthYear(ym)
		amt := 10000.0
		cnt := 20
		if m == 4 || m == 5 {
			amt = 17500.0
		}
		records = append(records, MonthlyUtilityRecord{
			YearCE:      y,
			Month:       m,
			UtilityType: "ค่าไฟฟ้า",
			BillCount:   cnt,
			Amount:      amt,
		})
	}
	// Add severely incomplete Nov 2026 partial tail (only 2 bills vs median 20, small amount)
	records = append(records, MonthlyUtilityRecord{
		YearCE:      2026,
		Month:       11,
		UtilityType: "ค่าไฟฟ้า",
		BillCount:   2,
		Amount:      900,
	})

	ts := ComputeExpenseTimeSeries(records, fixedNow, 6)
	if ts.SampleMonths != 16 {
		t.Fatalf("expected 16 complete fit months excluding partial current month, got %d", ts.SampleMonths)
	}
	if ts.ConfidenceLevel != "HIGH" {
		t.Fatalf("expected HIGH confidence (>= 12 months), got %s", ts.ConfidenceLevel)
	}
	// Because partial 900 THB tail was excluded from training, forecast for Dec 2026 must remain near ~10,000 not crash toward 900!
	if ts.NextMonthPredicted < 7500 {
		t.Fatalf("expected forecast protected from incomplete current month skew (>= 7500), got %v", ts.NextMonthPredicted)
	}

	// Verify April 2027 forecast (within horizon=6 starting Dec 2026: Dec=1, Jan=2, Feb=3, Mar=4, Apr=5) shows seasonal index > 1.25
	var aprPt *ForecastSeriesPoint
	for i := range ts.Series {
		if ts.Series[i].IsForecast && ts.Series[i].Month == 4 {
			aprPt = &ts.Series[i]
			break
		}
	}
	if aprPt == nil {
		t.Fatalf("expected April 2027 forecast point within 6-month horizon")
	}
	if aprPt.SeasonalIndex <= 1.20 {
		t.Fatalf("expected April seasonal index > 1.20 from prior summer peak, got %v", aprPt.SeasonalIndex)
	}
}

func TestClassifyBudgetStatus(t *testing.T) {
	if got := classifyBudgetStatus(0, 5000, 12000, 100); got != "NO_BUDGET" {
		t.Fatalf("expected NO_BUDGET, got %s", got)
	}
	if got := classifyBudgetStatus(100000, 60000, 110000, 110); got != "DEFICIT" {
		t.Fatalf("expected DEFICIT, got %s", got)
	}
	if got := classifyBudgetStatus(100000, 50000, 90000, 90); got != "RISK" {
		t.Fatalf("expected RISK, got %s", got)
	}
	if got := classifyBudgetStatus(100000, 40000, 75000, 75); got != "WATCH" {
		t.Fatalf("expected WATCH, got %s", got)
	}
	if got := classifyBudgetStatus(100000, 20000, 55000, 55); got != "HEALTHY" {
		t.Fatalf("expected HEALTHY, got %s", got)
	}
}

func TestGenerateForecastInsightsCachingAndGeminiMock(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(GenerateContentResponse{
			Candidates: []Candidate{{
				FinishReason: "STOP",
				Content: Content{
					Role: "model",
					Parts: []Part{{
						Text: "```json\n" + `{
							"executiveSummary": "แนวโน้มเดือนหน้าอยู่ในเกณฑ์ควบคุมได้",
							"budgetRecommendations": ["จัดสรรงบสำรอง 5% สำหรับหมวดค่าไฟฟ้า"],
							"preventiveActions": ["ตรวจสอบมิเตอร์ก่อนปิดรอบวันที่ 25"]
						}` + "\n```",
					}},
				},
			}},
		})
	}))
	defer srv.Close()

	store := newMemoryCacheStore()
	fixedNow := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)

	// Missing API key must return ErrAIConfigMissing
	noKeySvc := NewForecastService(NewClient("", "gemini-3.5-flash"), nil, store)
	_, err := noKeySvc.GenerateForecastInsights(context.Background(), UserScope{IsAdmin: true}, 6, 0, false)
	if !errors.Is(err, ErrAIConfigMissing) {
		t.Fatalf("expected ErrAIConfigMissing, got %v", err)
	}

	client := NewClient("test-key", "gemini-3-flash-preview").WithBaseURL(srv.URL)
	svc := NewForecastService(client, nil, store)
	svc.now = func() time.Time { return fixedNow }

	scope := UserScope{Role: "admin", IsAdmin: true}
	first, err := svc.GenerateForecastInsights(context.Background(), scope, 6, 2570, false)
	if err != nil {
		t.Fatalf("first GenerateForecastInsights failed: %v", err)
	}
	if !first.Insights.HasInsights || first.Insights.Cached {
		t.Fatalf("expected live non-cached insights on first call, got %+v", first.Insights)
	}
	if calls != 1 {
		t.Fatalf("expected 1 Gemini API call, got %d", calls)
	}

	// Subsequent GetForecast (and non-forced GenerateForecastInsights) must hit cache
	cachedGet, err := svc.GetForecast(context.Background(), scope, 6, 2570)
	if err != nil {
		t.Fatalf("GetForecast failed: %v", err)
	}
	if !cachedGet.Insights.HasInsights || !cachedGet.Insights.Cached {
		t.Fatalf("expected GetForecast to attach cached insights, got %+v", cachedGet.Insights)
	}

	second, err := svc.GenerateForecastInsights(context.Background(), scope, 6, 2570, false)
	if err != nil {
		t.Fatalf("second GenerateForecastInsights failed: %v", err)
	}
	if !second.Insights.Cached || calls != 1 {
		t.Fatalf("expected cache hit without new Gemini call, calls=%d insights=%+v", calls, second.Insights)
	}
}
