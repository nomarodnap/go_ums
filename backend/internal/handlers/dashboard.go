package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MonthlyExpenseDTO struct {
	Month int     `json:"month"`
	Name  string  `json:"name"`
	Total float64 `json:"total"`
	Paid  float64 `json:"paid"`
}

type UtilityBreakdownDTO struct {
	UtilityType string  `json:"utilityType"`
	Total       float64 `json:"total"`
	Count       int     `json:"count"`
}

type TrendDataPointDTO struct {
	Month       string  `json:"month"`
	Electricity float64 `json:"electricity"`
	Water       float64 `json:"water"`
	Phone       float64 `json:"phone"`
	Telecom     float64 `json:"telecom"`
	Postal      float64 `json:"postal"`
}

type StatusDataPointDTO struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
	Color string  `json:"color"`
}

type RecentAnomalyDTO struct {
	ID                       string  `json:"id"`
	DepartmentName           string  `json:"departmentName"`
	UtilityType              string  `json:"utilityType"`
	BillingMonth             int     `json:"billingMonth"`
	BillingYear              int     `json:"billingYear"`
	InvoiceAmount            float64 `json:"invoiceAmount"`
	IsManualAnomaly          bool    `json:"isManualAnomaly"`
	ManualAnomalyReason      string  `json:"manualAnomalyReason"`
	IsLateReceive            bool    `json:"isLateReceive"`
	IsLatePayment            bool    `json:"isLatePayment"`
	IsOverdueMoreThan2Months bool    `json:"isOverdueMoreThan2Months"`
	IsDisbursementOver2Months bool   `json:"isDisbursementOver2Months"`
}

type TopDepartmentDTO struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
}

type DashboardSummaryOutput struct {
	Body struct {
		Scope                     string                `json:"scope"`
		IsAdmin                   bool                  `json:"isAdmin"`
		DepartmentName            string                `json:"departmentName"`
		DepartmentShortName       string                `json:"departmentShortName"`
		TotalInvoicesCurrentMonth int                   `json:"totalInvoicesCurrentMonth"`
		TotalPendingBills         int                   `json:"totalPendingBills"`
		TotalPaidCurrentMonth     float64               `json:"totalPaidCurrentMonth"`
		TotalAnomalies            int                   `json:"totalAnomalies"`
		RecentAnomalies           []RecentAnomalyDTO    `json:"recentAnomalies"`
		TopDepartments            []TopDepartmentDTO    `json:"topDepartments"`
		TrendData                 []TrendDataPointDTO   `json:"trendData"`
		StatusData                []StatusDataPointDTO  `json:"statusData"`

		// Legacy / backward-compatible fields
		TotalAmount               float64               `json:"totalAmount"`
		PaidAmount                float64               `json:"paidAmount"`
		PendingAmount             float64               `json:"pendingAmount"`
		TotalBills                int                   `json:"totalBills"`
		AuditIssuesCount          int                   `json:"auditIssuesCount"`
		MonthlyTrends             []MonthlyExpenseDTO   `json:"monthlyTrends"`
		UtilityBreakdowns         []UtilityBreakdownDTO `json:"utilityBreakdowns"`
	} `json:"body"`
}

var thaiMonthFullNames = []string{
	"", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
	"กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
}

var thaiMonthShortNames = []string{
	"ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
	"ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
}

