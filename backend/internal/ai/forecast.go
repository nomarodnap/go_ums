package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/dof/ums-backend/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	forecastCacheTTL       = 12 * time.Hour
	defaultForecastHorizon = 6
)

var thaiMonthShortLabels = [13]string{
	"", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
	"ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
}

var canonicalUtilities = []string{
	"ค่าไฟฟ้า",
	"ค่าประปา&น้ำบาดาล",
	"ค่าโทรศัพท์",
	"ค่าสื่อสาร&โทรคมนาคม",
	"ค่าบริการไปรษณีย์",
}

// MonthlyUtilityRecord represents one aggregated month/utility observation from DB or test fixture.
type MonthlyUtilityRecord struct {
	YearCE      int
	Month       int
	UtilityType string
	BillCount   int
	Amount      float64
}

type ForecastSeriesPoint struct {
	Month           int     `json:"month"`
	YearCE          int     `json:"yearCE"`
	YearBE          int     `json:"yearBE"`
	Label           string  `json:"label"`
	FullLabel       string  `json:"fullLabel"`
	ActualAmount    float64 `json:"actualAmount"`
	PredictedAmount float64 `json:"predictedAmount"`
	LowerBound      float64 `json:"lowerBound"`
	UpperBound      float64 `json:"upperBound"`
	BillCount       int     `json:"billCount"`
	IsForecast      bool    `json:"isForecast"`
	SeasonalIndex   float64 `json:"seasonalIndex"`
}

type UtilityForecastItem struct {
	UtilityType        string  `json:"utilityType"`
	LatestActual       float64 `json:"latestActual"`
	AvgRecent3Months   float64 `json:"avgRecent3Months"`
	NextMonthPredicted float64 `json:"nextMonthPredicted"`
	MoMChangePct       float64 `json:"moMChangePct"`
	SharePct           float64 `json:"sharePct"`
}

type DepartmentBudgetPlanItem struct {
	DepartmentID            string  `json:"departmentId"`
	DepartmentName          string  `json:"departmentName"`
	DepartmentShortName     string  `json:"departmentShortName,omitempty"`
	AllocatedAmount         float64 `json:"allocatedAmount"`
	TransferredAmount       float64 `json:"transferredAmount"`
	NetBudget               float64 `json:"netBudget"`
	YTDSpent                float64 `json:"ytdSpent"`
	ProjectedTotalSpend     float64 `json:"projectedTotalSpend"`
	ProjectedBalance        float64 `json:"projectedBalance"`
	ProjectedUtilizationPct float64 `json:"projectedUtilizationPct"`
	RecommendedAdjustment   float64 `json:"recommendedAdjustment"` // >0 add needed, <0 transferable surplus
	Status                  string  `json:"status"`                // HEALTHY, WATCH, RISK, DEFICIT, NO_BUDGET
}

type BudgetPlanSummary struct {
	FiscalYearCE            int                        `json:"fiscalYearCE"`
	FiscalYearBE            int                        `json:"fiscalYearBE"`
	FiscalYearLabel         string                     `json:"fiscalYearLabel"`
	AvailableFiscalYearsBE  []int                      `json:"availableFiscalYearsBE"`
	NetBudget               float64                    `json:"netBudget"`
	AllocatedAmount         float64                    `json:"allocatedAmount"`
	TransferredAmount       float64                    `json:"transferredAmount"`
	YTDSpent                float64                    `json:"ytdSpent"`
	YTDPaid                 float64                    `json:"ytdPaid"`
	YTDPending              float64                    `json:"ytdPending"`
	ProjectedRemainingSpend float64                    `json:"projectedRemainingSpend"`
	ProjectedTotalSpend     float64                    `json:"projectedTotalSpend"`
	ProjectedBalance        float64                    `json:"projectedBalance"`
	UtilizationPct          float64                    `json:"utilizationPct"`
	ProjectedUtilizationPct float64                    `json:"projectedUtilizationPct"`
	MonthsElapsed           int                        `json:"monthsElapsed"`
	MonthsRemaining         int                        `json:"monthsRemaining"`
	RecommendedAdditional   float64                    `json:"recommendedAdditional"`
	Status                  string                     `json:"status"` // HEALTHY, WATCH, RISK, DEFICIT, NO_BUDGET
	DepartmentPlans         []DepartmentBudgetPlanItem `json:"departmentPlans"`
}

type AlertPredictionItem struct {
	DepartmentID         string   `json:"departmentId"`
	DepartmentName       string   `json:"departmentName"`
	DepartmentShortName  string   `json:"departmentShortName,omitempty"`
	UtilityType          string   `json:"utilityType"`
	RiskScore            int      `json:"riskScore"`
	Severity             string   `json:"severity"` // HIGH, MEDIUM, LOW
	RiskCategories       []string `json:"riskCategories"`
	Title                string   `json:"title"`
	Reason               string   `json:"reason"`
	RecommendedAction    string   `json:"recommendedAction"`
	PredictedAmount      float64  `json:"predictedAmount,omitempty"`
	BaselineAmount       float64  `json:"baselineAmount,omitempty"`
	BudgetUtilizationPct float64  `json:"budgetUtilizationPct,omitempty"`
	RecentIncidentCount  int      `json:"recentIncidentCount,omitempty"`
}

type ForecastAIInsights struct {
	HasInsights           bool       `json:"hasInsights"`
	ExecutiveSummary      string     `json:"executiveSummary"`
	BudgetRecommendations []string   `json:"budgetRecommendations"`
	PreventiveActions     []string   `json:"preventiveActions"`
	Model                 string     `json:"model"`
	Cached                bool       `json:"cached"`
	GeneratedAt           *time.Time `json:"generatedAt,omitempty"`
}

type ForecastResponse struct {
	Enabled              bool                  `json:"enabled"`
	Scope                string                `json:"scope"` // "all" or "department"
	DepartmentID         string                `json:"departmentId,omitempty"`
	DepartmentName       string                `json:"departmentName"`
	Horizon              int                   `json:"horizon"`
	SampleMonths         int                   `json:"sampleMonths"`
	ConfidenceLevel      string                `json:"confidenceLevel"` // HIGH, MEDIUM, LOW
	ConfidenceLabel      string                `json:"confidenceLabel"`
	Method               string                `json:"method"`
	NextMonthLabel       string                `json:"nextMonthLabel"`
	NextMonthPredicted   float64               `json:"nextMonthPredicted"`
	NextMonthLowerBound  float64               `json:"nextMonthLowerBound"`
	NextMonthUpperBound  float64               `json:"nextMonthUpperBound"`
	LatestMonthLabel     string                `json:"latestMonthLabel"`
	LatestMonthActual    float64               `json:"latestMonthActual"`
	MoMForecastChangePct float64               `json:"moMForecastChangePct"`
	HistoricalAvgMonthly float64               `json:"historicalAvgMonthly"`
	Series               []ForecastSeriesPoint `json:"series"`
	UtilityBreakdown     []UtilityForecastItem `json:"utilityBreakdown"`
	BudgetPlan           BudgetPlanSummary     `json:"budgetPlan"`
	AlertPredictions     []AlertPredictionItem `json:"alertPredictions"`
	Insights             ForecastAIInsights    `json:"insights"`
}

// ForecastService computes time-series forecasts, budget plans, early-warning alert predictions, and optional Gemini advice.
type ForecastService struct {
	client *Client
	pool   *pgxpool.Pool
	cache  CacheStore
	now    func() time.Time
}

func NewForecastService(client *Client, pool *pgxpool.Pool, cacheStore CacheStore) *ForecastService {
	return &ForecastService{
		client: client,
		pool:   pool,
		cache:  cacheStore,
		now:    time.Now,
	}
}

func (s *ForecastService) IsConfigured() bool {
	return s != nil && s.client != nil && s.client.IsConfigured()
}

func (s *ForecastService) Model() string {
	if s == nil || s.client == nil {
		return "gemini-3.5-flash"
	}
	return s.client.Model()
}

// BuildForecastCacheKey builds a deterministic cache key always <= 64 chars for system_settings.key.
func BuildForecastCacheKey(scope UserScope, fyCE, horizon int) string {
	target := "all"
	if scope.DepartmentID != "" {
		sum := sha256.Sum256([]byte(scope.DepartmentID))
		target = "d_" + hex.EncodeToString(sum[:8])
	}
	return fmt.Sprintf("ai_fc:%s:%04d:h%02d", target, fyCE, horizon)
}

// ThaiFiscalYearCE maps a calendar month/yearCE to its Thai fiscal year in CE (Oct..Sep => next CE year).
func ThaiFiscalYearCE(month, yearCE int) int {
	if yearCE > 2400 {
		yearCE -= 543
	}
	if month >= 10 {
		return yearCE + 1
	}
	return yearCE
}

func toFiscalYearBE(y int) int {
	if y <= 0 {
		return 0
	}
	if y < 2400 {
		return y + 543
	}
	return y
}

func ymToMonthYear(ym int) (int, int) {
	y := (ym - 1) / 12
	m := ym - y*12
	return m, y
}

