package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// UserScope defines the authenticated caller's role and department boundaries.
// Every database tool enforces this scope directly in Go before returning results.
type UserScope struct {
	UserID         string
	Role           string
	IsAdmin        bool
	DepartmentID   string
	DepartmentName string
	Channel        string // "web", "line", etc.
}

// ToolExecutor runs safe, read-only database tools on behalf of the Gemini model.
type ToolExecutor struct {
	pool     *pgxpool.Pool
	now      func() time.Time
	forecast *ForecastService
	search   *SearchService
}

func NewToolExecutor(pool *pgxpool.Pool) *ToolExecutor {
	return &ToolExecutor{
		pool: pool,
		now:  time.Now,
	}
}

func (e *ToolExecutor) SetForecastService(f *ForecastService) {
	e.forecast = f
}

func (e *ToolExecutor) SetSearchService(s *SearchService) {
	e.search = s
}

// Declarations returns the Gemini FunctionDeclarations exposed to the model.
func (e *ToolExecutor) Declarations() []FunctionDeclaration {
	return []FunctionDeclaration{
		{
			Name:        "get_utility_summary",
			Description: "สรุปภาพรวมจำนวนบิล ค่าใช้จ่ายที่เบิกจ่ายแล้ว ยอดค้างชำระ และแยกตามประเภทสาธารณูปโภค (ค่าไฟฟ้า, ค่าประปา&น้ำบาดาล, ค่าโทรศัพท์, ค่าสื่อสาร&โทรคมนาคม, ค่าบริการไปรษณีย์) สามารถกรองตามเดือน ปี และชื่อหน่วยงานได้",
			Parameters: &SchemaObject{
				Type: "OBJECT",
				Properties: map[string]SchemaProperty{
					"month": {
						Type:        "INTEGER",
						Description: "เลขเดือน (1-12) เช่น 10 สำหรับตุลาคม หากต้องการดูรวมทั้งปีให้ส่ง 0",
					},
					"year": {
						Type:        "INTEGER",
						Description: "ปี พ.ศ. หรือ ค.ศ. เช่น 2569 หรือ 2026 หากไม่ระบุจะใช้ปีปัจจุบัน",
					},
					"department_name": {
						Type:        "STRING",
						Description: "ชื่อเต็มหรือชื่อย่อของหน่วยงาน (เฉพาะผู้ใช้สิทธิ์ส่วนกลาง/admin)",
					},
					"utility_type": {
						Type:        "STRING",
						Description: "ประเภทสาธารณูปโภค เช่น ค่าไฟฟ้า, ค่าประปา&น้ำบาดาล, ค่าโทรศัพท์, ค่าสื่อสาร&โทรคมนาคม, ค่าบริการไปรษณีย์",
					},
				},
			},
		},
		{
			Name:        "get_pending_bills",
			Description: "ดูยอดค้างชำระสะสมทั้งหมด หน่วยงานที่ค้างชำระสูงสุด และรายการบิลที่ยังไม่ได้เบิกจ่าย (PENDING)",
			Parameters: &SchemaObject{
				Type: "OBJECT",
				Properties: map[string]SchemaProperty{
					"department_name": {
						Type:        "STRING",
						Description: "ชื่อเต็มหรือชื่อย่อของหน่วยงาน (เฉพาะผู้ใช้สิทธิ์ส่วนกลาง/admin)",
					},
					"utility_type": {
						Type:        "STRING",
						Description: "กรองตามประเภทสาธารณูปโภค (ไม่บังคับ)",
					},
					"limit": {
						Type:        "INTEGER",
						Description: "จำนวนรายการสูงสุดที่ต้องการดึง (ค่าเริ่มต้น 10 สูงสุด 20)",
					},
				},
			},
		},
		{
			Name:        "get_anomalies",
			Description: "ตรวจสอบรายการบิลที่พบความคลาดเคลื่อนหรือความผิดปกติ (เช่น รับบิลช้า, จ่ายช้า, ค้างเกิน 2 เดือน, โทรศัพท์เกินวงเงิน, ยอดสูงผิดปกติ, บิลซ้ำ, หรือผู้ตรวจสอบปักธง) สามารถค้นหาเจาะจงตามรหัสบิลหรือเลขมิเตอร์ได้",
			Parameters: &SchemaObject{
				Type: "OBJECT",
				Properties: map[string]SchemaProperty{
					"bill_code": {
						Type:        "STRING",
						Description: "รหัสบิล (เช่น BILL-...) หรือหมายเลขผู้ใช้บริการ/เลขมิเตอร์ เพื่อค้นหาหรือเจาะจงเฉพาะบิลนั้น",
					},
					"month": {
						Type:        "INTEGER",
						Description: "เลขเดือน (1-12) หรือ 0 เพื่อดูทั้งหมด",
					},
					"year": {
						Type:        "INTEGER",
						Description: "ปี พ.ศ. หรือ ค.ศ. หรือ 0 เพื่อดูทั้งหมด",
					},
					"department_name": {
						Type:        "STRING",
						Description: "ชื่อเต็มหรือชื่อย่อของหน่วยงาน (เฉพาะผู้ใช้สิทธิ์ส่วนกลาง/admin)",
					},
					"only_unreviewed": {
						Type:        "BOOLEAN",
						Description: "ดูเฉพาะรายการที่ยังไม่ได้รับรอง/แก้ไข (ค่าเริ่มต้น true)",
					},
					"limit": {
						Type:        "INTEGER",
						Description: "จำนวนรายการสูงสุดที่ต้องการดึง (ค่าเริ่มต้น 10 สูงสุด 20)",
					},
				},
			},
		},
		{
			Name:        "get_monthly_trend",
			Description: "ดูแนวโน้มและเปรียบเทียบค่าใช้จ่ายสาธารณูปโภครายเดือนย้อนหลัง (1-12 เดือน) เพื่อใช้วิเคราะห์ความเปลี่ยนแปลงเทียบเดือนก่อนหน้า",
			Parameters: &SchemaObject{
				Type: "OBJECT",
				Properties: map[string]SchemaProperty{
					"months": {
						Type:        "INTEGER",
						Description: "จำนวนเดือนย้อนหลัง (1-12 ค่าเริ่มต้น 6)",
					},
					"department_name": {
						Type:        "STRING",
						Description: "ชื่อเต็มหรือชื่อย่อของหน่วยงาน (เฉพาะผู้ใช้สิทธิ์ส่วนกลาง/admin)",
					},
					"utility_type": {
						Type:        "STRING",
						Description: "กรองเฉพาะประเภทสาธารณูปโภค (ไม่บังคับ)",
					},
				},
			},
		},
		{
			Name:        "get_unrecorded_services",
			Description: "ตรวจสอบสถานะการบันทึกบิลตามรหัสเครื่องวัด/หมายเลขผู้ใช้ที่เปิดใช้งาน ว่ารายการใดบันทึกแล้วและรายการใดยังไม่ได้บันทึกเข้าระบบในเดือนที่ระบุ",
			Parameters: &SchemaObject{
				Type: "OBJECT",
				Properties: map[string]SchemaProperty{
					"month": {
						Type:        "INTEGER",
						Description: "เลขเดือน (1-12) หากไม่ระบุจะใช้เดือนปัจจุบัน",
					},
					"year": {
						Type:        "INTEGER",
						Description: "ปี พ.ศ. หรือ ค.ศ. หากไม่ระบุจะใช้ปีปัจจุบัน",
					},
					"department_name": {
						Type:        "STRING",
						Description: "ชื่อเต็มหรือชื่อย่อของหน่วยงาน (เฉพาะผู้ใช้สิทธิ์ส่วนกลาง/admin)",
					},
					"limit": {
						Type:        "INTEGER",
						Description: "จำนวนตัวอย่างหมายเลขที่ยังไม่บันทึก (ค่าเริ่มต้น 15 สูงสุด 25)",
					},
				},
			},
		},
		{
			Name:        "get_budget_overview",
			Description: "สรุปข้อมูลวงเงินงบประมาณที่ได้รับจัดสรรและเงินโอนเปลี่ยนแปลงประจำปีงบประมาณ (พ.ศ.)",
			Parameters: &SchemaObject{
				Type: "OBJECT",
				Properties: map[string]SchemaProperty{
					"fiscal_year": {
						Type:        "INTEGER",
						Description: "ปีงบประมาณ (พ.ศ. เช่น 2569 หรือ ค.ศ. 2026) หากไม่ระบุจะใช้ปีงบประมาณปัจจุบัน",
					},
					"department_name": {
						Type:        "STRING",
						Description: "ชื่อเต็มหรือชื่อย่อของหน่วยงาน (เฉพาะผู้ใช้สิทธิ์ส่วนกลาง/admin)",
					},
				},
			},
		},
		{
			Name:        "get_utility_forecast",
			Description: "พยากรณ์แนวโน้มค่าสาธารณูปโภคและงบประมาณล่วงหน้า (1-6 เดือนข้างหน้า) ด้วยโมเดลสถิติ Time Series Seasonal Decomposition พร้อมประเมินความเพียงพอของงบประมาณและแจ้งเตือนความเสี่ยง",
			Parameters: &SchemaObject{
				Type: "OBJECT",
				Properties: map[string]SchemaProperty{
					"months_ahead": {
						Type:        "INTEGER",
						Description: "จำนวนเดือนที่ต้องการพยากรณ์ล่วงหน้า (1-6 เดือน ค่าเริ่มต้น 3)",
					},
					"department_name": {
						Type:        "STRING",
						Description: "ชื่อเต็มหรือชื่อย่อของหน่วยงาน (เฉพาะผู้ใช้สิทธิ์ส่วนกลาง/admin)",
					},
					"fiscal_year": {
						Type:        "INTEGER",
						Description: "ปีงบประมาณ พ.ศ. (เช่น 2569) หรือ ค.ศ. (ค่าเริ่มต้นคือปีงบประมาณปัจจุบัน)",
					},
				},
			},
		},
		{
			Name:        "search_bills_and_departments",
			Description: "ค้นหาข้อมูลบิลค่าสาธารณูปโภค หน่วยงาน หรือรหัสเครื่องวัด/มิเตอร์อย่างละเอียด ด้วยการค้นหาแบบ Semantic และคำสำคัญ (เช่น เลขที่ใบแจ้งหนี้, เลขมิเตอร์, ชื่อย่อหน่วยงาน, จังหวัด หรือสถานะ)",
			Parameters: &SchemaObject{
				Type:     "OBJECT",
				Required: []string{"query"},
				Properties: map[string]SchemaProperty{
					"query": {
						Type:        "STRING",
						Description: "คำค้นหา เช่น เลขมิเตอร์ 02001..., เลขที่ใบแจ้งหนี้, ชื่อย่อหน่วยงาน ศพช.สงขลา, ค่าน้ำเชียงใหม่, บิลค้างชำระกระบี่",
					},
					"entity_type": {
						Type:        "STRING",
						Description: "ประเภทข้อมูลที่ต้องการค้นหา: 'all' (ทั้งหมด), 'bills' (เฉพาะบิล), 'departments' (เฉพาะหน่วยงาน) ค่าเริ่มต้น 'all'",
					},
					"limit": {
						Type:        "INTEGER",
						Description: "จำนวนผลลัพธ์สูงสุดที่ต้องการดึง (ค่าเริ่มต้น 5 สูงสุด 15)",
					},
				},
			},
		},
	}
}

