package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/dof/ums-backend/internal/service"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrAIConfigMissing   = errors.New("ระบบ AI ยังไม่พร้อมใช้งาน เนื่องจากยังไม่ได้กำหนดค่า GEMINI_API_KEY ในไฟล์ .env ของ Backend")
	ErrUnauthorizedScope = errors.New("คุณไม่มีสิทธิ์ดูหรือวิเคราะห์ข้อมูลของหน่วยงานอื่น")
	ErrBillNotFound      = errors.New("ไม่พบข้อมูลรายการบิลที่ต้องการวิเคราะห์")
)

const (
	summaryCacheFreshness = 12 * time.Hour
	summaryCacheTTL       = 24 * time.Hour
	explainCacheTTL       = 6 * time.Hour
)

// CacheStore matches cache.HybridCache cleanly without introducing a circular dependency.
type CacheStore interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
}

type MonthlySummaryMetrics struct {
	TotalBills         int     `json:"totalBills"`
	PaidBills          int     `json:"paidBills"`
	PaidAmount         float64 `json:"paidAmount"`
	PendingBills       int     `json:"pendingBills"`
	PendingAmount      float64 `json:"pendingAmount"`
	CombinedTotal      float64 `json:"combinedTotal"`
	PrevMonthTotal     float64 `json:"prevMonthTotal"`
	MoMChangePct       float64 `json:"moMChangePct"`
	TotalAnomalies     int     `json:"totalAnomalies"`
	UnrecordedServices int     `json:"unrecordedServices"`
	RecordedServices   int     `json:"recordedServices"`
}

type MonthlySummary struct {
	HasSummary      bool                  `json:"hasSummary"`
	Scope           string                `json:"scope"` // "all" or "department"
	DepartmentID    string                `json:"departmentId,omitempty"`
	DepartmentName  string                `json:"departmentName"`
	BillingMonth    int                   `json:"billingMonth"`
	BillingYearCE   int                   `json:"billingYearCE"`
	BillingYearBE   int                   `json:"billingYearBE"`
	PeriodLabel     string                `json:"periodLabel"`
	Headline        string                `json:"headline"`
	KeyPoints       []string              `json:"keyPoints"`
	Recommendations []string              `json:"recommendations"`
	Metrics         MonthlySummaryMetrics `json:"metrics"`
	Model           string                `json:"model"`
	Source          string                `json:"source"` // "cache", "worker", "live", "none"
	Cached          bool                  `json:"cached"`
	GeneratedAt     *time.Time            `json:"generatedAt,omitempty"`
}

type AnomalyExplanation struct {
	BillID         string                            `json:"billId"`
	BillCode       string                            `json:"billCode"`
	DepartmentName string                            `json:"departmentName"`
	UtilityType    string                            `json:"utilityType"`
	BillingMonth   int                               `json:"billingMonth"`
	BillingYearBE  int                               `json:"billingYearBE"`
	ServiceNumber  string                            `json:"serviceNumber"`
	InvoiceAmount  float64                           `json:"invoiceAmount"`
	Severity       string                            `json:"severity"` // "HIGH", "MEDIUM", "LOW"
	Flags          []string                          `json:"flags"`
	Summary        string                            `json:"summary"`
	Reasons        []string                          `json:"reasons"`
	ActionItems    []string                          `json:"actionItems"`
	Stats          *service.StatisticalAnomalyResult `json:"stats,omitempty"`
	History        []service.BillHistoricalSample    `json:"history,omitempty"`
	Model          string                            `json:"model"`
	Cached         bool                              `json:"cached"`
	GeneratedAt    time.Time                         `json:"generatedAt"`
}

// SummaryService builds and caches Phase 2 AI summaries and per-bill anomaly explanations.
type SummaryService struct {
	client *Client
	tools  *ToolExecutor
	pool   *pgxpool.Pool
	cache  CacheStore
	now    func() time.Time
}

func NewSummaryService(client *Client, tools *ToolExecutor, pool *pgxpool.Pool, cacheStore CacheStore) *SummaryService {
	if tools == nil && pool != nil {
		tools = NewToolExecutor(pool)
	}
	return &SummaryService{
		client: client,
		tools:  tools,
		pool:   pool,
		cache:  cacheStore,
		now:    time.Now,
	}
}