func round2(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return math.Round(v*100) / 100
}

func round1(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return math.Round(v*10) / 10
}

// GetForecast returns deterministic Phase 4 forecast + budget planning + alert predictions, attaching cached AI insights if available.
func (s *ForecastService) GetForecast(ctx context.Context, scope UserScope, horizon, fiscalYear int) (*ForecastResponse, error) {
	scope = s.normalizeScopeForQuery(ctx, scope)
	h := clampInt(horizon, 1, 12)
	if horizon <= 0 {
		h = defaultForecastHorizon
	}

	now := s.now()
	records, err := s.fetchMonthlyHistory(ctx, scope.DepartmentID)
	if err != nil {
		return nil, err
	}

	ts := ComputeExpenseTimeSeries(records, now, h)

	// Build internal 12-month horizon forecast map so FY remaining months can look up seasonal predictions cleanly
	ts12 := ts
	if h < 12 {
		ts12 = ComputeExpenseTimeSeries(records, now, 12)
	}

	budgetPlan, err := s.buildBudgetPlan(ctx, scope, fiscalYear, now, ts12)
	if err != nil {
		return nil, err
	}

	alerts, err := s.buildAlertPredictions(ctx, scope, now, ts.MaxActualYM, budgetPlan.FiscalYearCE)
	if err != nil {
		return nil, err
	}

	scopeStr := "all"
	if scope.DepartmentID != "" {
		scopeStr = "department"
	}

	insights := ForecastAIInsights{
		HasInsights:           false,
		BudgetRecommendations: []string{},
		PreventiveActions:     []string{},
		Model:                 s.Model(),
	}
	cacheKey := BuildForecastCacheKey(scope, budgetPlan.FiscalYearCE, h)
	if cached := s.loadCachedInsights(ctx, cacheKey); cached != nil {
		cached.Cached = true
		insights = *cached
	}

	return &ForecastResponse{
		Enabled:              s.IsConfigured(),
		Scope:                scopeStr,
		DepartmentID:         scope.DepartmentID,
		DepartmentName:       scope.DepartmentName,
		Horizon:              h,
		SampleMonths:         ts.SampleMonths,
		ConfidenceLevel:      ts.ConfidenceLevel,
		ConfidenceLabel:      ts.ConfidenceLabel,
		Method:               ts.Method,
		NextMonthLabel:       ts.NextMonthLabel,
		NextMonthPredicted:   ts.NextMonthPredicted,
		NextMonthLowerBound:  ts.NextMonthLowerBound,
		NextMonthUpperBound:  ts.NextMonthUpperBound,
		LatestMonthLabel:     ts.LatestMonthLabel,
		LatestMonthActual:    ts.LatestMonthActual,
		MoMForecastChangePct: ts.MoMForecastChangePct,
		HistoricalAvgMonthly: ts.HistoricalAvgMonthly,
		Series:               ts.Series,
		UtilityBreakdown:     ts.UtilityBreakdown,
		BudgetPlan:           budgetPlan,
		AlertPredictions:     alerts,
		Insights:             insights,
	}, nil
}

// GenerateForecastInsights computes fresh Phase 4 data and uses Gemini AI to synthesize executive recommendations.
func (s *ForecastService) GenerateForecastInsights(ctx context.Context, scope UserScope, horizon, fiscalYear int, force bool) (*ForecastResponse, error) {
	res, err := s.GetForecast(ctx, scope, horizon, fiscalYear)
	if err != nil {
		return nil, err
	}
	if !force && res.Insights.HasInsights {
		return res, nil
	}
	if !s.IsConfigured() {
		return nil, ErrAIConfigMissing
	}

	normScope := s.normalizeScopeForQuery(ctx, scope)
	cacheKey := BuildForecastCacheKey(normScope, res.BudgetPlan.FiscalYearCE, res.Horizon)

	// Prepare concise, grounded dataset for Gemini (never pass empty noise)
	topAlerts := res.AlertPredictions
	if len(topAlerts) > 6 {
		topAlerts = topAlerts[:6]
	}
	topDeptBudgets := res.BudgetPlan.DepartmentPlans
	if len(topDeptBudgets) > 8 {
		topDeptBudgets = topDeptBudgets[:8]
	}
	futurePoints := make([]ForecastSeriesPoint, 0, res.Horizon)
	for _, pt := range res.Series {
		if pt.IsForecast {
			futurePoints = append(futurePoints, pt)
		}
	}

	promptData := map[string]any{
		"scope":                res.DepartmentName,
		"horizonMonths":        res.Horizon,
		"sampleMonths":         res.SampleMonths,
		"confidenceLabel":      res.ConfidenceLabel,
		"latestMonthLabel":     res.LatestMonthLabel,
		"latestMonthActual":    res.LatestMonthActual,
		"nextMonthLabel":       res.NextMonthLabel,
		"nextMonthPredicted":   res.NextMonthPredicted,
		"nextMonthRange":       []float64{res.NextMonthLowerBound, res.NextMonthUpperBound},
		"moMForecastChangePct": res.MoMForecastChangePct,
		"historicalAvgMonthly": res.HistoricalAvgMonthly,
		"futureMonths":         futurePoints,
		"utilityBreakdown":     res.UtilityBreakdown,
		"budgetPlan": map[string]any{
			"fiscalYearBE":            res.BudgetPlan.FiscalYearBE,
			"netBudget":               res.BudgetPlan.NetBudget,
			"ytdSpent":                res.BudgetPlan.YTDSpent,
			"projectedTotalSpend":     res.BudgetPlan.ProjectedTotalSpend,
			"projectedBalance":        res.BudgetPlan.ProjectedBalance,
			"projectedUtilizationPct": res.BudgetPlan.ProjectedUtilizationPct,
			"monthsElapsed":           res.BudgetPlan.MonthsElapsed,
			"monthsRemaining":         res.BudgetPlan.MonthsRemaining,
			"recommendedAdditional":   res.BudgetPlan.RecommendedAdditional,
			"status":                  res.BudgetPlan.Status,
			"priorityDepartments":     topDeptBudgets,
		},
		"predictedAlerts": topAlerts,
	}
	rawJSON, _ := json.Marshal(promptData)

	type geminiForecastPayload struct {
		ExecutiveSummary      string   `json:"executiveSummary"`
		BudgetRecommendations []string `json:"budgetRecommendations"`
		PreventiveActions     []string `json:"preventiveActions"`
	}

	aiCtx, cancel := context.WithTimeout(ctx, 50*time.Second)
	defer cancel()

	sysPrompt := `คุณคือนักวิเคราะห์งบประมาณและผู้วางแผนการเงินอาวุโสของกรมประมง (ระบบบริหารจัดการค่าสาธารณูปโภค UMS)
จากข้อมูลพยากรณ์ค่าใช้จ่าย งบประมาณปี พ.ศ. และสัญญาณเตือนความเสี่ยงล่วงหน้าใน JSON ด้านล่าง จงวิเคราะห์และจัดทำข้อเสนอแนะเชิงกลยุทธ์เป็นภาษาไทยในรูปแบบ JSON เท่านั้น:
{
  "executiveSummary": "บทสรุปผู้บริหาร 1-2 ประโยค ชี้แนวโน้มเดือนหน้า ฐานงบประมาณทั้งปี และความเสี่ยงสำคัญ",
  "budgetRecommendations": ["ข้อเสนอแนะการจัดสรร/โอนเปลี่ยนแปลงงบประมาณข้อ 1 พร้อมตัวเลขจริง", "ข้อ 2", "ข้อ 3"],
  "preventiveActions": ["มาตรการป้องกันความผิดปกติหรือค่าใช้จ่ายบานปลายล่วงหน้าข้อ 1", "ข้อ 2", "ข้อ 3"]
}
ข้อกำหนด:
- ใช้เฉพาะตัวเลข หน่วยงาน และหมวดหมู่จาก JSON ที่ให้มาเท่านั้น ห้ามสมมติตัวเลขใหม่
- ใช้ปี พ.ศ. เสมอ คั่นหลักพันด้วยจุลภาค
- แนะนำเชิงปฏิบัติจริง (เช่น โอนถัวจ่ายระหว่างหน่วยงานเหลือจ่าย, ตรวจสอบมิเตอร์ก่อนปิดรอบ, ควบคุมค่าไฟฟ้า/โทรศัพท์)`

	temp := 0.2
	resp, err := s.client.GenerateContent(aiCtx, GenerateContentRequest{
		SystemInstruction: &Content{Parts: []Part{{Text: sysPrompt}}},
		Contents: []Content{{
			Role:  "user",
			Parts: []Part{{Text: "ข้อมูลพยากรณ์และงบประมาณ:\n" + string(rawJSON)}},
		}},
		GenerationConfig: &GenerationConfig{
			Temperature:      &temp,
			MaxOutputTokens:  4096,
			ResponseMIMEType: "application/json",
		},
	})
	if err != nil {
		return nil, err
	}

	parsed, err := decodeGeminiCandidate[geminiForecastPayload](resp)
	if err != nil {
		return nil, fmt.Errorf("ไม่สามารถอ่านคำแนะนำพยากรณ์จาก AI: %w", err)
	}

	nowUTC := s.now().UTC()
	insights := ForecastAIInsights{
		HasInsights:           true,
		ExecutiveSummary:      strings.TrimSpace(parsed.ExecutiveSummary),
		BudgetRecommendations: nonEmptyStrings(parsed.BudgetRecommendations),
		PreventiveActions:     nonEmptyStrings(parsed.PreventiveActions),
		Model:                 s.Model(),
		Cached:                false,
		GeneratedAt:           &nowUTC,
	}
	if insights.BudgetRecommendations == nil {
		insights.BudgetRecommendations = []string{}
	}
	if insights.PreventiveActions == nil {
		insights.PreventiveActions = []string{}
	}

	s.saveCachedInsights(ctx, cacheKey, &insights)
	res.Insights = insights
	return res, nil
}