// Execute runs the named tool with the given JSON-decoded arguments and returns a JSON-object map for Gemini functionResponse.
func (e *ToolExecutor) Execute(ctx context.Context, scope UserScope, name string, args map[string]any) (map[string]any, error) {
	if e.pool == nil {
		return map[string]any{"error": "ฐานข้อมูลไม่พร้อมใช้งานในขณะนี้"}, nil
	}

	var result any
	var err error

	switch name {
	case "get_utility_summary":
		result, err = e.getUtilitySummary(ctx, scope, args)
	case "get_pending_bills":
		result, err = e.getPendingBills(ctx, scope, args)
	case "get_anomalies":
		result, err = e.getAnomalies(ctx, scope, args)
	case "get_monthly_trend":
		result, err = e.getMonthlyTrend(ctx, scope, args)
	case "get_unrecorded_services":
		result, err = e.getUnrecordedServices(ctx, scope, args)
	case "get_budget_overview":
		result, err = e.getBudgetOverview(ctx, scope, args)
	case "get_utility_forecast":
		result, err = e.getUtilityForecast(ctx, scope, args)
	case "search_bills_and_departments":
		result, err = e.searchBillsAndDepartments(ctx, scope, args)
	default:
		return map[string]any{"error": fmt.Sprintf("unknown tool: %s", name)}, nil
	}

	if err != nil {
		return map[string]any{"error": err.Error()}, nil
	}

	// Ensure result is converted to map[string]any for Gemini functionResponse
	raw, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return map[string]any{"result": result}, nil
	}
	return out, nil
}