func (s *SummaryService) IsConfigured() bool {
	return s != nil && s.client != nil && s.client.IsConfigured()
}

func (s *SummaryService) Model() string {
	if s == nil || s.client == nil {
		return "gemini-3.5-flash"
	}
	return s.client.Model()
}

// BuildSummaryCacheKey builds a deterministic cache key always <= 64 characters for system_settings.key.
func BuildSummaryCacheKey(scope UserScope, month, yearCE int) string {
	target := "all"
	if scope.DepartmentID != "" {
		sum := sha256.Sum256([]byte(scope.DepartmentID))
		target = "d_" + hex.EncodeToString(sum[:8])
	}
	return fmt.Sprintf("ai_sum:%s:%04d-%02d", target, yearCE, month)
}

func (s *SummaryService) resolvePeriod(month, year int) (int, int) {
	now := s.now()
	m := month
	if m < 1 || m > 12 {
		m = int(now.Month())
	}
	y := NormalizeBillingYearCE(year, now)
	return m, y
}

func (s *SummaryService) normalizeScopeForQuery(ctx context.Context, scope UserScope) UserScope {
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

// GetMonthlySummary retrieves cached summary when force=false, or gathers live DB stats and synthesizes a new AI summary when force=true.
func (s *SummaryService) GetMonthlySummary(ctx context.Context, scope UserScope, month, year int, force bool, triggerSource string) (*MonthlySummary, error) {
	scope = s.normalizeScopeForQuery(ctx, scope)
	m, y := s.resolvePeriod(month, year)
	cacheKey := BuildSummaryCacheKey(scope, m, y)

	if !force {
		if cached := s.loadCachedSummary(ctx, cacheKey); cached != nil {
			cached.Cached = true
			if cached.Source == "" {
				cached.Source = "cache"
			}
			return cached, nil
		}

		// Return fast DB KPI snapshot without blocking on Gemini
		metrics := s.collectMetricsSnapshot(ctx, scope, m, y)
		scopeStr := "all"
		if scope.DepartmentID != "" {
			scopeStr = "department"
		}
		return &MonthlySummary{
			HasSummary:      false,
			Scope:           scopeStr,
			DepartmentID:    scope.DepartmentID,
			DepartmentName:  scope.DepartmentName,
			BillingMonth:    m,
			BillingYearCE:   y,
			BillingYearBE:   y + 543,
			PeriodLabel:     fmt.Sprintf("เดือน%s พ.ศ. %d", thaiMonthNames[m], y+543),
			KeyPoints:       []string{},
			Recommendations: []string{},
			Metrics:         metrics,
			Model:           s.Model(),
			Source:          "none",
			Cached:          false,
		}, nil
	}

	if !s.IsConfigured() {
		return nil, ErrAIConfigMissing
	}

	// Ensure sufficient timeout within HTTP / proxy bounds
	aiCtx, cancel := context.WithTimeout(ctx, 50*time.Second)
	defer cancel()

	bundle, metrics := s.collectFullSummaryDataset(aiCtx, scope, m, y)

	type geminiSummaryPayload struct {
		Headline        string   `json:"headline"`
		KeyPoints       []string `json:"keyPoints"`
		Recommendations []string `json:"recommendations"`
	}

	rawJSON, _ := json.Marshal(bundle)
	systemPrompt := `คุณคือนักวิเคราะห์งบประมาณและผู้ตรวจสอบระบบรายงานค่าสาธารณูปโภค กรมประมง
จงวิเคราะห์ข้อมูลจริงใน JSON ที่ได้รับ แล้วสรุปผลและข้อเสนอแนะเชิงปฏิบัติเป็นภาษาไทยในรูปแบบ JSON เท่านั้น:
{
  "headline": "ประโยคสรุปภาพรวมสำคัญ 1 ประโยคที่กระชับและระบุตัวเลขสำคัญ",
  "keyPoints": ["ประเด็นสำคัญข้อ 1 (พร้อมตัวเลข/หน่วยบาท หรือ %)", "ประเด็นข้อ 2", "ประเด็นข้อ 3"],
  "recommendations": ["คำแนะนำเชิงปฏิบัติที่ทำได้ทันทีข้อ 1", "คำแนะนำข้อ 2", "คำแนะนำข้อ 3"]
}
ข้อกำหนด:
- ใช้ตัวเลขจากข้อมูลจริงเท่านั้น ห้ามเดาหรือสร้างตัวเลขใหม่
- ใช้ปี พ.ศ. เสมอ คั่นหลักพันด้วยจุลภาค
- keyPoints 2-4 ข้อ, recommendations 2-4 ข้อ กระชับ อ่านง่าย`

	userPrompt := fmt.Sprintf("ข้อมูลสถิติประจำ%s (%s):\n%s",
		fmt.Sprintf("เดือน%s พ.ศ. %d", thaiMonthNames[m], y+543),
		scope.DepartmentName,
		string(rawJSON),
	)

	temp := 0.2
	resp, err := s.client.GenerateContent(aiCtx, GenerateContentRequest{
		SystemInstruction: &Content{Parts: []Part{{Text: systemPrompt}}},
		Contents:          []Content{{Role: "user", Parts: []Part{{Text: userPrompt}}}},
		GenerationConfig: &GenerationConfig{
			Temperature:      &temp,
			MaxOutputTokens:  4096,
			ResponseMIMEType: "application/json",
		},
	})
	if err != nil {
		return nil, err
	}

	parsed, err := decodeGeminiCandidate[geminiSummaryPayload](resp)
	if err != nil {
		return nil, fmt.Errorf("ไม่สามารถอ่านผลสรุปจาก AI: %w", err)
	}

	now := s.now().UTC()
	scopeStr := "all"
	if scope.DepartmentID != "" {
		scopeStr = "department"
	}
	if triggerSource == "" {
		triggerSource = "live"
	}

	out := &MonthlySummary{
		HasSummary:      true,
		Scope:           scopeStr,
		DepartmentID:    scope.DepartmentID,
		DepartmentName:  scope.DepartmentName,
		BillingMonth:    m,
		BillingYearCE:   y,
		BillingYearBE:   y + 543,
		PeriodLabel:     fmt.Sprintf("เดือน%s พ.ศ. %d", thaiMonthNames[m], y+543),
		Headline:        strings.TrimSpace(parsed.Headline),
		KeyPoints:       nonEmptyStrings(parsed.KeyPoints),
		Recommendations: nonEmptyStrings(parsed.Recommendations),
		Metrics:         metrics,
		Model:           s.Model(),
		Source:          triggerSource,
		Cached:          false,
		GeneratedAt:     &now,
	}
	if out.Headline == "" && len(out.KeyPoints) > 0 {
		out.Headline = out.KeyPoints[0]
	}

	s.saveCachedSummary(ctx, cacheKey, out)
	return out, nil
}

// IsSummaryFresh reports whether a fresh (< 12h) summary already exists for this scope/period.
func (s *SummaryService) IsSummaryFresh(ctx context.Context, scope UserScope, month, year int) bool {
	scope = s.normalizeScopeForQuery(ctx, scope)
	m, y := s.resolvePeriod(month, year)
	cached := s.loadCachedSummary(ctx, BuildSummaryCacheKey(scope, m, y))
	if cached == nil || !cached.HasSummary || cached.GeneratedAt == nil {
		return false
	}
	return s.now().Sub(*cached.GeneratedAt) < summaryCacheFreshness
}

func (s *SummaryService) loadCachedSummary(ctx context.Context, cacheKey string) *MonthlySummary {
	if s.cache != nil {
		if raw, err := s.cache.Get(ctx, cacheKey); err == nil && len(raw) > 0 {
			var sum MonthlySummary
			if json.Unmarshal(raw, &sum) == nil && sum.HasSummary {
				if sum.GeneratedAt != nil && s.now().Sub(*sum.GeneratedAt) < summaryCacheTTL {
					if sum.KeyPoints == nil {
						sum.KeyPoints = []string{}
					}
					if sum.Recommendations == nil {
						sum.Recommendations = []string{}
					}
					return &sum
				}
			}
		}
	}

	if s.pool != nil {
		var raw []byte
		err := s.pool.QueryRow(ctx, `SELECT value FROM system_settings WHERE key = $1`, cacheKey).Scan(&raw)
		if err == nil && len(raw) > 0 {
			var sum MonthlySummary
			if json.Unmarshal(raw, &sum) == nil && sum.HasSummary {
				if sum.GeneratedAt != nil && s.now().Sub(*sum.GeneratedAt) < summaryCacheTTL {
					if sum.KeyPoints == nil {
						sum.KeyPoints = []string{}
					}
					if sum.Recommendations == nil {
						sum.Recommendations = []string{}
					}
					if s.cache != nil {
						_ = s.cache.Set(ctx, cacheKey, raw, time.Until(sum.GeneratedAt.Add(summaryCacheTTL)))
					}
					return &sum
				}
			}
		}
	}

	return nil
}

func (s *SummaryService) saveCachedSummary(ctx context.Context, cacheKey string, sum *MonthlySummary) {
	if sum == nil {
		return
	}
	raw, err := json.Marshal(sum)
	if err != nil {
		return
	}
	if s.cache != nil {
		_ = s.cache.Set(ctx, cacheKey, raw, summaryCacheTTL)
	}
	if s.pool != nil {
		_, _ = s.pool.Exec(ctx, `
			INSERT INTO system_settings (key, value, updated_at)
			VALUES ($1, $2::jsonb, NOW())
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`, cacheKey, string(raw))
	}
}

func (s *SummaryService) makeToolScope(scope UserScope) UserScope {
	if scope.DepartmentID != "" {
		return UserScope{
			UserID:         scope.UserID,
			Role:           scope.Role,
			IsAdmin:        false,
			DepartmentID:   scope.DepartmentID,
			DepartmentName: scope.DepartmentName,
		}
	}
	return UserScope{
		UserID:         scope.UserID,
		Role:           scope.Role,
		IsAdmin:        true,
		DepartmentName: scope.DepartmentName,
	}
}

func (s *SummaryService) collectMetricsSnapshot(ctx context.Context, scope UserScope, month, yearCE int) MonthlySummaryMetrics {
	if s.tools == nil || s.pool == nil {
		return MonthlySummaryMetrics{}
	}
	toolScope := s.makeToolScope(scope)

	curMap, _ := s.tools.Execute(ctx, toolScope, "get_utility_summary", map[string]any{"month": month, "year": yearCE})
	prevM, prevY := prevMonthYear(month, yearCE)
	prevMap, _ := s.tools.Execute(ctx, toolScope, "get_utility_summary", map[string]any{"month": prevM, "year": prevY})
	anomMap, _ := s.tools.Execute(ctx, toolScope, "get_anomalies", map[string]any{"month": month, "year": yearCE, "only_unreviewed": true, "limit": 5})
	unrecMap, _ := s.tools.Execute(ctx, toolScope, "get_unrecorded_services", map[string]any{"month": month, "year": yearCE, "limit": 5})

	curTotal := mapFloat(curMap, "combinedTotal")
	prevTotal := mapFloat(prevMap, "combinedTotal")
	momPct := 0.0
	if prevTotal > 0 {
		momPct = math.Round(((curTotal-prevTotal)/prevTotal)*1000) / 10
	}

	return MonthlySummaryMetrics{
		TotalBills:         mapInt(curMap, "totalBills"),
		PaidBills:          mapInt(curMap, "paidBills"),
		PaidAmount:         mapFloat(curMap, "paidAmount"),
		PendingBills:       mapInt(curMap, "pendingBills"),
		PendingAmount:      mapFloat(curMap, "pendingAmount"),
		CombinedTotal:      curTotal,
		PrevMonthTotal:     prevTotal,
		MoMChangePct:       momPct,
		TotalAnomalies:     mapInt(anomMap, "totalAnomalies"),
		UnrecordedServices: mapInt(unrecMap, "unrecordedCount"),
		RecordedServices:   mapInt(unrecMap, "recordedCount"),
	}
}

func (s *SummaryService) collectFullSummaryDataset(ctx context.Context, scope UserScope, month, yearCE int) (map[string]any, MonthlySummaryMetrics) {
	if s.tools == nil || s.pool == nil {
		return map[string]any{}, MonthlySummaryMetrics{}
	}
	toolScope := s.makeToolScope(scope)

	curMap, _ := s.tools.Execute(ctx, toolScope, "get_utility_summary", map[string]any{"month": month, "year": yearCE})
	prevM, prevY := prevMonthYear(month, yearCE)
	prevMap, _ := s.tools.Execute(ctx, toolScope, "get_utility_summary", map[string]any{"month": prevM, "year": prevY})
	pendingMap, _ := s.tools.Execute(ctx, toolScope, "get_pending_bills", map[string]any{"limit": 5})
	anomMap, _ := s.tools.Execute(ctx, toolScope, "get_anomalies", map[string]any{"month": 0, "year": 0, "only_unreviewed": true, "limit": 8})
	anomPeriodMap, _ := s.tools.Execute(ctx, toolScope, "get_anomalies", map[string]any{"month": month, "year": yearCE, "only_unreviewed": true, "limit": 5})
	unrecMap, _ := s.tools.Execute(ctx, toolScope, "get_unrecorded_services", map[string]any{"month": month, "year": yearCE, "limit": 8})
	budgetMap, _ := s.tools.Execute(ctx, toolScope, "get_budget_overview", map[string]any{})

	curTotal := mapFloat(curMap, "combinedTotal")
	prevTotal := mapFloat(prevMap, "combinedTotal")
	momPct := 0.0
	if prevTotal > 0 {
		momPct = math.Round(((curTotal-prevTotal)/prevTotal)*1000) / 10
	}

	metrics := MonthlySummaryMetrics{
		TotalBills:         mapInt(curMap, "totalBills"),
		PaidBills:          mapInt(curMap, "paidBills"),
		PaidAmount:         mapFloat(curMap, "paidAmount"),
		PendingBills:       mapInt(curMap, "pendingBills"),
		PendingAmount:      mapFloat(curMap, "pendingAmount"),
		CombinedTotal:      curTotal,
		PrevMonthTotal:     prevTotal,
		MoMChangePct:       momPct,
		TotalAnomalies:     mapInt(anomPeriodMap, "totalAnomalies"),
		UnrecordedServices: mapInt(unrecMap, "unrecordedCount"),
		RecordedServices:   mapInt(unrecMap, "recordedCount"),
	}

	bundle := map[string]any{
		"currentMonthSummary":  curMap,
		"previousMonthSummary": prevMap,
		"momChangePct":         momPct,
		"pendingCumulative":    pendingMap,
		"unreviewedAnomalies":  anomMap,
		"unrecordedServices":   unrecMap,
		"budgetOverview":       budgetMap,
	}
	return bundle, metrics
}

// ExplainAnomaly explains why a utility bill/audit was flagged using statistical Z-score/IQR evidence + Gemini Thai synthesis.
func (s *SummaryService) ExplainAnomaly(ctx context.Context, scope UserScope, billID string, force bool) (*AnomalyExplanation, error) {
	if s.pool == nil {
		return nil, ErrBillNotFound
	}

	var (
		billCode, deptID, deptName, utilType string
		depositUnitID                        *string
		billingMonth, billingYear            int
		serviceNumber, invoiceNumber         *string
		invoiceDate, receivedDate            *time.Time
		sentDisbDate, paymentDate            *time.Time
		invoiceAmount, paidAmount            *float64
		paymentStatus, invoiceStatus         string
		auditStatus, remarks                 *string
		manualReason, manualDetail           *string
		auditUpdatedAt                       *time.Time
		fLateRec, fLatePay, fOver2M, fDisb2M bool
		fWrongM, fPhoneLim, fPhoneUsage      bool
		fWrongBud, fDup, fAnomalyExp         bool
		fManual                              bool
	)

	err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(b.bill_code, b.id), b.department_id, COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			b.utility_type, b.deposit_unit_id, b.billing_month, b.billing_year,
			b.service_number, b.invoice_number, b.invoice_date, b.received_date,
			b.sent_to_disbursing_date, b.payment_date, b.invoice_amount, b.paid_amount,
			COALESCE(b.payment_status, 'PENDING'), COALESCE(b.invoice_status, 'RECEIVED'),
			a.status, a.remarks, a.manual_anomaly_reason, a.manual_anomaly_detail, a.updated_at,
			COALESCE(a.is_late_receive, false), COALESCE(a.is_late_payment, false),
			COALESCE(a.is_overdue_more_than_2_months, false), COALESCE(a.is_disbursement_over_2_months, false),
			COALESCE(a.is_wrong_month, false), COALESCE(a.is_phone_over_limit, false),
			COALESCE(a.is_phone_usage_over_limit, false), COALESCE(a.is_wrong_budget, false),
			COALESCE(a.is_duplicate, false), COALESCE(a.is_anomaly_expense, false),
			COALESCE(a.is_manual_anomaly, false)
		FROM utility_bills b
		LEFT JOIN departments d ON b.department_id = d.id
		LEFT JOIN audits a ON b.id = a.utility_bill_id
		WHERE b.id = $1
		LIMIT 1
	`, billID).Scan(
		&billCode, &deptID, &deptName, &utilType, &depositUnitID,
		&billingMonth, &billingYear, &serviceNumber, &invoiceNumber,
		&invoiceDate, &receivedDate, &sentDisbDate, &paymentDate,
		&invoiceAmount, &paidAmount, &paymentStatus, &invoiceStatus,
		&auditStatus, &remarks, &manualReason, &manualDetail, &auditUpdatedAt,
		&fLateRec, &fLatePay, &fOver2M, &fDisb2M,
		&fWrongM, &fPhoneLim, &fPhoneUsage, &fWrongBud, &fDup, &fAnomalyExp, &fManual,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBillNotFound
		}
		return nil, fmt.Errorf("fetch bill for explanation: %w", err)
	}

	// Enforce department RBAC strictly
	if !scope.IsAdmin {
		isDepositUnit := depositUnitID != nil && *depositUnitID == scope.DepartmentID
		if deptID != scope.DepartmentID && !isDepositUnit {
			return nil, ErrUnauthorizedScope
		}
	}

	var updatedUnix int64
	if auditUpdatedAt != nil {
		updatedUnix = auditUpdatedAt.Unix()
	}
	cacheKey := fmt.Sprintf("ai_exp:%s:%d", billID, updatedUnix)

	if !force && s.cache != nil {
		if raw, err := s.cache.Get(ctx, cacheKey); err == nil && len(raw) > 0 {
			var cachedExp AnomalyExplanation
			if json.Unmarshal(raw, &cachedExp) == nil && cachedExp.Summary != "" {
				cachedExp.Cached = true
				return &cachedExp, nil
			}
		}
	}

	if !s.IsConfigured() {
		return nil, ErrAIConfigMissing
	}

	var flags []string
	if fLateRec {
		flags = append(flags, "ลงรับใบแจ้งหนี้ล่าช้า (> 30 วัน)")
	}
	if fLatePay {
		flags = append(flags, "เบิกจ่ายล่าช้า (> 15 วัน)")
	}
	if fOver2M {
		flags = append(flags, "ค้างชำระเกิน 2 เดือน")
	}
	if fDisb2M {
		flags = append(flags, "เบิกจ่ายนานเกิน 2 เดือน")
	}
	if fWrongM {
		flags = append(flags, "เบิกจ่ายผิดเดือน / ผิดปีงบประมาณ")
	}
	if fPhoneUsage {
		flags = append(flags, "ใช้ค่าโทรศัพท์เกินสิทธิ์")
	}
	if fPhoneLim {
		flags = append(flags, "เบิกค่าโทรศัพท์เกินเกณฑ์")
	}
	if fWrongBud {
		flags = append(flags, "รหัสงบประมาณไม่สอดคล้อง")
	}
	if fDup {
		flags = append(flags, "เลขที่ใบแจ้งหนี้ซ้ำซ้อน")
	}
	if fAnomalyExp {
		flags = append(flags, "ค่าใช้จ่ายสูง/ต่ำผิดปกติทางสถิติ")
	}
	if fManual {
		if manualReason != nil && strings.TrimSpace(*manualReason) != "" {
			flags = append(flags, "ผู้ตรวจสอบระบุ: "+strings.TrimSpace(*manualReason))
		} else {
			flags = append(flags, "ผู้ตรวจสอบระบุข้อสังเกตด้วยตนเอง")
		}
	}

	amt := 0.0
	if invoiceAmount != nil && *invoiceAmount > 0 {
		amt = *invoiceAmount
	} else if paidAmount != nil && *paidAmount > 0 {
		amt = *paidAmount
	}

	srvStr := ""
	if serviceNumber != nil {
		srvStr = *serviceNumber
	}

	yearBE := billingYear
	if yearBE < 2400 {
		yearBE += 543
	}

	statRes, history, _ := service.ComputeBillStatisticalAnomaly(ctx, s.pool, billID)

	dayDeltas := map[string]any{}
	if invoiceDate != nil && receivedDate != nil {
		dayDeltas["daysFromInvoiceToReceive"] = int(receivedDate.Sub(*invoiceDate).Hours() / 24)
	}
	if receivedDate != nil && paymentDate != nil {
		dayDeltas["daysFromReceiveToPayment"] = int(paymentDate.Sub(*receivedDate).Hours() / 24)
	}
	if sentDisbDate != nil && paymentDate != nil {
		dayDeltas["daysFromDisbursingToPayment"] = int(paymentDate.Sub(*sentDisbDate).Hours() / 24)
	}

	evidence := map[string]any{
		"billCode":       billCode,
		"departmentName": deptName,
		"utilityType":    utilType,
		"billingMonth":   billingMonth,
		"billingYearBE":  yearBE,
		"serviceNumber":  srvStr,
		"invoiceAmount":  amt,
		"paymentStatus":  paymentStatus,
		"invoiceStatus":  invoiceStatus,
		"flags":          flags,
		"dayDeltas":      dayDeltas,
		"manualReason":   manualReason,
		"manualDetail":   manualDetail,
		"auditStatus":    auditStatus,
		"remarks":        remarks,
		"statisticalAnalysis": map[string]any{
			"sampleCount":         statRes.SampleCount,
			"method":              statRes.Method,
			"mean":                statRes.Mean,
			"median":              statRes.Median,
			"stdDev":              statRes.StdDev,
			"q1":                  statRes.Q1,
			"q3":                  statRes.Q3,
			"iqr":                 statRes.IQR,
			"lowerFence":          statRes.LowerFence,
			"upperFence":          statRes.UpperFence,
			"zScore":              statRes.ZScore,
			"pctDiffFromBaseline": statRes.PctDiffFromBaseline,
		},
		"recentHistory": history,
	}

	evidenceJSON, _ := json.Marshal(evidence)

	aiCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	type geminiExplainPayload struct {
		Severity    string   `json:"severity"`
		Summary     string   `json:"summary"`
		Reasons     []string `json:"reasons"`
		ActionItems []string `json:"actionItems"`
	}

	sysPrompt := `คุณคือผู้ตรวจสอบภายในอัจฉริยะของกรมประมง (ระบบค่าสาธารณูปโภค UMS)
จงอธิบายสาเหตุที่รายการบิลนี้ถูกตรวจพบความคลาดเคลื่อน และเสนอแนวทางแก้ไขเป็นภาษาไทยที่ชัดเจนสำหรับเจ้าหน้าที่/ผู้ตรวจสอบ โดยตอบเป็น JSON เท่านั้น:
{
  "severity": "HIGH หรือ MEDIUM หรือ LOW",
  "summary": "สรุปสั้น 1-2 ประโยค ว่าเกิดอะไรขึ้นกับบิลนี้และรุนแรงระดับใด",
  "reasons": ["อธิบายสาเหตุข้อที่ 1 อ้างอิงตัวเลขสถิติ/จำนวนวันจริง เช่น Z-score, ค่าเฉลี่ยย้อนหลัง, หรือเกณฑ์ที่ผิด", "..."],
  "actionItems": ["ขั้นตอนตรวจสอบ/แก้ไขที่เจ้าหน้าที่ควรทำข้อ 1", "..."]
}
ข้อกำหนด: อ้างอิงเฉพาะข้อมูลในหลักฐาน JSON เท่านั้น ห้ามคาดเดาเลขที่ไม่มีในข้อมูล`

	temp := 0.2
	resp, err := s.client.GenerateContent(aiCtx, GenerateContentRequest{
		SystemInstruction: &Content{Parts: []Part{{Text: sysPrompt}}},
		Contents: []Content{{
			Role:  "user",
			Parts: []Part{{Text: "หลักฐานการตรวจสอบบิล:\n" + string(evidenceJSON)}},
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

	parsed, err := decodeGeminiCandidate[geminiExplainPayload](resp)
	if err != nil {
		return nil, fmt.Errorf("ไม่สามารถอ่านคำอธิบายจาก AI: %w", err)
	}

	sev := strings.ToUpper(strings.TrimSpace(parsed.Severity))
	if sev != "HIGH" && sev != "MEDIUM" && sev != "LOW" {
		if len(flags) >= 2 || statRes.IsAnomaly {
			sev = "HIGH"
		} else if len(flags) == 1 {
			sev = "MEDIUM"
		} else {
			sev = "LOW"
		}
	}

	var statsPtr *service.StatisticalAnomalyResult
	if statRes.SampleCount > 0 {
		copyStat := statRes
		statsPtr = &copyStat
	}
	if flags == nil {
		flags = []string{}
	}

	out := &AnomalyExplanation{
		BillID:         billID,
		BillCode:       billCode,
		DepartmentName: deptName,
		UtilityType:    utilType,
		BillingMonth:   billingMonth,
		BillingYearBE:  yearBE,
		ServiceNumber:  srvStr,
		InvoiceAmount:  amt,
		Severity:       sev,
		Flags:          flags,
		Summary:        strings.TrimSpace(parsed.Summary),
		Reasons:        nonEmptyStrings(parsed.Reasons),
		ActionItems:    nonEmptyStrings(parsed.ActionItems),
		Stats:          statsPtr,
		History:        history,
		Model:          s.Model(),
		Cached:         false,
		GeneratedAt:    s.now().UTC(),
	}

	if s.cache != nil {
		if raw, mErr := json.Marshal(out); mErr == nil {
			_ = s.cache.Set(ctx, cacheKey, raw, explainCacheTTL)
		}
	}

	return out, nil
}

func extractCandidateText(resp *GenerateContentResponse) string {
	if resp == nil || len(resp.Candidates) == 0 {
		return ""
	}
	var parts []string
	for _, p := range resp.Candidates[0].Content.Parts {
		if !p.Thought && strings.TrimSpace(p.Text) != "" {
			parts = append(parts, p.Text)
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func decodeGeminiCandidate[T any](resp *GenerateContentResponse) (*T, error) {
	raw := extractCandidateText(resp)
	if raw == "" {
		if resp != nil && len(resp.Candidates) > 0 && resp.Candidates[0].FinishReason != "" {
			return nil, fmt.Errorf("empty AI response (finishReason=%s)", resp.Candidates[0].FinishReason)
		}
		return nil, fmt.Errorf("empty AI response")
	}
	parsed, err := decodeGeminiStructured[T](raw)
	if err != nil && resp != nil && len(resp.Candidates) > 0 && resp.Candidates[0].FinishReason == "MAX_TOKENS" {
		return nil, fmt.Errorf("AI output truncated at max tokens: %w", err)
	}
	return parsed, err
}

func decodeGeminiStructured[T any](raw string) (*T, error) {
	cleaned := strings.TrimSpace(raw)
	if cleaned == "" {
		return nil, fmt.Errorf("empty AI response")
	}
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	// Extract JSON object bounds if extra surrounding prose leaked in
	if start := strings.IndexByte(cleaned, '{'); start >= 0 {
		if end := strings.LastIndexByte(cleaned, '}'); end > start {
			cleaned = cleaned[start : end+1]
		}
	}

	var val T
	if err := json.Unmarshal([]byte(cleaned), &val); err != nil {
		return nil, err
	}
	return &val, nil
}

func nonEmptyStrings(in []string) []string {
	out := make([]string, 0, len(in))
	for _, s := range in {
		if t := strings.TrimSpace(s); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func prevMonthYear(month, year int) (int, int) {
	if month <= 1 {
		return 12, year - 1
	}
	return month - 1, year
}

func mapFloat(m map[string]any, key string) float64 {
	if m == nil {
		return 0
	}
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}

func mapInt(m map[string]any, key string) int {
	return int(mapFloat(m, key))
}