func (s *ForecastService) normalizeScopeForQuery(ctx context.Context, scope UserScope) UserScope {
	out := scope
	if out.DepartmentID != "" {
		if out.DepartmentName == "" && s.pool != nil {
			_ = s.pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", out.DepartmentID).Scan(&out.DepartmentName)
		}
		if out.DepartmentName == "" {
			out.DepartmentName = "หน่วยงานที่เลือก"
		}
		return out
	}
	if out.DepartmentName == "" {
		out.DepartmentName = "ภาพรวมทั้งกรมประมง (292 หน่วยงาน)"
	}
	return out
}

func (s *ForecastService) fetchMonthlyHistory(ctx context.Context, deptID string) ([]MonthlyUtilityRecord, error) {
	if s.pool == nil {
		return []MonthlyUtilityRecord{}, nil
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			(CASE WHEN billing_year > 2400 THEN billing_year - 543 ELSE billing_year END) AS y_ce,
			billing_month,
			utility_type,
			COUNT(*)::int,
			COALESCE(SUM(
				CASE WHEN payment_status = 'PAID' THEN COALESCE(paid_amount, invoice_amount, 0)
				     ELSE COALESCE(invoice_amount, estimated_amount, 0) END
			), 0)::float8
		FROM utility_bills
		WHERE billing_month BETWEEN 1 AND 12
		  AND billing_year > 0
		  AND ($1::text = '' OR department_id = $1)
		GROUP BY y_ce, billing_month, utility_type
		ORDER BY y_ce ASC, billing_month ASC
	`, deptID)
	if err != nil {
		return nil, fmt.Errorf("query monthly bill history: %w", err)
	}
	defer rows.Close()

	records := make([]MonthlyUtilityRecord, 0, 64)
	for rows.Next() {
		var rec MonthlyUtilityRecord
		if scanErr := rows.Scan(&rec.YearCE, &rec.Month, &rec.UtilityType, &rec.BillCount, &rec.Amount); scanErr == nil {
			records = append(records, rec)
		}
	}
	return records, nil
}

type timeSeriesComputation struct {
	SampleMonths         int
	MaxActualYM          int
	ConfidenceLevel      string
	ConfidenceLabel      string
	Method               string
	NextMonthLabel       string
	NextMonthPredicted   float64
	NextMonthLowerBound  float64
	NextMonthUpperBound  float64
	LatestMonthLabel     string
	LatestMonthActual    float64
	MoMForecastChangePct float64
	HistoricalAvgMonthly float64
	Series               []ForecastSeriesPoint
	UtilityBreakdown     []UtilityForecastItem
	FutureByYM           map[int]float64
	ActualByYM           map[int]float64
}

// ComputeExpenseTimeSeries computes seasonally-adjusted damped linear trend forecasts from historical records.
// Pure and deterministic for unit testing and offline reliability.
func ComputeExpenseTimeSeries(records []MonthlyUtilityRecord, now time.Time, horizon int) timeSeriesComputation {
	horizon = clampInt(horizon, 1, 12)
	currentNowYM := now.Year()*12 + int(now.Month())

	type ymBucket struct {
		total     float64
		billCount int
		byUtil    map[string]float64
	}
	buckets := make(map[int]*ymBucket)
	minYM, maxYM := 0, 0

	for _, r := range records {
		y := r.YearCE
		if y > 2400 {
			y -= 543
		}
		if y <= 0 || r.Month < 1 || r.Month > 12 {
			continue
		}
		ym := y*12 + r.Month
		b, ok := buckets[ym]
		if !ok {
			b = &ymBucket{byUtil: make(map[string]float64)}
			buckets[ym] = b
		}
		u := NormalizeUtilityType(r.UtilityType)
		if u == "" {
			u = "ค่าไฟฟ้า"
		}
		amt := math.Max(0, r.Amount)
		b.total += amt
		b.billCount += r.BillCount
		b.byUtil[u] += amt

		if minYM == 0 || ym < minYM {
			minYM = ym
		}
		if ym > maxYM {
			maxYM = ym
		}
	}

	if maxYM == 0 || len(buckets) == 0 {
		emptyBreakdown := make([]UtilityForecastItem, 0, len(canonicalUtilities))
		for _, u := range canonicalUtilities {
			emptyBreakdown = append(emptyBreakdown, UtilityForecastItem{UtilityType: u})
		}
		nextM, nextY := ymToMonthYear(currentNowYM + 1)
		return timeSeriesComputation{
			SampleMonths:     0,
			ConfidenceLevel:  "LOW",
			ConfidenceLabel:  "ยังไม่มีข้อมูลประวัติเพียงพอ",
			Method:           "Seasonally Adjusted Damped Linear Trend",
			NextMonthLabel:   fmt.Sprintf("%s %02d", thaiMonthShortLabels[nextM], (nextY+543)%100),
			Series:           []ForecastSeriesPoint{},
			UtilityBreakdown: emptyBreakdown,
			FutureByYM:       map[int]float64{},
			ActualByYM:       map[int]float64{},
		}
	}

	// Keep up to last 24 calendar months ending at maxYM
	windowStartYM := maxYM - 23
	if minYM > windowStartYM {
		windowStartYM = minYM
	}

	type obsPoint struct {
		ym        int
		month     int
		yearCE    int
		total     float64
		billCount int
		byUtil    map[string]float64
	}
	dense := make([]obsPoint, 0, maxYM-windowStartYM+1)
	actualByYM := make(map[int]float64, len(buckets))
	for ym := minYM; ym <= maxYM; ym++ {
		if b, ok := buckets[ym]; ok {
			actualByYM[ym] = round2(b.total)
		}
	}
	for ym := windowStartYM; ym <= maxYM; ym++ {
		m, y := ymToMonthYear(ym)
		total := 0.0
		cnt := 0
		var uMap map[string]float64
		if b, ok := buckets[ym]; ok {
			total = b.total
			cnt = b.billCount
			uMap = b.byUtil
		}
		dense = append(dense, obsPoint{
			ym:        ym,
			month:     m,
			yearCE:    y,
			total:     total,
			billCount: cnt,
			byUtil:    uMap,
		})
	}

	// Detect an incomplete in-progress current calendar month at the tail so it does not skew slope downward
	fitLen := len(dense)
	if fitLen >= 4 && maxYM == currentNowYM {
		trailingCounts := make([]float64, 0, 3)
		for i := fitLen - 4; i < fitLen-1; i++ {
			if dense[i].billCount > 0 {
				trailingCounts = append(trailingCounts, float64(dense[i].billCount))
			}
		}
		if len(trailingCounts) >= 2 {
			sort.Float64s(trailingCounts)
			med := trailingCounts[len(trailingCounts)/2]
			tail := dense[fitLen-1]
			if med >= 3 && float64(tail.billCount) < 0.30*med && tail.total < 0.35*dense[fitLen-2].total {
				fitLen--
			}
		}
	}
	fitPts := dense[:fitLen]

	// Trim leading empty zero months inside the fit slice if any
	activeCount := 0
	var activeSum float64
	for _, p := range fitPts {
		if p.total > 0 || p.billCount > 0 {
			activeCount++
			activeSum += p.total
		}
	}
	histAvg := 0.0
	if activeCount > 0 {
		histAvg = activeSum / float64(activeCount)
	}

	// Build seasonal index S_m for m=1..12 when spanning >= 12 months
	seasonal := [13]float64{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1}
	if len(fitPts) >= 12 && histAvg > 0 {
		monthSum := [13]float64{}
		monthCnt := [13]int{}
		for _, p := range fitPts {
			if p.total > 0 {
				monthSum[p.month] += p.total
				monthCnt[p.month]++
			}
		}
		shrinkWeight := 0.65
		if len(fitPts) >= 24 {
			shrinkWeight = 0.85
		}
		for m := 1; m <= 12; m++ {
			if monthCnt[m] > 0 {
				ratio := (monthSum[m] / float64(monthCnt[m])) / histAvg
				idx := 1.0 + shrinkWeight*(ratio-1.0)
				if idx < 0.65 {
					idx = 0.65
				} else if idx > 1.45 {
					idx = 1.45
				}
				seasonal[m] = idx
			}
		}
	}

	// Fit deseasonalized weighted level + clamped damped OLS slope on trailing min(12, fitLen) points
	trainStart := 0
	if len(fitPts) > 12 {
		trainStart = len(fitPts) - 12
	}
	train := fitPts[trainStart:]
	mLen := len(train)

	deseas := make([]float64, mLen)
	for i, p := range train {
		sIdx := seasonal[p.month]
		if sIdx <= 0 {
			sIdx = 1.0
		}
		deseas[i] = p.total / sIdx
	}

	// Recency-weighted baseline (exponential decay favoring recent 6 months)
	var wSum, wValSum, wXSum float64
	for i, val := range deseas {
		age := mLen - 1 - i
		w := math.Exp(-0.25 * float64(age))
		if train[i].total == 0 && train[i].billCount == 0 && mLen > 2 {
			w *= 0.25 // lightly down-weight empty missing gap months
		}
		wSum += w
		wValSum += w * val
		wXSum += w * float64(i)
	}
	wMean := 0.0
	wXMean := 0.0
	if mLen > 0 {
		wXMean = float64(mLen - 1)
	}
	if wSum > 0 {
		wMean = wValSum / wSum
		wXMean = wXSum / wSum
	}

	slope := 0.0
	if mLen >= 3 && wMean > 0 {
		var sx, sy, sxx, sxy float64
		n := float64(mLen)
		for i, val := range deseas {
			x := float64(i)
			sx += x
			sy += val
			sxx += x * x
			sxy += x * val
		}
		denom := n*sxx - sx*sx
		if math.Abs(denom) > 1e-9 {
			slope = (n*sxy - sx*sy) / denom
		}
		maxStep := 0.10 * wMean
		if slope > maxStep {
			slope = maxStep
		} else if slope < -maxStep {
			slope = -maxStep
		}
	}

	// Shift weighted level from weighted midpoint wXMean to end-of-window (mLen - 1)
	// so linear trends start from the current end-of-sample level rather than lagging behind.
	baseLevel := 0.0
	if mLen > 0 {
		baseLevel = math.Max(0, wMean+slope*(float64(mLen-1)-wXMean))
	}

	// Compute deseasonalized model residual stdDev for calibrated prediction bands
	sigma := 0.18 * math.Max(wMean, baseLevel)
	if mLen >= 4 && baseLevel > 0 {
		var sx, sy, sxx, sxy float64
		n := float64(mLen)
		for i, val := range deseas {
			x := float64(i)
			sx += x
			sy += val
			sxx += x * x
			sxy += x * val
		}
		meanX := sx / n
		meanY := sy / n
		rawSlope := 0.0
		if denom := n*sxx - sx*sx; math.Abs(denom) > 1e-9 {
			rawSlope = (n*sxy - sx*sy) / denom
		}
		intercept := meanY - rawSlope*meanX
		var sqErr float64
		for i, val := range deseas {
			fitVal := intercept + rawSlope*float64(i)
			err := val - fitVal
			sqErr += err * err
		}
		sErr := math.Sqrt(sqErr / float64(mLen-2))
		minSig := 0.06 * baseLevel
		maxSig := 0.45 * baseLevel
		if sErr < minSig {
			sErr = minSig
		} else if sErr > maxSig {
			sErr = maxSig
		}
		sigma = sErr
	}

	// Build full series: last 12 historical points (or all dense points up to 12) + horizon forecast points
	histDisplayStart := 0
	if len(dense) > 12 {
		histDisplayStart = len(dense) - 12
	}
	series := make([]ForecastSeriesPoint, 0, (len(dense)-histDisplayStart)+horizon)
	for _, p := range dense[histDisplayStart:] {
		yBE := p.yearCE + 543
		series = append(series, ForecastSeriesPoint{
			Month:         p.month,
			YearCE:        p.yearCE,
			YearBE:        yBE,
			Label:         fmt.Sprintf("%s %02d", thaiMonthShortLabels[p.month], yBE%100),
			FullLabel:     fmt.Sprintf("เดือน%s พ.ศ. %d", thaiMonthNames[p.month], yBE),
			ActualAmount:  round2(p.total),
			BillCount:     p.billCount,
			IsForecast:    false,
			SeasonalIndex: round2(seasonal[p.month]),
		})
	}

	futureByYM := make(map[int]float64, horizon)
	dampSum := 0.0
	for k := 1; k <= horizon; k++ {
		dampSum += math.Pow(0.85, float64(k-1))
		targetYM := maxYM + k
		m, y := ymToMonthYear(targetYM)
		yBE := y + 543
		sIdx := seasonal[m]
		pred := math.Max(0, (baseLevel+slope*dampSum)*sIdx)
		halfW := 1.28 * sigma * math.Sqrt(float64(k)) * sIdx
		low := math.Max(0, pred-halfW)
		high := pred + halfW

		predR := round2(pred)
		futureByYM[targetYM] = predR
		series = append(series, ForecastSeriesPoint{
			Month:           m,
			YearCE:          y,
			YearBE:          yBE,
			Label:           fmt.Sprintf("%s %02d", thaiMonthShortLabels[m], yBE%100),
			FullLabel:       fmt.Sprintf("เดือน%s พ.ศ. %d", thaiMonthNames[m], yBE),
			PredictedAmount: predR,
			LowerBound:      round2(low),
			UpperBound:      round2(high),
			IsForecast:      true,
			SeasonalIndex:   round2(sIdx),
		})
	}

	latestPt := dense[len(dense)-1]
	latestYBE := latestPt.yearCE + 543
	latestLabel := fmt.Sprintf("เดือน%s พ.ศ. %d", thaiMonthNames[latestPt.month], latestYBE)
	latestActual := round2(latestPt.total)

	nextPt := series[len(dense[histDisplayStart:])]
	momPct := 0.0
	compareBase := latestActual
	if fitLen < len(dense) && fitLen > 0 {
		// Compare vs last complete month when tail month was severely partial
		compareBase = fitPts[fitLen-1].total
	}
	if compareBase > 0 {
		momPct = round1(((nextPt.PredictedAmount - compareBase) / compareBase) * 100)
	}

	// Confidence metadata
	confLevel := "LOW"
	confLabel := "ความเชื่อมั่นต่ำ (ข้อมูลประวัติมีน้อยกว่า 3 เดือน)"
	if activeCount >= 12 {
		confLevel = "HIGH"
		confLabel = fmt.Sprintf("ความเชื่อมั่นสูง (ข้อมูลประวัติ %d เดือน ครบฤดูกาล)", activeCount)
	} else if activeCount >= 3 {
		confLevel = "MEDIUM"
		confLabel = fmt.Sprintf("ความเชื่อมั่นปานกลาง (ข้อมูลประวัติ %d เดือน)", activeCount)
	}

	// Per-utility forecast breakdown calibrated so sum aligns coherently with nextMonthPredicted
	rawCats := make([]float64, len(canonicalUtilities))
	recent3Cats := make([]float64, len(canonicalUtilities))
	latestCats := make([]float64, len(canonicalUtilities))
	var rawCatTotal float64

	recentStart := len(fitPts) - 3
	if recentStart < 0 {
		recentStart = 0
	}
	for i, util := range canonicalUtilities {
		latestCats[i] = round2(latestPt.byUtil[util])

		var sum3 float64
		for j := recentStart; j < len(fitPts); j++ {
			sum3 += fitPts[j].byUtil[util]
		}
		if n3 := len(fitPts) - recentStart; n3 > 0 {
			recent3Cats[i] = round2(sum3 / float64(n3))
		}

		// Recency-weighted utility baseline + optional prior-year same-month adjustment
		var uwSum, uwValSum float64
		for j, p := range train {
			age := len(train) - 1 - j
			w := math.Exp(-0.30 * float64(age))
			uwSum += w
			uwValSum += w * p.byUtil[util]
		}
		uPred := 0.0
		if uwSum > 0 {
			uPred = uwValSum / uwSum
		}
		if len(fitPts) >= 12 && histAvg > 0 {
			var sameMSum float64
			var sameMCnt int
			var uAllSum float64
			for _, p := range fitPts {
				v := p.byUtil[util]
				uAllSum += v
				if p.month == nextPt.Month {
					sameMSum += v
					sameMCnt++
				}
			}
			uAvg := uAllSum / float64(len(fitPts))
			if sameMCnt > 0 && uAvg > 0 {
				ratio := (sameMSum / float64(sameMCnt)) / uAvg
				idx := 1.0 + 0.60*(ratio-1.0)
				if idx < 0.65 {
					idx = 0.65
				} else if idx > 1.45 {
					idx = 1.45
				}
				uPred *= idx
			}
		}
		rawCats[i] = uPred
		rawCatTotal += uPred
	}

	breakdown := make([]UtilityForecastItem, 0, len(canonicalUtilities))
	scale := 1.0
	if rawCatTotal > 0 && nextPt.PredictedAmount > 0 {
		scale = nextPt.PredictedAmount / rawCatTotal
	}
	for i, util := range canonicalUtilities {
		predCat := round2(rawCats[i] * scale)
		baseCompare := latestCats[i]
		if fitLen < len(dense) && fitLen > 0 {
			baseCompare = fitPts[fitLen-1].byUtil[util]
		}
		catMoM := 0.0
		if baseCompare > 0 {
			catMoM = round1(((predCat - baseCompare) / baseCompare) * 100)
		}
		share := 0.0
		if nextPt.PredictedAmount > 0 {
			share = round1((predCat / nextPt.PredictedAmount) * 100)
		}
		breakdown = append(breakdown, UtilityForecastItem{
			UtilityType:        util,
			LatestActual:       latestCats[i],
			AvgRecent3Months:   recent3Cats[i],
			NextMonthPredicted: predCat,
			MoMChangePct:       catMoM,
			SharePct:           share,
		})
	}

	sort.SliceStable(breakdown, func(i, j int) bool {
		return breakdown[i].NextMonthPredicted > breakdown[j].NextMonthPredicted
	})

	return timeSeriesComputation{
		SampleMonths:         activeCount,
		MaxActualYM:          maxYM,
		ConfidenceLevel:      confLevel,
		ConfidenceLabel:      confLabel,
		Method:               "Seasonally Adjusted Damped Linear Trend",
		NextMonthLabel:       nextPt.FullLabel,
		NextMonthPredicted:   nextPt.PredictedAmount,
		NextMonthLowerBound:  nextPt.LowerBound,
		NextMonthUpperBound:  nextPt.UpperBound,
		LatestMonthLabel:     latestLabel,
		LatestMonthActual:    latestActual,
		MoMForecastChangePct: momPct,
		HistoricalAvgMonthly: round2(histAvg),
		Series:               series,
		UtilityBreakdown:     breakdown,
		FutureByYM:           futureByYM,
		ActualByYM:           actualByYM,
	}
}

func (s *ForecastService) resolveTargetFiscalYear(ctx context.Context, requested int, scope UserScope, now time.Time) (int, []int) {
	activeFYCE := ThaiFiscalYearCE(int(now.Month()), now.Year())
	availSet := make(map[int]struct{})
	budgetYearsSet := make(map[int]struct{})

	if s.pool != nil {
		bRows, err := s.pool.Query(ctx, `
			SELECT DISTINCT fiscal_year FROM budgets
			WHERE ($1::text = '' OR department_id = $1)
		`, scope.DepartmentID)
		if err == nil {
			defer bRows.Close()
			for bRows.Next() {
				var fy int
				if bRows.Scan(&fy) == nil && fy > 0 {
					be := toFiscalYearBE(fy)
					availSet[be] = struct{}{}
					budgetYearsSet[be] = struct{}{}
				}
			}
		}

		uRows, err := s.pool.Query(ctx, `
			SELECT DISTINCT
				(CASE WHEN billing_year > 2400 THEN billing_year - 543 ELSE billing_year END) +
				(CASE WHEN billing_month >= 10 THEN 1 ELSE 0 END) AS fy_ce
			FROM utility_bills
			WHERE billing_year > 0 AND billing_month BETWEEN 1 AND 12
			  AND ($1::text = '' OR department_id = $1)
		`, scope.DepartmentID)
		if err == nil {
			defer uRows.Close()
			for uRows.Next() {
				var fyCE int
				if uRows.Scan(&fyCE) == nil && fyCE > 0 {
					availSet[fyCE+543] = struct{}{}
				}
			}
		}
	}

	availSet[activeFYCE+543] = struct{}{}
	avail := make([]int, 0, len(availSet))
	for y := range availSet {
		avail = append(avail, y)
	}
	sort.Slice(avail, func(i, j int) bool { return avail[i] > avail[j] })

	if requested > 0 {
		return NormalizeBillingYearCE(requested, now), avail
	}

	if _, hasActiveBudget := budgetYearsSet[activeFYCE+543]; hasActiveBudget {
		return activeFYCE, avail
	}
	if len(budgetYearsSet) > 0 {
		maxBudgetBE := 0
		for be := range budgetYearsSet {
			if be > maxBudgetBE {
				maxBudgetBE = be
			}
		}
		if maxBudgetBE > 0 {
			return maxBudgetBE - 543, avail
		}
	}
	return activeFYCE, avail
}

func classifyBudgetStatus(netBudget, ytdSpent, projectedTotal, projectedUtilPct float64) string {
	if netBudget <= 0 {
		if ytdSpent > 0 || projectedTotal > 0 {
			return "NO_BUDGET"
		}
		return "HEALTHY"
	}
	if projectedTotal > netBudget {
		return "DEFICIT"
	}
	if projectedUtilPct >= 85 {
		return "RISK"
	}
	if projectedUtilPct >= 70 {
		return "WATCH"
	}
	return "HEALTHY"
}

func (s *ForecastService) buildBudgetPlan(
	ctx context.Context,
	scope UserScope,
	requestedFY int,
	now time.Time,
	ts12 timeSeriesComputation,
) (BudgetPlanSummary, error) {
	fyCE, availBE := s.resolveTargetFiscalYear(ctx, requestedFY, scope, now)
	fyBE := fyCE + 543
	fyStartYM := (fyCE-1)*12 + 10 // Oct
	fyEndYM := fyCE*12 + 9        // Sep

	plan := BudgetPlanSummary{
		FiscalYearCE:           fyCE,
		FiscalYearBE:           fyBE,
		FiscalYearLabel:        fmt.Sprintf("ปีงบประมาณ พ.ศ. %d", fyBE),
		AvailableFiscalYearsBE: availBE,
		DepartmentPlans:        []DepartmentBudgetPlanItem{},
	}

	if s.pool == nil {
		plan.MonthsRemaining = 12
		plan.Status = "HEALTHY"
		return plan, nil
	}

	// 1. Query overall & per-department budget allocations in this FY (supporting both CE & BE rows)
	type deptBudgetAgg struct {
		deptID      string
		deptName    string
		shortName   string
		allocated   float64
		transferred float64
		ytdSpent    float64
		ytdPaid     float64
		ytdPending  float64
		fyMonths    int
		maxFYYM     int
	}
	deptMap := make(map[string]*deptBudgetAgg)
	getDept := func(id, name, short string) *deptBudgetAgg {
		if d, ok := deptMap[id]; ok {
			if name != "" && d.deptName == "" {
				d.deptName = name
			}
			if short != "" && d.shortName == "" {
				d.shortName = short
			}
			return d
		}
		d := &deptBudgetAgg{deptID: id, deptName: name, shortName: short}
		deptMap[id] = d
		return d
	}

	bRows, err := s.pool.Query(ctx, `
		SELECT
			b.department_id,
			COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			COALESCE(d.short_name, ''),
			COALESCE(SUM(b.allocated_amount), 0)::float8,
			COALESCE(SUM(b.transferred_amount), 0)::float8
		FROM budgets b
		LEFT JOIN departments d ON b.department_id = d.id
		WHERE b.fiscal_year IN ($1, $2)
		  AND ($3::text = '' OR b.department_id = $3)
		GROUP BY b.department_id, d.full_name, d.short_name
	`, fyCE, fyBE, scope.DepartmentID)
	if err != nil {
		return plan, fmt.Errorf("query budget allocations: %w", err)
	}
	defer bRows.Close()

	for bRows.Next() {
		var dID, dName, dShort string
		var alloc, trans float64
		if bRows.Scan(&dID, &dName, &dShort, &alloc, &trans) == nil {
			d := getDept(dID, dName, dShort)
			d.allocated += alloc
			d.transferred += trans
			plan.AllocatedAmount += alloc
			plan.TransferredAmount += trans
		}
	}
	plan.NetBudget = round2(plan.AllocatedAmount + plan.TransferredAmount)

	// 2. Query YTD spending in [fyStartYM .. fyEndYM] per department
	sRows, err := s.pool.Query(ctx, `
		SELECT
			u.department_id,
			COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			COALESCE(d.short_name, ''),
			COALESCE(SUM(CASE WHEN u.payment_status = 'PAID' THEN COALESCE(u.paid_amount, u.invoice_amount, 0) ELSE 0 END), 0)::float8 AS ytd_paid,
			COALESCE(SUM(CASE WHEN u.payment_status <> 'PAID' THEN COALESCE(u.invoice_amount, u.estimated_amount, 0) ELSE 0 END), 0)::float8 AS ytd_pending,
			COUNT(DISTINCT (CASE WHEN u.billing_year > 2400 THEN u.billing_year - 543 ELSE u.billing_year END) * 12 + u.billing_month)::int AS m_cnt,
			COALESCE(MAX((CASE WHEN u.billing_year > 2400 THEN u.billing_year - 543 ELSE u.billing_year END) * 12 + u.billing_month), 0)::int AS max_ym
		FROM utility_bills u
		LEFT JOIN departments d ON u.department_id = d.id
		WHERE u.billing_month BETWEEN 1 AND 12
		  AND u.billing_year > 0
		  AND ((CASE WHEN u.billing_year > 2400 THEN u.billing_year - 543 ELSE u.billing_year END) * 12 + u.billing_month) BETWEEN $1 AND $2
		  AND ($3::text = '' OR u.department_id = $3)
		GROUP BY u.department_id, d.full_name, d.short_name
	`, fyStartYM, fyEndYM, scope.DepartmentID)
	if err != nil {
		return plan, fmt.Errorf("query fiscal year spending: %w", err)
	}
	defer sRows.Close()

	maxFYActualYM := 0
	for sRows.Next() {
		var dID, dName, dShort string
		var paid, pend float64
		var mCnt, maxYM int
		if sRows.Scan(&dID, &dName, &dShort, &paid, &pend, &mCnt, &maxYM) == nil {
			d := getDept(dID, dName, dShort)
			d.ytdPaid += paid
			d.ytdPending += pend
			d.ytdSpent += paid + pend
			d.fyMonths = mCnt
			d.maxFYYM = maxYM
			if maxYM > maxFYActualYM {
				maxFYActualYM = maxYM
			}
			plan.YTDPaid += paid
			plan.YTDPending += pend
			plan.YTDSpent += paid + pend
		}
	}

	plan.AllocatedAmount = round2(plan.AllocatedAmount)
	plan.TransferredAmount = round2(plan.TransferredAmount)
	plan.YTDPaid = round2(plan.YTDPaid)
	plan.YTDPending = round2(plan.YTDPending)
	plan.YTDSpent = round2(plan.YTDSpent)

	// Calculate elapsed/remaining fiscal months relative to max(nowYM, maxFYActualYM)
	refYM := now.Year()*12 + int(now.Month())
	if maxFYActualYM > refYM && maxFYActualYM <= fyEndYM {
		refYM = maxFYActualYM
	}
	if refYM < fyStartYM {
		plan.MonthsElapsed = 0
		plan.MonthsRemaining = 12
	} else if refYM >= fyEndYM {
		plan.MonthsElapsed = 12
		plan.MonthsRemaining = 0
	} else {
		plan.MonthsElapsed = refYM - fyStartYM + 1
		plan.MonthsRemaining = fyEndYM - refYM
	}

	// Project remaining months using time-series forecast when available, else YTD monthly burn rate
	avgYTDBurn := 0.0
	if plan.MonthsElapsed > 0 {
		avgYTDBurn = plan.YTDSpent / float64(plan.MonthsElapsed)
	} else if ts12.HistoricalAvgMonthly > 0 {
		avgYTDBurn = ts12.HistoricalAvgMonthly
	}
	projectedRem := 0.0
	remStartYM := fyStartYM + plan.MonthsElapsed
	for ym := remStartYM; ym <= fyEndYM; ym++ {
		if fVal, ok := ts12.FutureByYM[ym]; ok && fVal > 0 {
			projectedRem += fVal
		} else if aVal, ok := ts12.ActualByYM[ym]; ok && aVal > 0 {
			projectedRem += aVal
		} else if ts12.NextMonthPredicted > 0 && avgYTDBurn > 0 {
			projectedRem += 0.5*avgYTDBurn + 0.5*ts12.NextMonthPredicted
		} else {
			projectedRem += avgYTDBurn
		}
	}

	plan.ProjectedRemainingSpend = round2(projectedRem)
	plan.ProjectedTotalSpend = round2(plan.YTDSpent + projectedRem)
	plan.ProjectedBalance = round2(plan.NetBudget - plan.ProjectedTotalSpend)
	if plan.NetBudget > 0 {
		plan.UtilizationPct = round1((plan.YTDSpent / plan.NetBudget) * 100)
		plan.ProjectedUtilizationPct = round1((plan.ProjectedTotalSpend / plan.NetBudget) * 100)
	}
	if needed := plan.ProjectedTotalSpend*1.05 - plan.NetBudget; needed > 0 {
		plan.RecommendedAdditional = round2(needed)
	}
	plan.Status = classifyBudgetStatus(plan.NetBudget, plan.YTDSpent, plan.ProjectedTotalSpend, plan.ProjectedUtilizationPct)

	// Per-department budget plans (priority shortfall risks + surplus reallocation candidates)
	deptPlans := make([]DepartmentBudgetPlanItem, 0, len(deptMap))
	for _, d := range deptMap {
		net := round2(d.allocated + d.transferred)
		burnMonths := plan.MonthsElapsed
		if d.fyMonths > burnMonths {
			burnMonths = d.fyMonths
		}
		if burnMonths <= 0 {
			burnMonths = 1
		}
		deptBurn := d.ytdSpent / float64(burnMonths)
		deptProj := round2(d.ytdSpent + deptBurn*float64(plan.MonthsRemaining))
		if d.ytdSpent == 0 && net > 0 && plan.MonthsRemaining == 12 {
			deptProj = 0
		}
		projBal := round2(net - deptProj)
		projPct := 0.0
		if net > 0 {
			projPct = round1((deptProj / net) * 100)
		} else if deptProj > 0 {
			projPct = 100
		}
		adj := 0.0
		if deficit := deptProj*1.05 - net; deficit > 0 {
			adj = round2(deficit) // positive: additional needed
		} else if surplus := net - deptProj*1.15; surplus > 500 {
			adj = -round2(surplus) // negative: transferable surplus
		}
		deptPlans = append(deptPlans, DepartmentBudgetPlanItem{
			DepartmentID:            d.deptID,
			DepartmentName:          d.deptName,
			DepartmentShortName:     d.shortName,
			AllocatedAmount:         round2(d.allocated),
			TransferredAmount:       round2(d.transferred),
			NetBudget:               net,
			YTDSpent:                round2(d.ytdSpent),
			ProjectedTotalSpend:     deptProj,
			ProjectedBalance:        projBal,
			ProjectedUtilizationPct: projPct,
			RecommendedAdjustment:   adj,
			Status:                  classifyBudgetStatus(net, d.ytdSpent, deptProj, projPct),
		})
	}

	priorityRank := map[string]int{
		"DEFICIT":   0,
		"NO_BUDGET": 1,
		"RISK":      2,
		"WATCH":     3,
		"HEALTHY":   4,
	}
	sort.SliceStable(deptPlans, func(i, j int) bool {
		ri, rj := priorityRank[deptPlans[i].Status], priorityRank[deptPlans[j].Status]
		if ri != rj {
			return ri < rj
		}
		if deptPlans[i].ProjectedUtilizationPct != deptPlans[j].ProjectedUtilizationPct {
			return deptPlans[i].ProjectedUtilizationPct > deptPlans[j].ProjectedUtilizationPct
		}
		return deptPlans[i].YTDSpent > deptPlans[j].YTDSpent
	})
	if len(deptPlans) > 15 {
		deptPlans = deptPlans[:15]
	}
	plan.DepartmentPlans = deptPlans
	return plan, nil
}

func isApproachingUpperAnomaly(projectedNext float64, stat service.StatisticalAnomalyResult) bool {
	if stat.IsAnomaly && projectedNext > stat.Mean {
		return true
	}
	if stat.UpperFence > 0 && projectedNext >= stat.UpperFence*0.90 && projectedNext > stat.Mean*1.12 {
		return true
	}
	if stat.Mean > 0 && stat.StdDev > 0 && projectedNext >= stat.Mean+1.5*stat.StdDev && (projectedNext-stat.Mean)/stat.Mean >= 0.15 {
		return true
	}
	return false
}

// buildAlertPredictions predicts upcoming anomalies (expense spikes, budget exhaustion, repeat delays, unrecorded meters).
func (s *ForecastService) buildAlertPredictions(ctx context.Context, scope UserScope, now time.Time, latestActualYM, fyCE int) ([]AlertPredictionItem, error) {
	if s.pool == nil {
		return []AlertPredictionItem{}, nil
	}

	type deptRiskAcc struct {
		deptID       string
		deptName     string
		shortName    string
		primaryUtil  string
		score        int
		categories   map[string]struct{}
		reasons      []string
		actions      []string
		topTitle     string
		topTitlePrio int
		predAmt      float64
		baseAmt      float64
		budgetPct    float64
		incidents    int
	}
	accMap := make(map[string]*deptRiskAcc)
	getAcc := func(id, name, short string) *deptRiskAcc {
		if a, ok := accMap[id]; ok {
			return a
		}
		a := &deptRiskAcc{
			deptID:     id,
			deptName:   name,
			shortName:  short,
			categories: make(map[string]struct{}),
		}
		accMap[id] = a
		return a
	}

	// Signal 1: Recent bill trajectory vs statistical Z-score / IQR upper fence per (department, utility)
	refYM := latestActualYM
	if refYM <= 0 {
		refYM = now.Year()*12 + int(now.Month())
	}
	minWindowYM := refYM - 11

	tRows, err := s.pool.Query(ctx, `
		SELECT
			b.department_id,
			COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			COALESCE(d.short_name, ''),
			b.utility_type,
			((CASE WHEN b.billing_year > 2400 THEN b.billing_year - 543 ELSE b.billing_year END) * 12 + b.billing_month) AS ym,
			COALESCE(SUM(CASE WHEN b.payment_status = 'PAID' THEN COALESCE(b.paid_amount, b.invoice_amount, 0) ELSE COALESCE(b.invoice_amount, b.estimated_amount, 0) END), 0)::float8 AS amt
		FROM utility_bills b
		LEFT JOIN departments d ON b.department_id = d.id
		WHERE b.billing_month BETWEEN 1 AND 12
		  AND b.billing_year > 0
		  AND ((CASE WHEN b.billing_year > 2400 THEN b.billing_year - 543 ELSE b.billing_year END) * 12 + b.billing_month) BETWEEN $1 AND $2
		  AND ($3::text = '' OR b.department_id = $3)
		GROUP BY b.department_id, d.full_name, d.short_name, b.utility_type, ym
		ORDER BY b.department_id, b.utility_type, ym ASC
	`, minWindowYM, refYM, scope.DepartmentID)
	if err == nil {
		defer tRows.Close()
		type duKey struct {
			deptID string
			util   string
		}
		type duSeries struct {
			deptName  string
			shortName string
			pts       []struct {
				ym  int
				amt float64
			}
		}
		duMap := make(map[duKey]*duSeries)
		for tRows.Next() {
			var dID, dName, dShort, util string
			var ym int
			var amt float64
			if tRows.Scan(&dID, &dName, &dShort, &util, &ym, &amt) == nil && amt > 0 {
				k := duKey{deptID: dID, util: NormalizeUtilityType(util)}
				ds, ok := duMap[k]
				if !ok {
					ds = &duSeries{deptName: dName, shortName: dShort}
					duMap[k] = ds
				}
				ds.pts = append(ds.pts, struct {
					ym  int
					amt float64
				}{ym: ym, amt: amt})
			}
		}

		for k, ds := range duMap {
			if len(ds.pts) < 3 {
				continue
			}
			histOnly := make([]float64, 0, len(ds.pts)-1)
			for i := 0; i < len(ds.pts)-1; i++ {
				histOnly = append(histOnly, ds.pts[i].amt)
			}
			latest := ds.pts[len(ds.pts)-1].amt
			prev := ds.pts[len(ds.pts)-2].amt
			// Simple one-step projection: blend latest + momentum
			mom := latest - prev
			projectedNext := latest + 0.5*mom
			if projectedNext < 0 {
				projectedNext = latest
			}
			stat := service.DetectStatisticalAnomaly(projectedNext, histOnly)
			if isApproachingUpperAnomaly(projectedNext, stat) {
				acc := getAcc(k.deptID, ds.deptName, ds.shortName)
				ptsScore := 32
				if stat.IsAnomaly {
					ptsScore = 48
				}
				acc.score += ptsScore
				acc.categories["EXPENSE_SPIKE"] = struct{}{}
				if acc.primaryUtil == "" || projectedNext > acc.predAmt {
					acc.primaryUtil = k.util
					acc.predAmt = round2(projectedNext)
					acc.baseAmt = round2(stat.Mean)
				}
				if 3 > acc.topTitlePrio {
					acc.topTitlePrio = 3
					acc.topTitle = fmt.Sprintf("แนวโน้ม%sพุ่งใกล้เกณฑ์ผิดปกติ", k.util)
				}
				acc.reasons = append(acc.reasons, fmt.Sprintf("%sคาดการณ์เดือนหน้า ฿%.0f เทียบฐานเฉลี่ย ฿%.0f", k.util, projectedNext, stat.Mean))
				acc.actions = append(acc.actions, fmt.Sprintf("ตรวจสอบมิเตอร์และรอบการใช้งาน%sของหน่วยงานก่อนออกบิล", k.util))
			}
		}
	}

	// Signal 2: Recurring audit incidents in recent 6 months (late payment/receive, phone over limit, overdue)
	aRows, err := s.pool.Query(ctx, `
		SELECT
			b.department_id,
			COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			COALESCE(d.short_name, ''),
			COUNT(*) FILTER (WHERE COALESCE(a.is_late_payment, false) OR COALESCE(a.is_late_receive, false) OR COALESCE(a.is_overdue_more_than_2_months, false) OR COALESCE(a.is_disbursement_over_2_months, false))::int AS late_cnt,
			COUNT(*) FILTER (WHERE COALESCE(a.is_phone_over_limit, false) OR COALESCE(a.is_phone_usage_over_limit, false))::int AS phone_cnt,
			COUNT(*) FILTER (WHERE COALESCE(a.is_anomaly_expense, false) OR COALESCE(a.is_manual_anomaly, false))::int AS exp_cnt
		FROM audits a
		JOIN utility_bills b ON a.utility_bill_id = b.id
		LEFT JOIN departments d ON b.department_id = d.id
		WHERE ((CASE WHEN b.billing_year > 2400 THEN b.billing_year - 543 ELSE b.billing_year END) * 12 + b.billing_month) >= $1
		  AND ($2::text = '' OR b.department_id = $2)
		GROUP BY b.department_id, d.full_name, d.short_name
		HAVING COUNT(*) FILTER (WHERE
			COALESCE(a.is_late_payment, false) OR COALESCE(a.is_late_receive, false) OR
			COALESCE(a.is_overdue_more_than_2_months, false) OR COALESCE(a.is_disbursement_over_2_months, false) OR
			COALESCE(a.is_phone_over_limit, false) OR COALESCE(a.is_phone_usage_over_limit, false) OR
			COALESCE(a.is_anomaly_expense, false) OR COALESCE(a.is_manual_anomaly, false)
		) >= 2
	`, refYM-5, scope.DepartmentID)
	if err == nil {
		defer aRows.Close()
		for aRows.Next() {
			var dID, dName, dShort string
			var lateCnt, phoneCnt, expCnt int
			if aRows.Scan(&dID, &dName, &dShort, &lateCnt, &phoneCnt, &expCnt) == nil {
				totalInc := lateCnt + phoneCnt + expCnt
				acc := getAcc(dID, dName, dShort)
				acc.incidents += totalInc
				addScore := totalInc * 9
				if addScore > 40 {
					addScore = 40
				}
				acc.score += addScore
				if lateCnt >= 2 {
					acc.categories["RECURRING_LATE_PAYMENT"] = struct{}{}
					acc.reasons = append(acc.reasons, fmt.Sprintf("พบประวัติรับบิล/เบิกจ่ายล่าช้าซ้ำ %d ครั้งใน 6 เดือน", lateCnt))
					acc.actions = append(acc.actions, "ตั้งเตือนรับใบแจ้งหนี้และส่งเบิกจ่ายภายใน 15 วันหลังรับเรื่อง")
					if 2 > acc.topTitlePrio {
						acc.topTitlePrio = 2
						acc.topTitle = "เสี่ยงเกิดความล่าช้าในการรับบิลและเบิกจ่ายซ้ำ"
					}
				}
				if phoneCnt >= 1 {
					acc.categories["PHONE_LIMIT_RISK"] = struct{}{}
					if acc.primaryUtil == "" {
						acc.primaryUtil = "ค่าโทรศัพท์"
					}
					acc.reasons = append(acc.reasons, fmt.Sprintf("ค่าโทรศัพท์เกินเกณฑ์/สิทธิ์เบิก %d ครั้งในช่วงที่ผ่านมา", phoneCnt))
					acc.actions = append(acc.actions, "แจ้งผู้รับผิดชอบหมายเลขโทรศัพท์ควบคุมยอดใช้ให้ไม่เกินสิทธิ์")
					if 2 > acc.topTitlePrio {
						acc.topTitlePrio = 2
						acc.topTitle = "เสี่ยงค่าโทรศัพท์เกินวงเงินสิทธิ์เบิก"
					}
				}
				if expCnt >= 2 {
					acc.categories["REPEAT_EXPENSE_ANOMALY"] = struct{}{}
					acc.reasons = append(acc.reasons, fmt.Sprintf("พบความผิดปกติยอดค่าใช้จ่าย %d ครั้งใน 6 เดือน", expCnt))
				}
			}
		}
	}

	// Signal 3: Active meters/services without a recorded bill in the latest active billing period
	targetCheckYM := refYM
	checkM, checkY := ymToMonthYear(targetCheckYM)
	uRows, err := s.pool.Query(ctx, `
		SELECT
			s.department_id,
			COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			COALESCE(d.short_name, ''),
			COUNT(*)::int AS unrecorded_cnt
		FROM department_services s
		JOIN departments d ON s.department_id = d.id
		WHERE s.is_active = true
		  AND ($3::text = '' OR s.department_id = $3)
		  AND NOT EXISTS (
			SELECT 1 FROM utility_bills b
			WHERE b.department_id = s.department_id
			  AND b.utility_type = s.utility_type
			  AND b.service_number = s.service_number
			  AND b.billing_month = $1
			  AND (CASE WHEN b.billing_year > 2400 THEN b.billing_year - 543 ELSE b.billing_year END) = $2
		  )
		GROUP BY s.department_id, d.full_name, d.short_name
		HAVING COUNT(*) >= 1
		ORDER BY unrecorded_cnt DESC
		LIMIT 20
	`, checkM, checkY, scope.DepartmentID)
	if err == nil {
		defer uRows.Close()
		for uRows.Next() {
			var dID, dName, dShort string
			var cnt int
			if uRows.Scan(&dID, &dName, &dShort, &cnt) == nil {
				acc := getAcc(dID, dName, dShort)
				addScore := 18 + cnt*4
				if addScore > 32 {
					addScore = 32
				}
				acc.score += addScore
				acc.categories["UNRECORDED_SERVICE"] = struct{}{}
				acc.reasons = append(acc.reasons, fmt.Sprintf("ยังมี %d หมายเลข/มิเตอร์ที่เปิดใช้งานแต่ยังไม่บันทึกบิลรอบ%s %d", cnt, thaiMonthNames[checkM], checkY+543))
				acc.actions = append(acc.actions, "ติดตามเร่งบันทึกบิลหรือระบุยอดประมาณการสำหรับหมายเลขที่ค้างส่ง")
				if 1 > acc.topTitlePrio {
					acc.topTitlePrio = 1
					acc.topTitle = "เสี่ยงบิลตกค้าง / ยังไม่บันทึกเข้าระบบ"
				}
			}
		}
	}

	// Signal 4: Budget overrun / near-exhaustion in target fiscal year
	if fyCE <= 0 {
		fyCE = ThaiFiscalYearCE(int(now.Month()), now.Year())
	}
	fyBE := fyCE + 543
	fyStartYM := (fyCE-1)*12 + 10
	fyEndYM := fyCE*12 + 9
	budRows, err := s.pool.Query(ctx, `
		WITH b_sum AS (
			SELECT department_id, COALESCE(SUM(allocated_amount + transferred_amount), 0)::float8 AS net_budget
			FROM budgets
			WHERE fiscal_year IN ($1, $2)
			  AND ($5::text = '' OR department_id = $5)
			GROUP BY department_id
		),
		s_sum AS (
			SELECT department_id, COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN COALESCE(paid_amount, invoice_amount, 0) ELSE COALESCE(invoice_amount, estimated_amount, 0) END), 0)::float8 AS spent
			FROM utility_bills
			WHERE billing_year > 0 AND billing_month BETWEEN 1 AND 12
			  AND ((CASE WHEN billing_year > 2400 THEN billing_year - 543 ELSE billing_year END) * 12 + billing_month) BETWEEN $3 AND $4
			  AND ($5::text = '' OR department_id = $5)
			GROUP BY department_id
		)
		SELECT
			b_sum.department_id,
			COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			COALESCE(d.short_name, ''),
			b_sum.net_budget,
			COALESCE(s_sum.spent, 0)::float8
		FROM b_sum
		LEFT JOIN s_sum ON b_sum.department_id = s_sum.department_id
		LEFT JOIN departments d ON b_sum.department_id = d.id
		WHERE b_sum.net_budget > 0 AND COALESCE(s_sum.spent, 0) >= 0.85 * b_sum.net_budget
	`, fyCE, fyBE, fyStartYM, fyEndYM, scope.DepartmentID)
	if err == nil {
		defer budRows.Close()
		for budRows.Next() {
			var dID, dName, dShort string
			var netBud, spent float64
			if budRows.Scan(&dID, &dName, &dShort, &netBud, &spent) == nil {
				pct := round1((spent / netBud) * 100)
				acc := getAcc(dID, dName, dShort)
				acc.budgetPct = pct
				if pct >= 100 {
					acc.score += 45
					acc.topTitlePrio = 4
					acc.topTitle = "เสี่ยงงบประมาณเกินวงเงินที่ได้รับจัดสรร"
				} else {
					acc.score += 30
					if 4 > acc.topTitlePrio {
						acc.topTitlePrio = 4
						acc.topTitle = "งบประมาณใกล้หมด (ใช้ไปเกิน 85%)"
					}
				}
				acc.categories["BUDGET_OVERRUN"] = struct{}{}
				acc.reasons = append(acc.reasons, fmt.Sprintf("ใช้งบประมาณไปแล้ว %.1f%% (฿%.0f / ฿%.0f)", pct, spent, netBud))
				acc.actions = append(acc.actions, "เตรียมขอโอนเปลี่ยนแปลงงบประมาณหรือจัดสรรงบเพิ่มเติมก่อนสิ้นปีงบประมาณ")
			}
		}
	}

	alerts := make([]AlertPredictionItem, 0, len(accMap))
	for _, acc := range accMap {
		score := acc.score
		if score > 100 {
			score = 100
		}
		if score < 20 {
			continue
		}
		sev := "LOW"
		if score >= 70 {
			sev = "HIGH"
		} else if score >= 40 {
			sev = "MEDIUM"
		}

		cats := make([]string, 0, len(acc.categories))
		for c := range acc.categories {
			cats = append(cats, c)
		}
		sort.Strings(cats)

		utilLabel := acc.primaryUtil
		if utilLabel == "" {
			utilLabel = "ทุกหมวดสาธารณูปโภค"
		}
		title := acc.topTitle
		if title == "" {
			title = "เฝ้าระวังความคลาดเคลื่อนรอบบิลถัดไป"
		}

		alerts = append(alerts, AlertPredictionItem{
			DepartmentID:         acc.deptID,
			DepartmentName:       acc.deptName,
			DepartmentShortName:  acc.shortName,
			UtilityType:          utilLabel,
			RiskScore:            score,
			Severity:             sev,
			RiskCategories:       cats,
			Title:                title,
			Reason:               strings.Join(acc.reasons, " • "),
			RecommendedAction:    uniqueFirstAction(acc.actions),
			PredictedAmount:      acc.predAmt,
			BaselineAmount:       acc.baseAmt,
			BudgetUtilizationPct: acc.budgetPct,
			RecentIncidentCount:  acc.incidents,
		})
	}

	sort.SliceStable(alerts, func(i, j int) bool {
		if alerts[i].RiskScore != alerts[j].RiskScore {
			return alerts[i].RiskScore > alerts[j].RiskScore
		}
		return alerts[i].DepartmentName < alerts[j].DepartmentName
	})
	if len(alerts) > 15 {
		alerts = alerts[:15]
	}
	return alerts, nil
}

func uniqueFirstAction(actions []string) string {
	for _, a := range actions {
		if t := strings.TrimSpace(a); t != "" {
			return t
		}
	}
	return "ติดตามตรวจสอบความถูกต้องของบิลและงบประมาณในรอบถัดไป"
}

func (s *ForecastService) loadCachedInsights(ctx context.Context, cacheKey string) *ForecastAIInsights {
	if s.cache != nil {
		if raw, err := s.cache.Get(ctx, cacheKey); err == nil && len(raw) > 0 {
			var ins ForecastAIInsights
			if json.Unmarshal(raw, &ins) == nil && ins.HasInsights {
				if ins.GeneratedAt != nil && s.now().Sub(*ins.GeneratedAt) < forecastCacheTTL {
					if ins.BudgetRecommendations == nil {
						ins.BudgetRecommendations = []string{}
					}
					if ins.PreventiveActions == nil {
						ins.PreventiveActions = []string{}
					}
					return &ins
				}
			}
		}
	}

	if s.pool != nil {
		var raw []byte
		err := s.pool.QueryRow(ctx, `SELECT value FROM system_settings WHERE key = $1`, cacheKey).Scan(&raw)
		if err == nil && len(raw) > 0 {
			var ins ForecastAIInsights
			if json.Unmarshal(raw, &ins) == nil && ins.HasInsights {
				if ins.GeneratedAt != nil && s.now().Sub(*ins.GeneratedAt) < forecastCacheTTL {
					if ins.BudgetRecommendations == nil {
						ins.BudgetRecommendations = []string{}
					}
					if ins.PreventiveActions == nil {
						ins.PreventiveActions = []string{}
					}
					if s.cache != nil {
						_ = s.cache.Set(ctx, cacheKey, raw, time.Until(ins.GeneratedAt.Add(forecastCacheTTL)))
					}
					return &ins
				}
			}
		}
	}
	return nil
}

func (s *ForecastService) saveCachedInsights(ctx context.Context, cacheKey string, ins *ForecastAIInsights) {
	if ins == nil {
		return
	}
	raw, err := json.Marshal(ins)
	if err != nil {
		return
	}
	if s.cache != nil {
		_ = s.cache.Set(ctx, cacheKey, raw, forecastCacheTTL)
	}
	if s.pool != nil {
		_, _ = s.pool.Exec(ctx, `
			INSERT INTO system_settings (key, value, updated_at)
			VALUES ($1, $2::jsonb, NOW())
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`, cacheKey, string(raw))
	}
}