// NormalizeBillingYearCE converts Thai Buddhist Era years (>=2400) to Christian Era for utility_bills queries.
func NormalizeBillingYearCE(year int, now time.Time) int {
	if year <= 0 {
		return now.Year()
	}
	if year >= 2400 {
		return year - 543
	}
	return year
}

// NormalizeFiscalYearBE converts Christian Era years (<2400) to Buddhist Era for budgets queries.
func NormalizeFiscalYearBE(year int, now time.Time) int {
	if year <= 0 {
		be := now.Year() + 543
		if int(now.Month()) >= 10 {
			be++
		}
		return be
	}
	if year < 2400 {
		return year + 543
	}
	return year
}

func NormalizeUtilityType(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	switch {
	case strings.Contains(s, "ไฟ"):
		return "ค่าไฟฟ้า"
	case strings.Contains(s, "ประปา") || strings.Contains(s, "น้ำ"):
		return "ค่าประปา&น้ำบาดาล"
	case strings.Contains(s, "โทรศัพท์"):
		return "ค่าโทรศัพท์"
	case strings.Contains(s, "สื่อสาร") || strings.Contains(s, "โทรคมนาคม") || strings.Contains(s, "อินเทอร์เน็ต"):
		return "ค่าสื่อสาร&โทรคมนาคม"
	case strings.Contains(s, "ไปรษณีย์"):
		return "ค่าบริการไปรษณีย์"
	default:
		return s
	}
}

func argInt(args map[string]any, key string, def int) int {
	if args == nil {
		return def
	}
	v, ok := args[key]
	if !ok || v == nil {
		return def
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	default:
		return def
	}
}