func RegisterDashboardRoutes(api huma.API, pool *pgxpool.Pool) {
	huma.Register(api, huma.Operation{
		OperationID: "getDashboardSummary",
		Method:      http.MethodGet,
		Path:        "/api/dashboard/summary",
		Summary:     "Get executive dashboard statistics and chart trends",
		Tags:        []string{"Dashboard"},
	}, func(ctx context.Context, input *struct {
		Scope        string `query:"scope" doc:"Scope of stats: 'department' or 'all'" default:"department"`
		DepartmentID string `query:"departmentId" doc:"Optional target department ID"`
		FiscalYear   int    `query:"fiscalYear" doc:"Fiscal Year filter"`
	}) (*DashboardSummaryOutput, error) {
		out := &DashboardSummaryOutput{}

		// Determine user role and permissions
		user, hasUser := auth.UserFromContext(ctx)
		isAdmin := false
		userRole := "user"
		userDepartmentID := ""
		if hasUser && user != nil {
			userRole = user.Role
			userDepartmentID = user.DepartmentID
			if userRole == "admin" || userRole == "auditor" || userRole == "strategy_finance" || userRole == "central_staff" {
				isAdmin = true
			}
		}

		scope := input.Scope
		if scope != "all" {
			scope = "department"
		}
		if scope == "all" && !isAdmin {
			// If not admin and requesting all, fallback to department scope if user has department
			if userDepartmentID != "" {
				scope = "department"
			}
		}
		out.Body.Scope = scope
		out.Body.IsAdmin = isAdmin

		var targetDeptID string
		deptName := "ภาพรวมทุกหน่วยงาน (292 หน่วยงาน)"
		deptShortName := "ภาพรวมทั้งกรม"

		if scope == "department" {
			if input.DepartmentID != "" && isAdmin {
				targetDeptID = input.DepartmentID
			} else if userDepartmentID != "" {
				targetDeptID = userDepartmentID
			}

			if targetDeptID == "" {
				// Fallback to first department in database
				_ = pool.QueryRow(ctx, "SELECT id, full_name, COALESCE(short_name, '') FROM departments ORDER BY id ASC LIMIT 1").Scan(
					&targetDeptID, &deptName, &deptShortName,
				)
			} else {
				_ = pool.QueryRow(ctx, "SELECT full_name, COALESCE(short_name, '') FROM departments WHERE id = $1", targetDeptID).Scan(
					&deptName, &deptShortName,
				)
			}
		}

		out.Body.DepartmentName = deptName
		out.Body.DepartmentShortName = deptShortName

		// Current billing period
		now := time.Now()
		currentMonth := int(now.Month())
		currentYear := now.Year()
		if input.FiscalYear > 0 {
			currentYear = input.FiscalYear
		}

		// Check if current year has bills, if not, find latest billing year
		var maxYearInDB int
		_ = pool.QueryRow(ctx, "SELECT COALESCE(MAX(billing_year), 0) FROM utility_bills").Scan(&maxYearInDB)
		effectiveYear := currentYear
		effectiveMonth := currentMonth
		if maxYearInDB > 0 && maxYearInDB != currentYear {
			// If no bills in currentYear, we can reference maxYearInDB for stats
			var countInCurrentYear int
			_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM utility_bills WHERE billing_year = $1", currentYear).Scan(&countInCurrentYear)
			if countInCurrentYear == 0 {
				effectiveYear = maxYearInDB
				var maxMonthInDB int
				_ = pool.QueryRow(ctx, "SELECT COALESCE(MAX(billing_month), 12) FROM utility_bills WHERE billing_year = $1", effectiveYear).Scan(&maxMonthInDB)
				effectiveMonth = maxMonthInDB
			}
		}

		// 1. KPI: บิลบันทึกเข้าระบบ (เดือนนี้)
		if scope == "all" {
			_ = pool.QueryRow(ctx, `
				SELECT COUNT(*) FROM utility_bills 
				WHERE billing_month = $1 AND billing_year = $2
			`, effectiveMonth, effectiveYear).Scan(&out.Body.TotalInvoicesCurrentMonth)
		} else {
			_ = pool.QueryRow(ctx, `
				SELECT COUNT(*) FROM utility_bills 
				WHERE billing_month = $1 AND billing_year = $2 AND department_id = $3
			`, effectiveMonth, effectiveYear, targetDeptID).Scan(&out.Body.TotalInvoicesCurrentMonth)
		}

		// 2. KPI: เบิกจ่ายแล้ว (เดือนนี้)
		if scope == "all" {
			_ = pool.QueryRow(ctx, `
				SELECT COALESCE(SUM(paid_amount), 0) FROM utility_bills 
				WHERE payment_status = 'PAID' AND billing_month = $1 AND billing_year = $2
			`, effectiveMonth, effectiveYear).Scan(&out.Body.TotalPaidCurrentMonth)
		} else {
			_ = pool.QueryRow(ctx, `
				SELECT COALESCE(SUM(paid_amount), 0) FROM utility_bills 
				WHERE payment_status = 'PAID' AND billing_month = $1 AND billing_year = $2 AND department_id = $3
			`, effectiveMonth, effectiveYear, targetDeptID).Scan(&out.Body.TotalPaidCurrentMonth)
		}

		// 3. KPI: ค้างชำระ (ทั้งหมด)
		if scope == "all" {
			_ = pool.QueryRow(ctx, `
				SELECT COUNT(*) FROM utility_bills 
				WHERE payment_status = 'PENDING'
			`).Scan(&out.Body.TotalPendingBills)
		} else {
			_ = pool.QueryRow(ctx, `
				SELECT COUNT(*) FROM utility_bills 
				WHERE payment_status = 'PENDING' AND department_id = $1
			`, targetDeptID).Scan(&out.Body.TotalPendingBills)
		}

		// 4. KPI: ตรวจสอบพบความผิดปกติ (Unreviewed anomalies)
		anomalyQuery := `
			SELECT COUNT(DISTINCT b.id)
			FROM utility_bills b
			LEFT JOIN audits a ON b.id = a.utility_bill_id
			WHERE (
				a.is_manual_anomaly = true OR a.is_late_receive = true OR a.is_late_payment = true OR
				a.is_overdue_more_than_2_months = true OR a.is_disbursement_over_2_months = true OR
				a.is_wrong_month = true OR a.is_phone_over_limit = true OR a.is_phone_usage_over_limit = true OR
				a.is_wrong_budget = true OR a.is_duplicate = true
			) AND (b.is_reviewed = false OR b.is_reviewed IS NULL)
		`
		if scope == "all" {
			_ = pool.QueryRow(ctx, anomalyQuery).Scan(&out.Body.TotalAnomalies)
		} else {
			_ = pool.QueryRow(ctx, anomalyQuery+" AND b.department_id = $1", targetDeptID).Scan(&out.Body.TotalAnomalies)
		}

		// 5. Recent Anomalies Table (Top 5)
		recentQuery := `
			SELECT 
				b.id,
				COALESCE(d.full_name, 'ไม่ระบุ'),
				b.utility_type,
				b.billing_month,
				b.billing_year,
				COALESCE(b.invoice_amount, 0),
				COALESCE(a.is_manual_anomaly, false),
				COALESCE(a.manual_anomaly_reason, ''),
				COALESCE(a.is_late_receive, false),
				COALESCE(a.is_late_payment, false),
				COALESCE(a.is_overdue_more_than_2_months, false),
				COALESCE(a.is_disbursement_over_2_months, false)
			FROM utility_bills b
			LEFT JOIN departments d ON b.department_id = d.id
			LEFT JOIN audits a ON b.id = a.utility_bill_id
			WHERE (
				a.is_manual_anomaly = true OR a.is_late_receive = true OR a.is_late_payment = true OR
				a.is_overdue_more_than_2_months = true OR a.is_disbursement_over_2_months = true OR
				a.is_wrong_month = true OR a.is_phone_over_limit = true OR a.is_phone_usage_over_limit = true OR
				a.is_wrong_budget = true OR a.is_duplicate = true
			) AND (b.is_reviewed = false OR b.is_reviewed IS NULL)
		`
		var rRows pgx.Rows
		var rErr error
		if scope == "all" {
			rRows, rErr = pool.Query(ctx, recentQuery+" ORDER BY b.created_at DESC LIMIT 5")
		} else {
			rRows, rErr = pool.Query(ctx, recentQuery+" AND b.department_id = $1 ORDER BY b.created_at DESC LIMIT 5", targetDeptID)
		}
		if rErr == nil {
			defer rRows.Close()
			for rRows.Next() {
				var an RecentAnomalyDTO
				if rRows.Scan(
					&an.ID, &an.DepartmentName, &an.UtilityType, &an.BillingMonth, &an.BillingYear,
					&an.InvoiceAmount, &an.IsManualAnomaly, &an.ManualAnomalyReason,
					&an.IsLateReceive, &an.IsLatePayment, &an.IsOverdueMoreThan2Months, &an.IsDisbursementOver2Months,
				) == nil {
					out.Body.RecentAnomalies = append(out.Body.RecentAnomalies, an)
				}
			}
		}
		if out.Body.RecentAnomalies == nil {
			out.Body.RecentAnomalies = []RecentAnomalyDTO{}
		}

		// 6. Top 5 Departments (Consolidated scope only)
		out.Body.TopDepartments = []TopDepartmentDTO{}
		if scope == "all" {
			topQuery := `
				SELECT d.full_name, COALESCE(SUM(b.paid_amount), 0) AS total_paid
				FROM utility_bills b
				INNER JOIN departments d ON b.department_id = d.id
				WHERE b.payment_status = 'PAID'
				GROUP BY d.id, d.full_name
				ORDER BY total_paid DESC
				LIMIT 5
			`
			tRows, tErr := pool.Query(ctx, topQuery)
			if tErr == nil {
				defer tRows.Close()
				for tRows.Next() {
					var top TopDepartmentDTO
					if tRows.Scan(&top.Name, &top.Amount) == nil {
						out.Body.TopDepartments = append(out.Body.TopDepartments, top)
					}
				}
			}
		}

		// 7. Trend Data (12 Months by Utility Type)
		out.Body.TrendData = []TrendDataPointDTO{}
		for i := 11; i >= 0; i-- {
			m := effectiveMonth - i
			y := effectiveYear
			for m <= 0 {
				m += 12
				y -= 1
			}

			pt := TrendDataPointDTO{
				Month: thaiMonthShortNames[m-1],
			}

			tQuery := `
				SELECT utility_type, COALESCE(SUM(paid_amount), 0)
				FROM utility_bills
				WHERE billing_month = $1 AND billing_year = $2 AND payment_status = 'PAID'
			`
			var tRows pgx.Rows
			var tErr error
			if scope == "all" {
				tRows, tErr = pool.Query(ctx, tQuery+" GROUP BY utility_type", m, y)
			} else {
				tRows, tErr = pool.Query(ctx, tQuery+" AND department_id = $3 GROUP BY utility_type", m, y, targetDeptID)
			}
			if tErr == nil {
				for tRows.Next() {
					var uType string
					var amount float64
					if tRows.Scan(&uType, &amount) == nil {
						switch uType {
						case "ค่าไฟฟ้า":
							pt.Electricity += amount
						case "ค่าประปา&น้ำบาดาล", "ค่าน้ำประปา":
							pt.Water += amount
						case "ค่าโทรศัพท์":
							pt.Phone += amount
						case "ค่าสื่อสาร&โทรคมนาคม", "ค่าบริการสื่อสารและโทรคมนาคม":
							pt.Telecom += amount
						case "ค่าบริการไปรษณีย์", "ค่าไปรษณีย์":
							pt.Postal += amount
						}
					}
				}
				tRows.Close()
			}
			out.Body.TrendData = append(out.Body.TrendData, pt)
		}

		// 8. Status Data (Pie Chart: เบิกจ่ายแล้ว vs ค้างชำระ)
		var paidCount, pendingCount int
		if scope == "all" {
			_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM utility_bills WHERE payment_status = 'PAID'").Scan(&paidCount)
			_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM utility_bills WHERE payment_status = 'PENDING'").Scan(&pendingCount)
		} else {
			_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM utility_bills WHERE payment_status = 'PAID' AND department_id = $1", targetDeptID).Scan(&paidCount)
			_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM utility_bills WHERE payment_status = 'PENDING' AND department_id = $1", targetDeptID).Scan(&pendingCount)
		}
		out.Body.StatusData = []StatusDataPointDTO{
			{Name: "เบิกจ่ายแล้ว", Value: float64(paidCount), Color: "var(--chart-2)"},
			{Name: "ค้างชำระ", Value: float64(pendingCount), Color: "var(--chart-4)"},
		}

		// 9. Legacy Totals & Monthly Trends (Backward compatibility)
		totQuery := `
			SELECT 
				COALESCE(SUM(invoice_amount), 0),
				COALESCE(SUM(paid_amount), 0),
				COALESCE(SUM(CASE WHEN payment_status = 'PENDING' THEN invoice_amount ELSE 0 END), 0),
				COUNT(*)
			FROM utility_bills
			WHERE 1=1
		`
		if scope == "department" && targetDeptID != "" {
			totQuery += " AND department_id = '" + targetDeptID + "'"
		}
		_ = pool.QueryRow(ctx, totQuery).Scan(
			&out.Body.TotalAmount, &out.Body.PaidAmount, &out.Body.PendingAmount, &out.Body.TotalBills,
		)
		out.Body.AuditIssuesCount = out.Body.TotalAnomalies

		for m := 1; m <= 12; m++ {
			out.Body.MonthlyTrends = append(out.Body.MonthlyTrends, MonthlyExpenseDTO{
				Month: m,
				Name:  thaiMonthFullNames[m],
				Total: 0,
				Paid:  0,
			})
		}

		return out, nil
	})
}