func argString(args map[string]any, key string) string {
	if args == nil {
		return ""
	}
	v, ok := args[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(s)
}

func argBool(args map[string]any, key string, def bool) bool {
	if args == nil {
		return def
	}
	v, ok := args[key]
	if !ok || v == nil {
		return def
	}
	b, ok := v.(bool)
	if !ok {
		return def
	}
	return b
}

func clampInt(val, minVal, maxVal int) int {
	if val < minVal {
		return minVal
	}
	if val > maxVal {
		return maxVal
	}
	return val
}

func (e *ToolExecutor) resolveDeptScope(ctx context.Context, scope UserScope, requestedDept string) (deptID string, scopeLabel string, errResult map[string]any) {
	if !scope.IsAdmin {
		if scope.DepartmentID == "" {
			return "", "", map[string]any{
				"access_denied": true,
				"message":       "บัญชีของคุณยังไม่ได้ผูกกับหน่วยงานใดในระบบ กรุณาติดต่อผู้ดูแลระบบ",
			}
		}
		if requestedDept != "" {
			// Check if requestedDept matches caller's own department
			var matchedID string
			err := e.pool.QueryRow(ctx, `
				SELECT id FROM departments
				WHERE id = $1 AND (full_name ILIKE $2 OR COALESCE(short_name, '') ILIKE $2)
			`, scope.DepartmentID, "%"+requestedDept+"%").Scan(&matchedID)
			if err != nil {
				return "", "", map[string]any{
					"access_denied": true,
					"message":       fmt.Sprintf("คุณไม่มีสิทธิ์ดูข้อมูลของ '%s' สามารถสอบถามได้เฉพาะข้อมูลของ '%s' เท่านั้น", requestedDept, scope.DepartmentName),
				}
			}
		}
		label := scope.DepartmentName
		if label == "" {
			_ = e.pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", scope.DepartmentID).Scan(&label)
		}
		return scope.DepartmentID, label, nil
	}

	if requestedDept == "" {
		return "", "ภาพรวมทั้งกรม (ทุกหน่วยงาน)", nil
	}

	var id, fullName string
	err := e.pool.QueryRow(ctx, `
		SELECT id, full_name
		FROM departments
		WHERE full_name ILIKE $1 OR COALESCE(short_name, '') ILIKE $1
		ORDER BY CASE WHEN COALESCE(short_name, '') ILIKE $2 THEN 0 ELSE 1 END, length(full_name) ASC
		LIMIT 1
	`, "%"+requestedDept+"%", requestedDept).Scan(&id, &fullName)
	if err != nil {
		return "", "", map[string]any{
			"not_found": true,
			"message":   fmt.Sprintf("ไม่พบหน่วยงานที่ตรงกับคำค้น '%s'", requestedDept),
		}
	}
	return id, fullName, nil
}

func (e *ToolExecutor) getUtilitySummary(ctx context.Context, scope UserScope, args map[string]any) (any, error) {
	requestedDept := argString(args, "department_name")
	deptID, scopeLabel, errResp := e.resolveDeptScope(ctx, scope, requestedDept)
	if errResp != nil {
		return errResp, nil
	}

	now := e.now()
	month := argInt(args, "month", int(now.Month()))
	yearCE := NormalizeBillingYearCE(argInt(args, "year", 0), now)
	utilType := NormalizeUtilityType(argString(args, "utility_type"))

	where := []string{"billing_year = $1"}
	qArgs := []any{yearCE}
	argIdx := 2

	if month >= 1 && month <= 12 {
		where = append(where, fmt.Sprintf("billing_month = $%d", argIdx))
		qArgs = append(qArgs, month)
		argIdx++
	}
	if deptID != "" {
		where = append(where, fmt.Sprintf("department_id = $%d", argIdx))
		qArgs = append(qArgs, deptID)
		argIdx++
	}
	if utilType != "" {
		where = append(where, fmt.Sprintf("utility_type = $%d", argIdx))
		qArgs = append(qArgs, utilType)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	type breakdownRow struct {
		UtilityType   string  `json:"utilityType"`
		TotalBills    int     `json:"totalBills"`
		PaidBills     int     `json:"paidBills"`
		PaidAmount    float64 `json:"paidAmount"`
		PendingBills  int     `json:"pendingBills"`
		PendingAmount float64 `json:"pendingAmount"`
	}

	query := fmt.Sprintf(`
		SELECT
			utility_type,
			COUNT(*)::int,
			COUNT(*) FILTER (WHERE payment_status = 'PAID')::int,
			COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN COALESCE(paid_amount, 0) ELSE 0 END), 0)::float8,
			COUNT(*) FILTER (WHERE payment_status = 'PENDING')::int,
			COALESCE(SUM(CASE WHEN payment_status = 'PENDING' THEN COALESCE(invoice_amount, estimated_amount, 0) ELSE 0 END), 0)::float8
		FROM utility_bills
		WHERE %s
		GROUP BY utility_type
		ORDER BY (COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN COALESCE(paid_amount, 0) ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN payment_status = 'PENDING' THEN COALESCE(invoice_amount, estimated_amount, 0) ELSE 0 END), 0)) DESC
	`, whereClause)

	rows, err := e.pool.Query(ctx, query, qArgs...)
	if err != nil {
		return nil, fmt.Errorf("query utility summary: %w", err)
	}
	defer rows.Close()

	var breakdowns []breakdownRow
	var totalBills, paidBills, pendingBills int
	var paidAmount, pendingAmount float64

	for rows.Next() {
		var r breakdownRow
		if scanErr := rows.Scan(&r.UtilityType, &r.TotalBills, &r.PaidBills, &r.PaidAmount, &r.PendingBills, &r.PendingAmount); scanErr == nil {
			breakdowns = append(breakdowns, r)
			totalBills += r.TotalBills
			paidBills += r.PaidBills
			paidAmount += r.PaidAmount
			pendingBills += r.PendingBills
			pendingAmount += r.PendingAmount
		}
	}

	periodLabel := fmt.Sprintf("ทั้งปี พ.ศ. %d", yearCE+543)
	if month >= 1 && month <= 12 {
		periodLabel = fmt.Sprintf("เดือน%s พ.ศ. %d", thaiMonthNames[month], yearCE+543)
	}

	return map[string]any{
		"scope":           scopeLabel,
		"period":          periodLabel,
		"billingYearCE":   yearCE,
		"billingYearBE":   yearCE + 543,
		"totalBills":      totalBills,
		"paidBills":       paidBills,
		"paidAmount":      paidAmount,
		"pendingBills":    pendingBills,
		"pendingAmount":   pendingAmount,
		"combinedTotal":   paidAmount + pendingAmount,
		"byUtilityType":   breakdowns,
	}, nil
}

func (e *ToolExecutor) getPendingBills(ctx context.Context, scope UserScope, args map[string]any) (any, error) {
	requestedDept := argString(args, "department_name")
	deptID, scopeLabel, errResp := e.resolveDeptScope(ctx, scope, requestedDept)
	if errResp != nil {
		return errResp, nil
	}

	utilType := NormalizeUtilityType(argString(args, "utility_type"))
	limit := clampInt(argInt(args, "limit", 10), 1, 20)

	where := []string{"b.payment_status = 'PENDING'"}
	qArgs := []any{}
	argIdx := 1

	if deptID != "" {
		where = append(where, fmt.Sprintf("b.department_id = $%d", argIdx))
		qArgs = append(qArgs, deptID)
		argIdx++
	}
	if utilType != "" {
		where = append(where, fmt.Sprintf("b.utility_type = $%d", argIdx))
		qArgs = append(qArgs, utilType)
		argIdx++
	}
	whereClause := strings.Join(where, " AND ")

	var totalPendingCount int
	var totalPendingAmount float64
	sumQuery := fmt.Sprintf(`
		SELECT COUNT(*)::int, COALESCE(SUM(COALESCE(b.invoice_amount, b.estimated_amount, 0)), 0)::float8
		FROM utility_bills b
		WHERE %s
	`, whereClause)
	if err := e.pool.QueryRow(ctx, sumQuery, qArgs...).Scan(&totalPendingCount, &totalPendingAmount); err != nil {
		return nil, fmt.Errorf("query pending total: %w", err)
	}

	type topDept struct {
		DepartmentName string  `json:"departmentName"`
		PendingCount   int     `json:"pendingCount"`
		PendingAmount  float64 `json:"pendingAmount"`
	}
	var topDepts []topDept
	if deptID == "" {
		topQuery := fmt.Sprintf(`
			SELECT d.full_name, COUNT(*)::int, COALESCE(SUM(COALESCE(b.invoice_amount, b.estimated_amount, 0)), 0)::float8 AS amt
			FROM utility_bills b
			JOIN departments d ON b.department_id = d.id
			WHERE %s
			GROUP BY d.id, d.full_name
			ORDER BY amt DESC, COUNT(*) DESC
			LIMIT 5
		`, whereClause)
		tRows, err := e.pool.Query(ctx, topQuery, qArgs...)
		if err == nil {
			defer tRows.Close()
			for tRows.Next() {
				var td topDept
				if tRows.Scan(&td.DepartmentName, &td.PendingCount, &td.PendingAmount) == nil {
					topDepts = append(topDepts, td)
				}
			}
		}
	}

	type pendingItem struct {
		BillCode       string  `json:"billCode"`
		DepartmentName string  `json:"departmentName"`
		UtilityType    string  `json:"utilityType"`
		ServiceNumber  string  `json:"serviceNumber"`
		MonthName      string  `json:"monthName"`
		YearBE         int     `json:"yearBE"`
		Amount         float64 `json:"amount"`
		InvoiceStatus  string  `json:"invoiceStatus"`
	}

	listQuery := fmt.Sprintf(`
		SELECT
			COALESCE(b.bill_code, b.id),
			COALESCE(d.full_name, 'ไม่ระบุ'),
			b.utility_type,
			COALESCE(b.service_number, '-'),
			b.billing_month,
			b.billing_year,
			COALESCE(b.invoice_amount, b.estimated_amount, 0)::float8 AS amt,
			COALESCE(b.invoice_status, 'RECEIVED')
		FROM utility_bills b
		LEFT JOIN departments d ON b.department_id = d.id
		WHERE %s
		ORDER BY amt DESC, b.billing_year DESC, b.billing_month DESC
		LIMIT $%d
	`, whereClause, argIdx)
	listArgs := append(append([]any{}, qArgs...), limit)

	var items []pendingItem
	lRows, err := e.pool.Query(ctx, listQuery, listArgs...)
	if err == nil {
		defer lRows.Close()
		for lRows.Next() {
			var it pendingItem
			var m, y int
			if lRows.Scan(&it.BillCode, &it.DepartmentName, &it.UtilityType, &it.ServiceNumber, &m, &y, &it.Amount, &it.InvoiceStatus) == nil {
				if m >= 1 && m <= 12 {
					it.MonthName = thaiMonthNames[m]
				}
				it.YearBE = y + 543
				items = append(items, it)
			}
		}
	}

	return map[string]any{
		"scope":                scopeLabel,
		"totalPendingCount":    totalPendingCount,
		"totalPendingAmount":   totalPendingAmount,
		"topPendingDepartments": topDepts,
		"samplePendingBills":   items,
	}, nil
}

func (e *ToolExecutor) getAnomalies(ctx context.Context, scope UserScope, args map[string]any) (any, error) {
	requestedDept := argString(args, "department_name")
	deptID, scopeLabel, errResp := e.resolveDeptScope(ctx, scope, requestedDept)
	if errResp != nil {
		return errResp, nil
	}

	now := e.now()
	billCode := strings.TrimSpace(argString(args, "bill_code"))
	month := argInt(args, "month", 0)
	rawYear := argInt(args, "year", 0)
	onlyUnreviewed := argBool(args, "only_unreviewed", true)
	limit := clampInt(argInt(args, "limit", 10), 1, 20)

	where := []string{`(
		a.is_manual_anomaly = true OR a.is_late_receive = true OR a.is_late_payment = true OR
		a.is_overdue_more_than_2_months = true OR a.is_disbursement_over_2_months = true OR
		a.is_wrong_month = true OR a.is_phone_over_limit = true OR a.is_phone_usage_over_limit = true OR
		a.is_wrong_budget = true OR a.is_duplicate = true OR a.is_anomaly_expense = true
	)`}
	qArgs := []any{}
	argIdx := 1

	if billCode != "" {
		where = append(where, fmt.Sprintf("(b.bill_code ILIKE $%d OR b.id = $%d OR b.service_number ILIKE $%d)", argIdx, argIdx+1, argIdx+2))
		qArgs = append(qArgs, "%"+billCode+"%", billCode, "%"+billCode+"%")
		argIdx += 3
	} else if onlyUnreviewed {
		where = append(where, "(b.is_reviewed = false OR b.is_reviewed IS NULL)")
	}
	if deptID != "" {
		where = append(where, fmt.Sprintf("b.department_id = $%d", argIdx))
		qArgs = append(qArgs, deptID)
		argIdx++
	}
	if rawYear > 0 {
		yearCE := NormalizeBillingYearCE(rawYear, now)
		where = append(where, fmt.Sprintf("b.billing_year = $%d", argIdx))
		qArgs = append(qArgs, yearCE)
		argIdx++
	}
	if month >= 1 && month <= 12 {
		where = append(where, fmt.Sprintf("b.billing_month = $%d", argIdx))
		qArgs = append(qArgs, month)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	var totalAnomalies int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT b.id)::int
		FROM utility_bills b
		JOIN audits a ON b.id = a.utility_bill_id
		WHERE %s
	`, whereClause)
	if err := e.pool.QueryRow(ctx, countQuery, qArgs...).Scan(&totalAnomalies); err != nil {
		return nil, fmt.Errorf("query anomalies count: %w", err)
	}

	type anomalyItem struct {
		BillCode            string   `json:"billCode"`
		DepartmentName      string   `json:"departmentName"`
		UtilityType         string   `json:"utilityType"`
		ServiceNumber       string   `json:"serviceNumber,omitempty"`
		MonthName           string   `json:"monthName"`
		YearBE              int      `json:"yearBE"`
		InvoiceAmount       float64  `json:"invoiceAmount"`
		AuditStatus         string   `json:"auditStatus"`
		Reasons             []string `json:"reasons"`
		ManualAnomalyDetail string   `json:"manualAnomalyDetail,omitempty"`
		Remarks             string   `json:"remarks,omitempty"`
	}

	listQuery := fmt.Sprintf(`
		SELECT
			COALESCE(b.bill_code, b.id),
			COALESCE(d.full_name, 'ไม่ระบุ'),
			b.utility_type,
			COALESCE(b.service_number, '-'),
			b.billing_month,
			b.billing_year,
			COALESCE(b.invoice_amount, b.estimated_amount, 0)::float8,
			COALESCE(a.status, 'PENDING_CORRECTION'),
			COALESCE(a.is_late_receive, false),
			COALESCE(a.is_late_payment, false),
			COALESCE(a.is_overdue_more_than_2_months, false),
			COALESCE(a.is_disbursement_over_2_months, false),
			COALESCE(a.is_wrong_month, false),
			COALESCE(a.is_phone_over_limit, false),
			COALESCE(a.is_phone_usage_over_limit, false),
			COALESCE(a.is_wrong_budget, false),
			COALESCE(a.is_duplicate, false),
			COALESCE(a.is_anomaly_expense, false),
			COALESCE(a.is_manual_anomaly, false),
			COALESCE(a.manual_anomaly_reason, ''),
			COALESCE(a.manual_anomaly_detail, ''),
			COALESCE(a.remarks, '')
		FROM utility_bills b
		JOIN audits a ON b.id = a.utility_bill_id
		LEFT JOIN departments d ON b.department_id = d.id
		WHERE %s
		ORDER BY b.billing_year DESC, b.billing_month DESC, b.created_at DESC
		LIMIT $%d
	`, whereClause, argIdx)
	listArgs := append(append([]any{}, qArgs...), limit)

	rows, err := e.pool.Query(ctx, listQuery, listArgs...)
	if err != nil {
		return nil, fmt.Errorf("query anomalies list: %w", err)
	}
	defer rows.Close()

	var items []anomalyItem
	for rows.Next() {
		var it anomalyItem
		var m, y int
		var fLateRec, fLatePay, fOverdue2M, fDisb2M, fWrongM, fPhoneLim, fPhoneUsage, fWrongBud, fDup, fAnomalyExp, fManual bool
		var manualReason, manualDetail, remarks string
		if rows.Scan(
			&it.BillCode, &it.DepartmentName, &it.UtilityType, &it.ServiceNumber, &m, &y,
			&it.InvoiceAmount, &it.AuditStatus,
			&fLateRec, &fLatePay, &fOverdue2M, &fDisb2M, &fWrongM,
			&fPhoneLim, &fPhoneUsage, &fWrongBud, &fDup, &fAnomalyExp,
			&fManual, &manualReason, &manualDetail, &remarks,
		) == nil {
			if m >= 1 && m <= 12 {
				it.MonthName = thaiMonthNames[m]
			}
			it.YearBE = y + 543
			if fLateRec {
				it.Reasons = append(it.Reasons, "รับบิลช้ากว่า 30 วัน (นับจากวันที่ในใบแจ้งหนี้ถึงวันที่ลงรับ)")
			}
			if fLatePay {
				it.Reasons = append(it.Reasons, "จ่ายเงินช้ากว่า 15 วัน (นับจากวันครบกำหนดชำระ)")
			}
			if fOverdue2M {
				it.Reasons = append(it.Reasons, "ค้างชำระสะสมเกิน 2 เดือน (> 60 วัน)")
			}
			if fDisb2M {
				it.Reasons = append(it.Reasons, "ระยะเวลาส่งเบิกจ่ายเกิน 2 เดือน (> 60 วัน)")
			}
			if fWrongM {
				it.Reasons = append(it.Reasons, "เดือนใบแจ้งหนี้ไม่ตรงรอบบิล")
			}
			if fPhoneLim {
				it.Reasons = append(it.Reasons, "ค่าโทรศัพท์เกินสิทธิ์เบิกตามระเบียบ")
			}
			if fPhoneUsage {
				it.Reasons = append(it.Reasons, "ยอดใช้บริการโทรศัพท์เกินวงเงิน")
			}
			if fWrongBud {
				it.Reasons = append(it.Reasons, "รหัสงบประมาณไม่สอดคล้องกับประเภทหรือปีงบประมาณ")
			}
			if fDup {
				it.Reasons = append(it.Reasons, "บิลซ้ำซ้อน (ตรวจพบเลขมิเตอร์/ผู้ใช้ซ้ำในรอบเดียวกัน)")
			}
			if fAnomalyExp {
				it.Reasons = append(it.Reasons, "ค่าใช้จ่ายสูงผิดปกติจากค่าเฉลี่ยสถิติ (Hybrid Z-Score/IQR)")
			}
			if fManual {
				if manualReason != "" {
					it.Reasons = append(it.Reasons, "ผู้ตรวจสอบปักธง: "+manualReason)
				} else {
					it.Reasons = append(it.Reasons, "ผู้ตรวจสอบปักธงความคลาดเคลื่อน")
				}
			}
			it.ManualAnomalyDetail = manualDetail
			it.Remarks = remarks
			items = append(items, it)
		}
	}

	return map[string]any{
		"scope":          scopeLabel,
		"totalAnomalies": totalAnomalies,
		"items":          items,
	}, nil
}

func (e *ToolExecutor) getMonthlyTrend(ctx context.Context, scope UserScope, args map[string]any) (any, error) {
	requestedDept := argString(args, "department_name")
	deptID, scopeLabel, errResp := e.resolveDeptScope(ctx, scope, requestedDept)
	if errResp != nil {
		return errResp, nil
	}

	months := clampInt(argInt(args, "months", 6), 1, 12)
	utilType := NormalizeUtilityType(argString(args, "utility_type"))

	now := e.now()
	endVal := now.Year()*12 + int(now.Month())
	startMonth := int(now.Month()) - (months - 1)
	startYear := now.Year()
	for startMonth <= 0 {
		startMonth += 12
		startYear--
	}
	startVal := startYear*12 + startMonth

	where := []string{"(billing_year * 12 + billing_month) BETWEEN $1 AND $2"}
	qArgs := []any{startVal, endVal}
	argIdx := 3

	if deptID != "" {
		where = append(where, fmt.Sprintf("department_id = $%d", argIdx))
		qArgs = append(qArgs, deptID)
		argIdx++
	}
	if utilType != "" {
		where = append(where, fmt.Sprintf("utility_type = $%d", argIdx))
		qArgs = append(qArgs, utilType)
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT
			billing_year,
			billing_month,
			COUNT(*)::int,
			COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN COALESCE(paid_amount, 0) ELSE 0 END), 0)::float8,
			COALESCE(SUM(CASE WHEN payment_status = 'PENDING' THEN COALESCE(invoice_amount, estimated_amount, 0) ELSE 0 END), 0)::float8
		FROM utility_bills
		WHERE %s
		GROUP BY billing_year, billing_month
		ORDER BY billing_year ASC, billing_month ASC
	`, strings.Join(where, " AND "))

	rows, err := e.pool.Query(ctx, query, qArgs...)
	if err != nil {
		return nil, fmt.Errorf("query monthly trend: %w", err)
	}
	defer rows.Close()

	type monthPoint struct {
		MonthName     string  `json:"monthName"`
		YearBE        int     `json:"yearBE"`
		BillCount     int     `json:"billCount"`
		PaidAmount    float64 `json:"paidAmount"`
		PendingAmount float64 `json:"pendingAmount"`
		TotalAmount   float64 `json:"totalAmount"`
	}

	var series []monthPoint
	for rows.Next() {
		var y, m, cnt int
		var paid, pending float64
		if rows.Scan(&y, &m, &cnt, &paid, &pending) == nil {
			mName := ""
			if m >= 1 && m <= 12 {
				mName = thaiMonthNames[m]
			}
			series = append(series, monthPoint{
				MonthName:     mName,
				YearBE:        y + 543,
				BillCount:     cnt,
				PaidAmount:    paid,
				PendingAmount: pending,
				TotalAmount:   paid + pending,
			})
		}
	}

	return map[string]any{
		"scope":       scopeLabel,
		"months":      months,
		"utilityType": utilType,
		"trend":       series,
	}, nil
}

func (e *ToolExecutor) getUnrecordedServices(ctx context.Context, scope UserScope, args map[string]any) (any, error) {
	requestedDept := argString(args, "department_name")
	deptID, scopeLabel, errResp := e.resolveDeptScope(ctx, scope, requestedDept)
	if errResp != nil {
		return errResp, nil
	}

	now := e.now()
	month := argInt(args, "month", int(now.Month()))
	if month < 1 || month > 12 {
		month = int(now.Month())
	}
	yearCE := NormalizeBillingYearCE(argInt(args, "year", 0), now)
	limit := clampInt(argInt(args, "limit", 15), 1, 25)

	var recordedCount, unrecordedCount int
	countQuery := `
		WITH active_s AS (
			SELECT DISTINCT department_id, utility_type, service_number
			FROM department_services
			WHERE is_active = true
				AND ($3::text = '' OR department_id = $3)
		),
		period_b AS (
			SELECT DISTINCT department_id, utility_type, service_number
			FROM utility_bills
			WHERE billing_month = $1 AND billing_year = $2
				AND ($3::text = '' OR department_id = $3)
		)
		SELECT
			(SELECT COUNT(*)::int FROM active_s s WHERE EXISTS (
				SELECT 1 FROM period_b b
				WHERE b.department_id = s.department_id
					AND b.utility_type = s.utility_type
					AND b.service_number = s.service_number
			)),
			(SELECT COUNT(*)::int FROM active_s s WHERE NOT EXISTS (
				SELECT 1 FROM period_b b
				WHERE b.department_id = s.department_id
					AND b.utility_type = s.utility_type
					AND b.service_number = s.service_number
			))
	`
	if err := e.pool.QueryRow(ctx, countQuery, month, yearCE, deptID).Scan(&recordedCount, &unrecordedCount); err != nil {
		return nil, fmt.Errorf("query service status counts: %w", err)
	}

	type unrecordedItem struct {
		DepartmentName string `json:"departmentName"`
		UtilityType    string `json:"utilityType"`
		Provider       string `json:"provider"`
		ServiceNumber  string `json:"serviceNumber"`
		LocationType   string `json:"locationType"`
	}

	listQuery := `
		SELECT
			d.full_name,
			s.utility_type,
			s.provider,
			s.service_number,
			COALESCE(s.location_type, '-')
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
					AND b.billing_year = $2
			)
		ORDER BY d.full_name ASC, s.utility_type ASC
		LIMIT $4
	`
	var items []unrecordedItem
	rows, err := e.pool.Query(ctx, listQuery, month, yearCE, deptID, limit)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var it unrecordedItem
			if rows.Scan(&it.DepartmentName, &it.UtilityType, &it.Provider, &it.ServiceNumber, &it.LocationType) == nil {
				items = append(items, it)
			}
		}
	}

	return map[string]any{
		"scope":              scopeLabel,
		"period":             fmt.Sprintf("เดือน%s พ.ศ. %d", thaiMonthNames[month], yearCE+543),
		"recordedCount":      recordedCount,
		"unrecordedCount":    unrecordedCount,
		"unrecordedSamples":  items,
	}, nil
}

func (e *ToolExecutor) getBudgetOverview(ctx context.Context, scope UserScope, args map[string]any) (any, error) {
	requestedDept := argString(args, "department_name")
	deptID, scopeLabel, errResp := e.resolveDeptScope(ctx, scope, requestedDept)
	if errResp != nil {
		return errResp, nil
	}

	fiscalYearBE := NormalizeFiscalYearBE(argInt(args, "fiscal_year", 0), e.now())

	where := []string{"b.fiscal_year = $1"}
	qArgs := []any{fiscalYearBE}
	if deptID != "" {
		where = append(where, "b.department_id = $2")
		qArgs = append(qArgs, deptID)
	}
	whereClause := strings.Join(where, " AND ")

	var totalAllocated, totalTransferred float64
	var budgetEntries int
	sumQuery := fmt.Sprintf(`
		SELECT COUNT(*)::int, COALESCE(SUM(b.allocated_amount), 0)::float8, COALESCE(SUM(b.transferred_amount), 0)::float8
		FROM budgets b
		WHERE %s
	`, whereClause)
	if err := e.pool.QueryRow(ctx, sumQuery, qArgs...).Scan(&budgetEntries, &totalAllocated, &totalTransferred); err != nil {
		return nil, fmt.Errorf("query budgets summary: %w", err)
	}

	type budgetItem struct {
		DepartmentName    string  `json:"departmentName"`
		BudgetCode        string  `json:"budgetCode"`
		Name              string  `json:"name"`
		AllocatedAmount   float64 `json:"allocatedAmount"`
		TransferredAmount float64 `json:"transferredAmount"`
	}

	listQuery := fmt.Sprintf(`
		SELECT d.full_name, b.budget_code, b.name, b.allocated_amount::float8, b.transferred_amount::float8
		FROM budgets b
		JOIN departments d ON b.department_id = d.id
		WHERE %s
		ORDER BY b.allocated_amount DESC
		LIMIT 10
	`, whereClause)
	var items []budgetItem
	rows, err := e.pool.Query(ctx, listQuery, qArgs...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var it budgetItem
			if rows.Scan(&it.DepartmentName, &it.BudgetCode, &it.Name, &it.AllocatedAmount, &it.TransferredAmount) == nil {
				items = append(items, it)
			}
		}
	}

	return map[string]any{
		"scope":            scopeLabel,
		"fiscalYearBE":     fiscalYearBE,
		"budgetEntries":    budgetEntries,
		"totalAllocated":   totalAllocated,
		"totalTransferred": totalTransferred,
		"netBudget":        totalAllocated + totalTransferred,
		"topBudgetItems":   items,
	}, nil
}

func (e *ToolExecutor) getUtilityForecast(ctx context.Context, scope UserScope, args map[string]any) (any, error) {
	requestedDept := argString(args, "department_name")
	deptID, scopeLabel, errResp := e.resolveDeptScope(ctx, scope, requestedDept)
	if errResp != nil {
		return errResp, nil
	}

	monthsAhead := argInt(args, "months_ahead", 3)
	if monthsAhead <= 0 {
		monthsAhead = 3
	}
	if monthsAhead > 6 {
		monthsAhead = 6
	}

	fiscalYear := NormalizeFiscalYearBE(argInt(args, "fiscal_year", 0), e.now())

	queryScope := scope
	queryScope.DepartmentID = deptID
	if deptID != "" {
		queryScope.DepartmentName = scopeLabel
	}

	fc := e.forecast
	if fc == nil {
		fc = NewForecastService(nil, e.pool, nil)
	}

	res, err := fc.GetForecast(ctx, queryScope, monthsAhead, fiscalYear)
	if err != nil {
		return nil, fmt.Errorf("calculate utility forecast: %w", err)
	}

	type forecastPointSummary struct {
		Label           string  `json:"label"`
		PredictedAmount float64 `json:"predictedAmount"`
		LowerBound      float64 `json:"lowerBound"`
		UpperBound      float64 `json:"upperBound"`
	}
	var futurePoints []forecastPointSummary
	for _, p := range res.Series {
		if p.IsForecast {
			futurePoints = append(futurePoints, forecastPointSummary{
				Label:           p.Label,
				PredictedAmount: round2(p.PredictedAmount),
				LowerBound:      round2(p.LowerBound),
				UpperBound:      round2(p.UpperBound),
			})
		}
	}

	type alertSummary struct {
		DepartmentName    string `json:"departmentName"`
		UtilityType       string `json:"utilityType"`
		Severity          string `json:"severity"`
		Title             string `json:"title"`
		Reason            string `json:"reason"`
		RecommendedAction string `json:"recommendedAction"`
	}
	var alerts []alertSummary
	for _, a := range res.AlertPredictions {
		if len(alerts) >= 5 {
			break
		}
		alerts = append(alerts, alertSummary{
			DepartmentName:    a.DepartmentName,
			UtilityType:       a.UtilityType,
			Severity:          a.Severity,
			Title:             a.Title,
			Reason:            a.Reason,
			RecommendedAction: a.RecommendedAction,
		})
	}

	return map[string]any{
		"scope":                scopeLabel,
		"horizonMonths":        res.Horizon,
		"method":               res.Method,
		"confidenceLevel":      res.ConfidenceLabel,
		"nextMonthLabel":       res.NextMonthLabel,
		"nextMonthPredicted":   round2(res.NextMonthPredicted),
		"nextMonthLowerBound":  round2(res.NextMonthLowerBound),
		"nextMonthUpperBound":  round2(res.NextMonthUpperBound),
		"historicalAvgMonthly": round2(res.HistoricalAvgMonthly),
		"moMForecastChangePct": round2(res.MoMForecastChangePct),
		"futureForecasts":      futurePoints,
		"budgetPlan": map[string]any{
			"fiscalYearBE":            res.BudgetPlan.FiscalYearBE,
			"netBudget":               round2(res.BudgetPlan.NetBudget),
			"ytdSpent":                round2(res.BudgetPlan.YTDSpent),
			"projectedRemainingSpend": round2(res.BudgetPlan.ProjectedRemainingSpend),
			"projectedTotalSpend":     round2(res.BudgetPlan.ProjectedTotalSpend),
			"projectedBalance":        round2(res.BudgetPlan.ProjectedBalance),
			"projectedUtilizationPct": round1(res.BudgetPlan.ProjectedUtilizationPct),
			"status":                  res.BudgetPlan.Status,
		},
		"earlyAlerts": alerts,
	}, nil
}

func (e *ToolExecutor) searchBillsAndDepartments(ctx context.Context, scope UserScope, args map[string]any) (any, error) {
	query := argString(args, "query")
	if query == "" {
		return map[string]any{"error": "กรุณาระบุคำค้นหา"}, nil
	}

	entityType := argString(args, "entity_type")
	if entityType == "" {
		entityType = "all"
	}

	limit := argInt(args, "limit", 5)
	if limit <= 0 {
		limit = 5
	}
	if limit > 15 {
		limit = 15
	}

	sc := e.search
	if sc == nil {
		sc = NewSearchService(nil, e.pool)
	}

	res, err := sc.Search(ctx, scope, SearchRequest{
		Query:      query,
		EntityType: entityType,
		Limit:      limit,
	})
	if err != nil {
		return nil, fmt.Errorf("search bills and departments: %w", err)
	}

	type billHitSummary struct {
		BillCode       string   `json:"billCode"`
		DepartmentName string   `json:"departmentName"`
		UtilityType    string   `json:"utilityType"`
		BillingMonth   int      `json:"billingMonth"`
		BillingYearBE  int      `json:"billingYearBE"`
		ServiceNumber  string   `json:"serviceNumber,omitempty"`
		InvoiceNumber  string   `json:"invoiceNumber,omitempty"`
		InvoiceAmount  float64  `json:"invoiceAmount"`
		PaymentStatus  string   `json:"paymentStatus"`
		InvoiceStatus  string   `json:"invoiceStatus"`
		HasAnomaly     bool     `json:"hasAnomaly"`
		MatchReasons   []string `json:"matchReasons"`
	}

	var bills []billHitSummary
	for _, b := range res.Bills {
		bills = append(bills, billHitSummary{
			BillCode:       b.BillCode,
			DepartmentName: b.DepartmentName,
			UtilityType:    b.UtilityType,
			BillingMonth:   b.BillingMonth,
			BillingYearBE:  b.BillingYearBE,
			ServiceNumber:  b.ServiceNumber,
			InvoiceNumber:  b.InvoiceNumber,
			InvoiceAmount:  b.InvoiceAmount,
			PaymentStatus:  b.PaymentStatus,
			InvoiceStatus:  b.InvoiceStatus,
			HasAnomaly:     b.HasAnomaly,
			MatchReasons:   b.MatchReasons,
		})
	}

	type deptHitSummary struct {
		FullName       string   `json:"fullName"`
		ShortName      string   `json:"shortName,omitempty"`
		Province       string   `json:"province,omitempty"`
		Region         string   `json:"region,omitempty"`
		Type           string   `json:"type,omitempty"`
		CostCenterCode string   `json:"costCenterCode,omitempty"`
		MatchReasons   []string `json:"matchReasons"`
	}

	var depts []deptHitSummary
	for _, d := range res.Departments {
		depts = append(depts, deptHitSummary{
			FullName:       d.FullName,
			ShortName:      d.ShortName,
			Province:       d.Province,
			Region:         d.Region,
			Type:           d.Type,
			CostCenterCode: d.CostCenter,
			MatchReasons:   d.MatchReasons,
		})
	}

	return map[string]any{
		"query":       res.Query,
		"searchMode":  res.Mode,
		"billsCount":  len(bills),
		"bills":       bills,
		"deptsCount":  len(depts),
		"departments": depts,
	}, nil
}
