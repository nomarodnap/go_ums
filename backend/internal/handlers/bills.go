package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/service"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BillDTO struct {
	ID                     string     `json:"id"`
	BillCode               *string    `json:"billCode,omitempty"`
	DepartmentID           string     `json:"departmentId"`
	DepartmentName         *string    `json:"departmentName,omitempty"`
	DepartmentShortName    *string    `json:"departmentShortName,omitempty"`
	DepartmentCostCenter   *string    `json:"departmentCostCenter,omitempty"`
	UtilityType            string     `json:"utilityType"`
	BillingMonth           int        `json:"billingMonth"`
	BillingYear            int        `json:"billingYear"`
	Provider               *string    `json:"provider,omitempty"`
	ServiceNumber          *string    `json:"serviceNumber,omitempty"`
	ServiceBreakdown       *string    `json:"serviceBreakdown,omitempty"`
	InvoiceNumber          *string    `json:"invoiceNumber,omitempty"`
	InvoiceDate            *time.Time `json:"invoiceDate,omitempty"`
	LocationType           *string    `json:"locationType,omitempty"`
	UsageAmount            *float64   `json:"usageAmount,omitempty"`
	InvoiceAmount          *float64   `json:"invoiceAmount,omitempty"`
	EstimatedAmount        *float64   `json:"estimatedAmount,omitempty"`
	ReceivedDate           *time.Time `json:"receivedDate,omitempty"`
	SentToDisbursingDate   *time.Time `json:"sentToDisbursingDate,omitempty"`
	DisbursingReceivedDate *time.Time `json:"disbursingReceivedDate,omitempty"`
	PaymentDate            *time.Time `json:"paymentDate,omitempty"`
	PaymentDocNumber       *string    `json:"paymentDocNumber,omitempty"`
	DocType                *string    `json:"docType,omitempty"`
	AccountCode            *string    `json:"accountCode,omitempty"`
	BudgetCode             *string    `json:"budgetCode,omitempty"`
	FundSource             *string    `json:"fundSource,omitempty"`
	PaidAmount             *float64   `json:"paidAmount,omitempty"`
	PaymentStatus          string     `json:"paymentStatus"`
	InvoiceStatus          string     `json:"invoiceStatus"`
	ReceiptNumber          *string    `json:"receiptNumber,omitempty"`
	ReceiptDate            *time.Time `json:"receiptDate,omitempty"`
	ReceiptPaymentDate     *time.Time `json:"receiptPaymentDate,omitempty"`
	AttachmentInvoice      *string    `json:"attachmentInvoice,omitempty"`
	AttachmentReceipt      *string    `json:"attachmentReceipt,omitempty"`
	AttachmentPaymentDoc   *string    `json:"attachmentPaymentDoc,omitempty"`
	AttachmentDirectPayment *string   `json:"attachmentDirectPayment,omitempty"`
	AttachmentKtbReport    *string    `json:"attachmentKtbReport,omitempty"`
	IsPendingBillOnly      bool       `json:"isPendingBillOnly"`
	DepositUnitID          *string    `json:"depositUnitId,omitempty"`
	DepositUnitName        *string    `json:"depositUnitName,omitempty"`
	IsReviewed             *bool      `json:"isReviewed,omitempty"`
	ReviewedBy             *string    `json:"reviewedBy,omitempty"`
	ReviewedAt             *time.Time `json:"reviewedAt,omitempty"`
	AuditStatus            *string    `json:"auditStatus,omitempty"`
	IsLateReceive          *bool      `json:"isLateReceive,omitempty"`
	IsLatePayment          *bool      `json:"isLatePayment,omitempty"`
	IsOverdueMoreThan2Months *bool    `json:"isOverdueMoreThan2Months,omitempty"`
	IsDisbursementOver2Months *bool   `json:"isDisbursementOver2Months,omitempty"`
	IsWrongMonth           *bool      `json:"isWrongMonth,omitempty"`
	IsPhoneOverLimit       *bool      `json:"isPhoneOverLimit,omitempty"`
	IsPhoneUsageOverLimit  *bool      `json:"isPhoneUsageOverLimit,omitempty"`
	IsWrongBudget          *bool      `json:"isWrongBudget,omitempty"`
	IsDuplicate            *bool      `json:"isDuplicate,omitempty"`
	IsAnomalyExpense       *bool      `json:"isAnomalyExpense,omitempty"`
	IsManualAnomaly        *bool      `json:"isManualAnomaly,omitempty"`
	ManualAnomalyReason    *string    `json:"manualAnomalyReason,omitempty"`
	ManualAnomalyDetail    *string    `json:"manualAnomalyDetail,omitempty"`
	CreatedAt              time.Time  `json:"createdAt"`
	UpdatedAt              time.Time  `json:"updatedAt"`
}

type ListBillsFilter struct {
	DepartmentID  string `query:"departmentId" doc:"Filter by Department ID"`
	BillingYear   int    `query:"billingYear" doc:"Filter by Fiscal/Billing Year"`
	BillingMonth  int    `query:"billingMonth" doc:"Filter by Month (1-12)"`
	UtilityType   string `query:"utilityType" doc:"Filter by Utility Type"`
	PaymentStatus string `query:"paymentStatus" doc:"Filter by Payment Status: PENDING or PAID"`
}

type ListBillsOutput struct {
	Body []BillDTO `json:"body"`
}

type SingleBillOutput struct {
	Body BillDTO `json:"body"`
}

type CreateBillInput struct {
	Body struct {
		DepartmentID         string     `json:"departmentId"`
		UtilityType          string     `json:"utilityType"`
		BillingMonth         int        `json:"billingMonth"`
		BillingYear          int        `json:"billingYear"`
		Provider             *string    `json:"provider,omitempty"`
		ServiceNumber        *string    `json:"serviceNumber,omitempty"`
		ServiceBreakdown     *string    `json:"serviceBreakdown,omitempty"`
		InvoiceNumber        *string    `json:"invoiceNumber,omitempty"`
		InvoiceDate          *time.Time `json:"invoiceDate,omitempty"`
		LocationType         *string    `json:"locationType,omitempty"`
		UsageAmount          *float64   `json:"usageAmount,omitempty"`
		InvoiceAmount        *float64   `json:"invoiceAmount,omitempty"`
		EstimatedAmount      *float64   `json:"estimatedAmount,omitempty"`
		ReceivedDate         *time.Time `json:"receivedDate,omitempty"`
		SentToDisbursingDate *time.Time `json:"sentToDisbursingDate,omitempty"`
		DisbursingReceivedDate *time.Time `json:"disbursingReceivedDate,omitempty"`
		PaymentDate          *time.Time `json:"paymentDate,omitempty"`
		PaymentDocNumber     *string    `json:"paymentDocNumber,omitempty"`
		DocType              *string    `json:"docType,omitempty"`
		AccountCode          *string    `json:"accountCode,omitempty"`
		BudgetCode           *string    `json:"budgetCode,omitempty"`
		FundSource           *string    `json:"fundSource,omitempty"`
		PaidAmount           *float64   `json:"paidAmount,omitempty"`
		PaymentStatus        string     `json:"paymentStatus" default:"PENDING"`
		InvoiceStatus        string     `json:"invoiceStatus" default:"RECEIVED"`
		ReceiptNumber        *string    `json:"receiptNumber,omitempty"`
		ReceiptDate          *time.Time `json:"receiptDate,omitempty"`
		ReceiptPaymentDate   *time.Time `json:"receiptPaymentDate,omitempty"`
		AttachmentInvoice    *string    `json:"attachmentInvoice,omitempty"`
		AttachmentReceipt    *string    `json:"attachmentReceipt,omitempty"`
		AttachmentPaymentDoc *string    `json:"attachmentPaymentDoc,omitempty"`
		AttachmentDirectPayment *string `json:"attachmentDirectPayment,omitempty"`
		AttachmentKtbReport  *string    `json:"attachmentKtbReport,omitempty"`
		IsPendingBillOnly    bool       `json:"isPendingBillOnly"`
		DepositUnitID        *string    `json:"depositUnitId,omitempty"`
	}
}

type UpdateBillInput struct {
	ID   string `path:"id" doc:"Bill unique ID"`
	Body struct {
		DepartmentID           string     `json:"departmentId"`
		UtilityType            string     `json:"utilityType"`
		BillingMonth           int        `json:"billingMonth"`
		BillingYear            int        `json:"billingYear"`
		Provider               *string    `json:"provider,omitempty"`
		ServiceNumber          *string    `json:"serviceNumber,omitempty"`
		ServiceBreakdown       *string    `json:"serviceBreakdown,omitempty"`
		InvoiceNumber          *string    `json:"invoiceNumber,omitempty"`
		InvoiceDate            *time.Time `json:"invoiceDate,omitempty"`
		LocationType           *string    `json:"locationType,omitempty"`
		UsageAmount            *float64   `json:"usageAmount,omitempty"`
		InvoiceAmount          *float64   `json:"invoiceAmount,omitempty"`
		EstimatedAmount        *float64   `json:"estimatedAmount,omitempty"`
		ReceivedDate           *time.Time `json:"receivedDate,omitempty"`
		SentToDisbursingDate   *time.Time `json:"sentToDisbursingDate,omitempty"`
		DisbursingReceivedDate *time.Time `json:"disbursingReceivedDate,omitempty"`
		PaymentDate            *time.Time `json:"paymentDate,omitempty"`
		PaymentDocNumber       *string    `json:"paymentDocNumber,omitempty"`
		DocType                *string    `json:"docType,omitempty"`
		AccountCode            *string    `json:"accountCode,omitempty"`
		BudgetCode             *string    `json:"budgetCode,omitempty"`
		FundSource             *string    `json:"fundSource,omitempty"`
		PaidAmount             *float64   `json:"paidAmount,omitempty"`
		PaymentStatus          string     `json:"paymentStatus"`
		InvoiceStatus          string     `json:"invoiceStatus"`
		ReceiptNumber          *string    `json:"receiptNumber,omitempty"`
		ReceiptDate            *time.Time `json:"receiptDate,omitempty"`
		ReceiptPaymentDate     *time.Time `json:"receiptPaymentDate,omitempty"`
		AttachmentInvoice      *string    `json:"attachmentInvoice,omitempty"`
		AttachmentReceipt      *string    `json:"attachmentReceipt,omitempty"`
		AttachmentPaymentDoc   *string    `json:"attachmentPaymentDoc,omitempty"`
		AttachmentDirectPayment *string   `json:"attachmentDirectPayment,omitempty"`
		AttachmentKtbReport    *string    `json:"attachmentKtbReport,omitempty"`
		IsPendingBillOnly      bool       `json:"isPendingBillOnly"`
		DepositUnitID          *string    `json:"depositUnitId,omitempty"`
	}
}

type ActivityLogDTO struct {
	ID        string    `json:"id"`
	BillID    string    `json:"billId"`
	UserID    string    `json:"userId"`
	UserName  *string   `json:"userName,omitempty"`
	UserEmail *string   `json:"userEmail,omitempty"`
	Action    string    `json:"action"`
	Details   *string   `json:"details,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type ListBillLogsOutput struct {
	Body []ActivityLogDTO `json:"body"`
}

type BillTrackingItemDTO struct {
	ID                  string     `json:"id"`
	DepartmentID        string     `json:"departmentId"`
	DepartmentName      string     `json:"departmentName"`
	DepositUnitName     *string    `json:"depositUnitName,omitempty"`
	UtilityType         string     `json:"utilityType"`
	Provider            string     `json:"provider"`
	ServiceNumber       string     `json:"serviceNumber"`
	BillCode            *string    `json:"billCode,omitempty"`
	InvoiceNumber       *string    `json:"invoiceNumber,omitempty"`
	PaymentDocNumber    *string    `json:"paymentDocNumber,omitempty"`
	PaidAmount          *float64   `json:"paidAmount,omitempty"`
	Amount              float64    `json:"amount"`
	Status              string     `json:"status"` // "UNRECORDED" | "NOT_RECEIVED" | "PENDING_PAYMENT" | "PAID" | "UNKNOWN"
	IsExpected          bool       `json:"isExpected"`
	BillID              *string    `json:"billId,omitempty"`
	AttachmentReceipt   *string    `json:"attachmentReceipt,omitempty"`
	IsReviewed          *bool      `json:"isReviewed,omitempty"`
	ReviewedBy          *string    `json:"reviewedBy,omitempty"`
	ReviewedAt          *time.Time `json:"reviewedAt,omitempty"`
	AuditStatus         *string    `json:"auditStatus,omitempty"` // "NORMAL" | "PENDING_CORRECTION" | "CORRECTED"
	IsManualAnomaly     *bool      `json:"isManualAnomaly,omitempty"`
	ManualAnomalyReason *string    `json:"manualAnomalyReason,omitempty"`
	ManualAnomalyDetail *string    `json:"manualAnomalyDetail,omitempty"`
	AuditIssues         []string   `json:"auditIssues,omitempty"`
}

type BillTrackingSummaryDTO struct {
	Total         int     `json:"total"`
	Unrecorded    int     `json:"unrecorded"`
	NotReceived   int     `json:"notReceived"`
	Pending       int     `json:"pending"`
	Paid          int     `json:"paid"`
	PendingAmount float64 `json:"pendingAmount"`
	PaidAmount    float64 `json:"paidAmount"`
	Reviewed      int     `json:"reviewed"`
	Unreviewed    int     `json:"unreviewed"`
	Normal        int     `json:"normal"`
	AnomalyIssues int     `json:"anomalyIssues"`
	ManualAnomaly int     `json:"manualAnomaly"`
	Corrected     int     `json:"corrected"`
}

type BillTrackingOutput struct {
	Body struct {
		Month   int                    `json:"month"`
		Year    int                    `json:"year"`
		Summary BillTrackingSummaryDTO `json:"summary"`
		Items   []BillTrackingItemDTO  `json:"items"`
	} `json:"body"`
}

type GetBillTrackingInput struct {
	Month        int    `query:"month" doc:"Billing month (1-12)"`
	Year         int    `query:"year" doc:"Billing Gregorian year (e.g. 2026)"`
	DepartmentID string `query:"departmentId" doc:"Optional department ID filter"`
}

func RegisterBillRoutes(api huma.API, pool *pgxpool.Pool, searchServices ...*ai.SearchService) {
	var searchService *ai.SearchService
	if len(searchServices) > 0 && searchServices[0] != nil {
		searchService = searchServices[0]
	}

	// List Bills
	huma.Register(api, huma.Operation{
		OperationID: "listBills",
		Method:      http.MethodGet,
		Path:        "/api/bills",
		Summary:     "List utility bills",
		Tags:        []string{"Bills"},
	}, func(ctx context.Context, input *ListBillsFilter) (*ListBillsOutput, error) {
		query := `
			SELECT b.id, b.bill_code, b.department_id, d.full_name, d.short_name, d.cost_center_code,
			       b.utility_type, b.billing_month, b.billing_year, b.provider, b.service_number,
			       b.service_breakdown, b.invoice_number, b.invoice_date, b.location_type,
			       b.usage_amount, b.invoice_amount, b.estimated_amount, b.received_date,
			       b.sent_to_disbursing_date, b.disbursing_received_date, b.payment_date,
			       b.payment_doc_number, b.doc_type, b.account_code, b.budget_code, b.fund_source,
			       b.paid_amount, b.payment_status, b.invoice_status, b.receipt_number,
			       b.receipt_date, b.receipt_payment_date, b.attachment_invoice, b.attachment_receipt,
			       b.attachment_payment_doc, b.attachment_direct_payment, b.attachment_ktb_report,
			       b.is_pending_bill_only, b.deposit_unit_id, dep_unit.full_name, b.is_reviewed,
			       COALESCE(u_rev.name, b.reviewed_by) AS reviewed_by, b.reviewed_at, a.status, a.is_late_receive, a.is_late_payment,
			       a.is_overdue_more_than_2_months, a.is_disbursement_over_2_months, a.is_wrong_month,
			       a.is_phone_over_limit, a.is_phone_usage_over_limit, a.is_wrong_budget,
			       a.is_duplicate, a.is_anomaly_expense, a.is_manual_anomaly, a.manual_anomaly_reason, a.manual_anomaly_detail,
			       b.created_at, b.updated_at
			FROM utility_bills b
			LEFT JOIN departments d ON b.department_id = d.id
			LEFT JOIN departments dep_unit ON b.deposit_unit_id = dep_unit.id
			LEFT JOIN audits a ON b.id = a.utility_bill_id
			LEFT JOIN "user" u_rev ON b.reviewed_by = u_rev.id
			WHERE 1=1
		`
		var args []interface{}
		argIdx := 1

		if input.DepartmentID != "" {
			query += fmt.Sprintf(" AND (b.department_id = $%d OR b.deposit_unit_id = $%d)", argIdx, argIdx)
			args = append(args, input.DepartmentID)
			argIdx++
		}
		if input.BillingYear > 0 {
			query += fmt.Sprintf(" AND b.billing_year = $%d", argIdx)
			args = append(args, input.BillingYear)
			argIdx++
		}
		if input.BillingMonth > 0 {
			query += fmt.Sprintf(" AND b.billing_month = $%d", argIdx)
			args = append(args, input.BillingMonth)
			argIdx++
		}
		if input.UtilityType != "" {
			query += fmt.Sprintf(" AND b.utility_type = $%d", argIdx)
			args = append(args, input.UtilityType)
			argIdx++
		}
		if input.PaymentStatus != "" {
			query += fmt.Sprintf(" AND b.payment_status = $%d", argIdx)
			args = append(args, input.PaymentStatus)
		}

		query += " ORDER BY b.created_at DESC LIMIT 500"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch bills")
		}
		defer rows.Close()

		results := make([]BillDTO, 0)
		for rows.Next() {
			var b BillDTO
			if err := rows.Scan(
				&b.ID, &b.BillCode, &b.DepartmentID, &b.DepartmentName, &b.DepartmentShortName, &b.DepartmentCostCenter,
				&b.UtilityType, &b.BillingMonth, &b.BillingYear, &b.Provider, &b.ServiceNumber,
				&b.ServiceBreakdown, &b.InvoiceNumber, &b.InvoiceDate, &b.LocationType,
				&b.UsageAmount, &b.InvoiceAmount, &b.EstimatedAmount, &b.ReceivedDate,
				&b.SentToDisbursingDate, &b.DisbursingReceivedDate, &b.PaymentDate,
				&b.PaymentDocNumber, &b.DocType, &b.AccountCode, &b.BudgetCode, &b.FundSource,
				&b.PaidAmount, &b.PaymentStatus, &b.InvoiceStatus, &b.ReceiptNumber,
				&b.ReceiptDate, &b.ReceiptPaymentDate, &b.AttachmentInvoice, &b.AttachmentReceipt,
				&b.AttachmentPaymentDoc, &b.AttachmentDirectPayment, &b.AttachmentKtbReport,
				&b.IsPendingBillOnly, &b.DepositUnitID, &b.DepositUnitName, &b.IsReviewed,
				&b.ReviewedBy, &b.ReviewedAt, &b.AuditStatus, &b.IsLateReceive, &b.IsLatePayment,
				&b.IsOverdueMoreThan2Months, &b.IsDisbursementOver2Months, &b.IsWrongMonth,
				&b.IsPhoneOverLimit, &b.IsPhoneUsageOverLimit, &b.IsWrongBudget,
				&b.IsDuplicate, &b.IsAnomalyExpense, &b.IsManualAnomaly, &b.ManualAnomalyReason, &b.ManualAnomalyDetail,
				&b.CreatedAt, &b.UpdatedAt,
			); err == nil {
				results = append(results, b)
			}
		}

		return &ListBillsOutput{Body: results}, nil
	})

	// Create Bill
	huma.Register(api, huma.Operation{
		OperationID: "createBill",
		Method:      http.MethodPost,
		Path:        "/api/bills",
		Summary:     "Create a new utility bill",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *CreateBillInput) (*SingleBillOutput, error) {
		user, hasUser := auth.UserFromContext(ctx)
		userID := "system"
		if hasUser && user != nil {
			userID = user.UserID
			allowed := map[string]bool{
				"admin": true, "central_staff": true, "regional_staff": true,
				"user": true, "strategy_finance": true, "auditor": true,
			}
			if !allowed[user.Role] {
				return nil, huma.Error403Forbidden("forbidden: insufficient permissions")
			}
		}

		// Check for duplicate bills with any overlapping service number in the same month & year
		if input.Body.ServiceNumber != nil && *input.Body.ServiceNumber != "" {
			inputParts := strings.Split(*input.Body.ServiceNumber, ",")
			var cleanNumbers []string
			for _, part := range inputParts {
				t := strings.TrimSpace(part)
				if t != "" {
					cleanNumbers = append(cleanNumbers, t)
				}
			}

			if len(cleanNumbers) > 0 {
				dupRows, err := pool.Query(ctx, `
					SELECT b.id, b.bill_code, b.service_number
					FROM utility_bills b
					WHERE b.billing_month = $1 AND b.billing_year = $2
					  AND ($3 = '' OR b.department_id = $3 OR b.deposit_unit_id = $3)
				`, input.Body.BillingMonth, input.Body.BillingYear, input.Body.DepartmentID)
				if err == nil {
					defer dupRows.Close()
					for dupRows.Next() {
						var dID, dCode, dSN string
						if err := dupRows.Scan(&dID, &dCode, &dSN); err == nil {
							existingParts := strings.Split(dSN, ",")
							for _, ep := range existingParts {
								cleanedExisting := strings.TrimSpace(ep)
								for _, inp := range cleanNumbers {
									if strings.EqualFold(cleanedExisting, inp) {
										return nil, huma.Error400BadRequest(fmt.Sprintf(
											"หมายเลข %s ได้รับการบันทึกบิลประจำเดือน %d/%d ไปแล้ว (รหัสบิล: %s) ไม่อนุญาตให้บันทึกซ้ำ",
											inp, input.Body.BillingMonth, input.Body.BillingYear, dCode,
										))
									}
								}
							}
						}
					}
				}
			}
		}

		billID := uuid.New().String()

		// 1. Fetch Department Cost Center for Bill Code Generation
		var costCenterCode string
		deptTargetID := input.Body.DepartmentID
		if input.Body.DepositUnitID != nil && *input.Body.DepositUnitID != "" {
			deptTargetID = *input.Body.DepositUnitID
		}
		_ = pool.QueryRow(ctx, "SELECT cost_center_code FROM departments WHERE id = $1", deptTargetID).Scan(&costCenterCode)

		// 2. Generate Bill Code
		prefix := service.GenerateBillPrefix(costCenterCode, input.Body.BillingYear, input.Body.BillingMonth, input.Body.UtilityType)
		var latestCode string
		_ = pool.QueryRow(ctx, `
			SELECT bill_code FROM (
				SELECT bill_code FROM utility_bills WHERE bill_code LIKE $1
				UNION ALL
				SELECT bill_code FROM archived_utility_bills WHERE bill_code LIKE $1
			) combined
			ORDER BY bill_code DESC
			LIMIT 1
		`, prefix+"%").Scan(&latestCode)
		billCode := service.GenerateNextBillCode(prefix, latestCode)

		// 3. Insert Bill
		_, err := pool.Exec(ctx, `
			INSERT INTO utility_bills (
				id, bill_code, department_id, utility_type, billing_month, billing_year,
				provider, service_number, service_breakdown, invoice_number, invoice_date,
				location_type, usage_amount, invoice_amount, estimated_amount,
				received_date, sent_to_disbursing_date, disbursing_received_date,
				payment_date, payment_doc_number, doc_type, account_code, budget_code,
				fund_source, paid_amount, payment_status, invoice_status,
				receipt_number, receipt_date, receipt_payment_date,
				attachment_invoice, attachment_receipt, attachment_payment_doc,
				attachment_direct_payment, attachment_ktb_report,
				is_pending_bill_only, deposit_unit_id,
				created_by, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
				$16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
				$28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, NOW(), NOW()
			)
		`, billID, billCode, input.Body.DepartmentID, input.Body.UtilityType, input.Body.BillingMonth, input.Body.BillingYear,
			input.Body.Provider, input.Body.ServiceNumber, input.Body.ServiceBreakdown, input.Body.InvoiceNumber, input.Body.InvoiceDate,
			input.Body.LocationType, input.Body.UsageAmount, input.Body.InvoiceAmount, input.Body.EstimatedAmount,
			input.Body.ReceivedDate, input.Body.SentToDisbursingDate, input.Body.DisbursingReceivedDate,
			input.Body.PaymentDate, input.Body.PaymentDocNumber, input.Body.DocType, input.Body.AccountCode, input.Body.BudgetCode,
			input.Body.FundSource, input.Body.PaidAmount, input.Body.PaymentStatus, input.Body.InvoiceStatus,
			input.Body.ReceiptNumber, input.Body.ReceiptDate, input.Body.ReceiptPaymentDate,
			input.Body.AttachmentInvoice, input.Body.AttachmentReceipt, input.Body.AttachmentPaymentDoc,
			input.Body.AttachmentDirectPayment, input.Body.AttachmentKtbReport,
			input.Body.IsPendingBillOnly, input.Body.DepositUnitID, userID,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create utility bill: " + err.Error())
		}

		// 4. Run Audit Check
		_ = service.RunAuditChecks(ctx, pool, billID, userID, true)

		// 5. Activity Log
		logID := uuid.New().String()
		_, _ = pool.Exec(ctx, `
			INSERT INTO bill_activity_logs (id, bill_id, user_id, action, details, created_at)
			VALUES ($1, $2, $3, 'CREATED', 'บันทึกค่าใช้จ่ายใหม่', NOW())
		`, logID, billID, userID)

		if searchService != nil {
			go func(id string) {
				bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				defer cancel()
				_ = searchService.UpsertBillEmbedding(bgCtx, id)
			}(billID)
		}

		return &SingleBillOutput{
			Body: BillDTO{
				ID:            billID,
				BillCode:      &billCode,
				DepartmentID:  input.Body.DepartmentID,
				UtilityType:   input.Body.UtilityType,
				BillingMonth:  input.Body.BillingMonth,
				BillingYear:   input.Body.BillingYear,
				InvoiceAmount: input.Body.InvoiceAmount,
				PaymentStatus: input.Body.PaymentStatus,
				InvoiceStatus: input.Body.InvoiceStatus,
				CreatedAt:     time.Now(),
			},
		}, nil
	})

	// Delete Bill (Soft-Delete: Move to Archived Bills + Log)
	huma.Register(api, huma.Operation{
		OperationID: "deleteBill",
		Method:      http.MethodDelete,
		Path:        "/api/bills/{id}",
		Summary:     "Move a utility bill to archived bills (soft-delete with audit log)",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID     string `path:"id" doc:"Bill unique ID"`
		Reason string `query:"reason" doc:"Optional reason for moving bill to archive"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}
		if err := archiveBillTx(ctx, pool, user, input.ID, input.Reason, searchService); err != nil {
			return nil, err
		}
		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Get Single Bill
	huma.Register(api, huma.Operation{
		OperationID: "getBill",
		Method:      http.MethodGet,
		Path:        "/api/bills/{id}",
		Summary:     "Get a single utility bill by ID",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id" doc:"Bill unique ID"`
	}) (*SingleBillOutput, error) {
		query := `
			SELECT b.id, b.bill_code, b.department_id, d.full_name, d.short_name, d.cost_center_code,
			       b.utility_type, b.billing_month, b.billing_year, b.provider, b.service_number,
			       b.service_breakdown, b.invoice_number, b.invoice_date, b.location_type,
			       b.usage_amount, b.invoice_amount, b.estimated_amount, b.received_date,
			       b.sent_to_disbursing_date, b.disbursing_received_date, b.payment_date,
			       b.payment_doc_number, b.doc_type, b.account_code, b.budget_code, b.fund_source,
			       b.paid_amount, b.payment_status, b.invoice_status, b.receipt_number,
			       b.receipt_date, b.receipt_payment_date, b.attachment_invoice, b.attachment_receipt,
			       b.attachment_payment_doc, b.attachment_direct_payment, b.attachment_ktb_report,
			       b.is_pending_bill_only, b.deposit_unit_id, dep_unit.full_name, b.is_reviewed,
			       COALESCE(u_rev.name, b.reviewed_by) AS reviewed_by, b.reviewed_at, a.status, a.is_late_receive, a.is_late_payment,
			       a.is_overdue_more_than_2_months, a.is_disbursement_over_2_months, a.is_wrong_month,
			       a.is_phone_over_limit, a.is_phone_usage_over_limit, a.is_wrong_budget,
			       a.is_duplicate, a.is_anomaly_expense, a.is_manual_anomaly, a.manual_anomaly_reason, a.manual_anomaly_detail,
			       b.created_at, b.updated_at
			FROM utility_bills b
			LEFT JOIN departments d ON b.department_id = d.id
			LEFT JOIN departments dep_unit ON b.deposit_unit_id = dep_unit.id
			LEFT JOIN audits a ON b.id = a.utility_bill_id
			LEFT JOIN "user" u_rev ON b.reviewed_by = u_rev.id
			WHERE b.id = $1
		`
		var b BillDTO
		err := pool.QueryRow(ctx, query, input.ID).Scan(
			&b.ID, &b.BillCode, &b.DepartmentID, &b.DepartmentName, &b.DepartmentShortName, &b.DepartmentCostCenter,
			&b.UtilityType, &b.BillingMonth, &b.BillingYear, &b.Provider, &b.ServiceNumber,
			&b.ServiceBreakdown, &b.InvoiceNumber, &b.InvoiceDate, &b.LocationType,
			&b.UsageAmount, &b.InvoiceAmount, &b.EstimatedAmount, &b.ReceivedDate,
			&b.SentToDisbursingDate, &b.DisbursingReceivedDate, &b.PaymentDate,
			&b.PaymentDocNumber, &b.DocType, &b.AccountCode, &b.BudgetCode, &b.FundSource,
			&b.PaidAmount, &b.PaymentStatus, &b.InvoiceStatus, &b.ReceiptNumber,
			&b.ReceiptDate, &b.ReceiptPaymentDate, &b.AttachmentInvoice, &b.AttachmentReceipt,
			&b.AttachmentPaymentDoc, &b.AttachmentDirectPayment, &b.AttachmentKtbReport,
			&b.IsPendingBillOnly, &b.DepositUnitID, &b.DepositUnitName, &b.IsReviewed,
			&b.ReviewedBy, &b.ReviewedAt, &b.AuditStatus, &b.IsLateReceive, &b.IsLatePayment,
			&b.IsOverdueMoreThan2Months, &b.IsDisbursementOver2Months, &b.IsWrongMonth,
			&b.IsPhoneOverLimit, &b.IsPhoneUsageOverLimit, &b.IsWrongBudget,
			&b.IsDuplicate, &b.IsAnomalyExpense, &b.IsManualAnomaly, &b.ManualAnomalyReason, &b.ManualAnomalyDetail,
			&b.CreatedAt, &b.UpdatedAt,
		)
		if err != nil {
			return nil, huma.Error404NotFound("ไม่พบบิลค่าใช้จ่ายที่ระบุ")
		}
		return &SingleBillOutput{Body: b}, nil
	})

	// Update Bill
	huma.Register(api, huma.Operation{
		OperationID: "updateBill",
		Method:      http.MethodPut,
		Path:        "/api/bills/{id}",
		Summary:     "Update a utility bill",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *UpdateBillInput) (*SingleBillOutput, error) {
		user, hasUser := auth.UserFromContext(ctx)
		userID := "system"
		if hasUser && user != nil {
			userID = user.UserID
			allowed := map[string]bool{
				"admin": true, "central_staff": true, "regional_staff": true,
				"user": true, "strategy_finance": true, "auditor": true,
			}
			if !allowed[user.Role] {
				return nil, huma.Error403Forbidden("forbidden: insufficient permissions")
			}
		}

		// Update Bill
		_, err := pool.Exec(ctx, `
			UPDATE utility_bills SET
				department_id = $1, utility_type = $2, billing_month = $3, billing_year = $4,
				provider = $5, service_number = $6, service_breakdown = $7, invoice_number = $8, invoice_date = $9,
				location_type = $10, usage_amount = $11, invoice_amount = $12, estimated_amount = $13,
				received_date = $14, sent_to_disbursing_date = $15, disbursing_received_date = $16,
				payment_date = $17, payment_doc_number = $18, doc_type = $19, account_code = $20, budget_code = $21,
				fund_source = $22, paid_amount = $23, payment_status = $24, invoice_status = $25,
				receipt_number = $26, receipt_date = $27, receipt_payment_date = $28,
				attachment_invoice = CASE WHEN $29 IS NOT NULL THEN NULLIF($29, '') ELSE attachment_invoice END,
				attachment_receipt = CASE WHEN $30 IS NOT NULL THEN NULLIF($30, '') ELSE attachment_receipt END,
				attachment_payment_doc = CASE WHEN $31 IS NOT NULL THEN NULLIF($31, '') ELSE attachment_payment_doc END,
				attachment_direct_payment = CASE WHEN $32 IS NOT NULL THEN NULLIF($32, '') ELSE attachment_direct_payment END,
				attachment_ktb_report = CASE WHEN $33 IS NOT NULL THEN NULLIF($33, '') ELSE attachment_ktb_report END,
				is_pending_bill_only = $34, deposit_unit_id = $35, updated_at = NOW()
			WHERE id = $36
		`, input.Body.DepartmentID, input.Body.UtilityType, input.Body.BillingMonth, input.Body.BillingYear,
			input.Body.Provider, input.Body.ServiceNumber, input.Body.ServiceBreakdown, input.Body.InvoiceNumber, input.Body.InvoiceDate,
			input.Body.LocationType, input.Body.UsageAmount, input.Body.InvoiceAmount, input.Body.EstimatedAmount,
			input.Body.ReceivedDate, input.Body.SentToDisbursingDate, input.Body.DisbursingReceivedDate,
			input.Body.PaymentDate, input.Body.PaymentDocNumber, input.Body.DocType, input.Body.AccountCode, input.Body.BudgetCode,
			input.Body.FundSource, input.Body.PaidAmount, input.Body.PaymentStatus, input.Body.InvoiceStatus,
			input.Body.ReceiptNumber, input.Body.ReceiptDate, input.Body.ReceiptPaymentDate,
			input.Body.AttachmentInvoice, input.Body.AttachmentReceipt, input.Body.AttachmentPaymentDoc,
			input.Body.AttachmentDirectPayment, input.Body.AttachmentKtbReport,
			input.Body.IsPendingBillOnly, input.Body.DepositUnitID, input.ID,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update utility bill: " + err.Error())
		}

		// Check if this bill was flagged with a manual anomaly
		var auditInfo struct {
			id              string
			isManualAnomaly bool
			status          string
		}
		_ = pool.QueryRow(ctx, `
			SELECT id, is_manual_anomaly, status 
			FROM audits 
			WHERE utility_bill_id = $1
		`, input.ID).Scan(&auditInfo.id, &auditInfo.isManualAnomaly, &auditInfo.status)

		// Re-evaluate Audits
		_ = service.RunAuditChecks(ctx, pool, input.ID, userID, true)

		// If the bill was flagged as abnormal, set status to 'PENDING_RECHECK' (รอตรวจสอบใหม่)
		logDetail := "แก้ไขข้อมูลบิลค่าใช้จ่าย"
		if auditInfo.isManualAnomaly {
			_, _ = pool.Exec(ctx, `
				UPDATE audits 
				SET status = 'PENDING_RECHECK', updated_at = NOW()
				WHERE utility_bill_id = $1
			`, input.ID)

			logDetail = "แก้ไขข้อมูลบิลหลังได้รับข้อสังเกตความผิดปกติ (รอตรวจสอบใหม่)"

			// Mark unread manual anomaly notification as acknowledged/read
			anomalyLink := fmt.Sprintf("/bills/%s/edit", input.ID)
			_, _ = pool.Exec(ctx, `
				UPDATE notifications 
				SET is_read = true, 
				    acknowledged_reason = 'หน่วยงานแก้ไขข้อมูลบิลแล้ว (รอตรวจสอบใหม่)', 
				    acknowledged_at = NOW(), 
				    updated_at = NOW()
				WHERE link = $1 AND type = 'MANUAL_ANOMALY' AND is_read = false
			`, anomalyLink)

			// Notify auditor that the bill has been edited and is awaiting recheck
			var notifInfo struct {
				deptName    string
				utilityType string
				billMonth   int
				billYear    int
				billCode    *string
				serviceNum  *string
			}
			_ = pool.QueryRow(ctx, `
				SELECT COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'), b.utility_type, b.billing_month, b.billing_year, b.bill_code, b.service_number
				FROM utility_bills b
				LEFT JOIN departments d ON b.department_id = d.id
				WHERE b.id = $1
			`, input.ID).Scan(&notifInfo.deptName, &notifInfo.utilityType, &notifInfo.billMonth, &notifInfo.billYear, &notifInfo.billCode, &notifInfo.serviceNum)

			thaiMonths := []string{"", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."}
			mName := ""
			if notifInfo.billMonth >= 1 && notifInfo.billMonth <= 12 {
				mName = thaiMonths[notifInfo.billMonth]
			}
			bCode := ""
			if notifInfo.billCode != nil && *notifInfo.billCode != "" {
				bCode = fmt.Sprintf(" (รหัสบิล: %s)", *notifInfo.billCode)
			}
			sNum := "-"
			if notifInfo.serviceNum != nil && *notifInfo.serviceNum != "" {
				sNum = *notifInfo.serviceNum
			}

			notifTitle := "บิลที่พบข้อสังเกตได้รับการแก้ไขแล้ว (รอตรวจสอบใหม่)"
			notifMsg := fmt.Sprintf("[%s] รายการ%s รอบบิล %s %d%s หมายเลข: %s ได้รับการแก้ไขข้อมูลแล้ว กรุณาตรวจสอบใหม่",
				notifInfo.deptName, notifInfo.utilityType, mName, notifInfo.billYear+543, bCode, sNum)
			billLink := fmt.Sprintf("/bills?id=%s", input.ID)

			notifID := uuid.New().String()
			_, _ = pool.Exec(ctx, `
				INSERT INTO notifications (id, target_role, title, message, type, severity, is_read, link, created_at, updated_at)
				VALUES ($1, 'auditor', $2, $3, 'MANUAL_ANOMALY_EDITED', 'INFO', false, $4, NOW(), NOW())
			`, notifID, notifTitle, notifMsg, billLink)

			_, _ = pool.Exec(ctx, `SELECT pg_notify('notifications', $1)`, fmt.Sprintf(`{"action":"anomaly_edited","billId":"%s"}`, input.ID))
		}

		// Activity Log
		logID := uuid.New().String()
		_, _ = pool.Exec(ctx, `
			INSERT INTO bill_activity_logs (id, bill_id, user_id, action, details, created_at)
			VALUES ($1, $2, $3, 'UPDATED', $4, NOW())
		`, logID, input.ID, userID, logDetail)

		// Return updated bill
		var b BillDTO
		var auditStatus *string
		_ = pool.QueryRow(ctx, `
			SELECT b.id, b.bill_code, b.department_id, b.utility_type, b.billing_month, b.billing_year, 
			       b.invoice_amount, b.payment_status, b.invoice_status, a.status, b.created_at, b.updated_at 
			FROM utility_bills b 
			LEFT JOIN audits a ON b.id = a.utility_bill_id 
			WHERE b.id = $1
		`, input.ID).Scan(
			&b.ID, &b.BillCode, &b.DepartmentID, &b.UtilityType, &b.BillingMonth, &b.BillingYear, 
			&b.InvoiceAmount, &b.PaymentStatus, &b.InvoiceStatus, &auditStatus, &b.CreatedAt, &b.UpdatedAt,
		)
		b.AuditStatus = auditStatus
		if searchService != nil {
			go func(id string) {
				bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				defer cancel()
				_ = searchService.UpsertBillEmbedding(bgCtx, id)
			}(input.ID)
		}
		return &SingleBillOutput{Body: b}, nil
	})

	// Get Estimated Amount
	huma.Register(api, huma.Operation{
		OperationID: "getEstimatedAmount",
		Method:      http.MethodGet,
		Path:        "/api/bills/estimated-amount",
		Summary:     "Get previous month invoice amount for a service number",
		Tags:        []string{"Bills"},
	}, func(ctx context.Context, input *struct {
		ServiceNumber string `query:"serviceNumber" doc:"Service number"`
		Month         int    `query:"month" doc:"Current billing month"`
		Year          int    `query:"year" doc:"Current billing year"`
	}) (*struct{ Body *float64 `json:"body"` }, error) {
		var amount *float64
		err := pool.QueryRow(ctx, `
			SELECT invoice_amount
			FROM utility_bills
			WHERE service_number = $1
			  AND invoice_amount IS NOT NULL
			  AND (billing_year * 12 + billing_month) < ($2 * 12 + $3)
			ORDER BY billing_year DESC, billing_month DESC
			LIMIT 1
		`, input.ServiceNumber, input.Year, input.Month).Scan(&amount)
		if err != nil && err != pgx.ErrNoRows {
			return nil, huma.Error500InternalServerError("failed to fetch estimated amount")
		}
		return &struct{ Body *float64 `json:"body"` }{Body: amount}, nil
	})

	// Mark Bill as Reviewed
	huma.Register(api, huma.Operation{
		OperationID: "reviewBill",
		Method:      http.MethodPut,
		Path:        "/api/bills/{id}/review",
		Summary:     "Mark bill as reviewed or unreviewed",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID   string `path:"id" doc:"Bill unique ID"`
		Body struct {
			IsReviewed bool `json:"isReviewed"`
		}
	}) (*struct{ Body bool `json:"body"` }, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("unauthorized")
		}
		if !HasRolePermission(ctx, pool, user.Role, "/bills:review", "/all-bills:review") {
			if user.Role != "admin" && user.Role != "auditor" && user.Role != "strategy_finance" && user.Role != "central_staff" {
				return nil, huma.Error403Forbidden("forbidden: insufficient permissions")
			}
		}

		var err error
		var reviewedBy *string
		var reviewedAt *time.Time
		if input.Body.IsReviewed {
			displayName := user.Name
			if displayName == "" {
				var name string
				if err := pool.QueryRow(ctx, `SELECT name FROM "user" WHERE id = $1`, user.UserID).Scan(&name); err == nil && name != "" {
					displayName = name
				} else if user.Email != "" {
					displayName = user.Email
				} else {
					displayName = user.UserID
				}
			}
			reviewedBy = &displayName
			now := time.Now()
			reviewedAt = &now
		}

		_, err = pool.Exec(ctx, `
			UPDATE utility_bills SET is_reviewed = $1, reviewed_by = $2, reviewed_at = $3, updated_at = NOW()
			WHERE id = $4
		`, input.Body.IsReviewed, reviewedBy, reviewedAt, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update review status")
		}

		logID := uuid.New().String()
		actionDetails := "ตรวจสอบรายการบิลเรียบร้อยแล้ว"
		if input.Body.IsReviewed && reviewedBy != nil {
			actionDetails = fmt.Sprintf("ตรวจสอบรายการบิลเรียบร้อยแล้ว โดย %s", *reviewedBy)
		} else if !input.Body.IsReviewed {
			actionDetails = "ยกเลิกการตรวจสอบบิล"
		}
		_, _ = pool.Exec(ctx, `
			INSERT INTO bill_activity_logs (id, bill_id, user_id, action, details, created_at)
			VALUES ($1, $2, $3, 'AUDITED', $4, NOW())
		`, logID, input.ID, user.UserID, actionDetails)

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Get Bill Activity Logs
	huma.Register(api, huma.Operation{
		OperationID: "getBillLogs",
		Method:      http.MethodGet,
		Path:        "/api/bills/{id}/logs",
		Summary:     "Get activity logs for a bill",
		Tags:        []string{"Bills"},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id"`
	}) (*ListBillLogsOutput, error) {
		rows, err := pool.Query(ctx, `
			SELECT l.id, l.bill_id, l.user_id, u.name, u.email, l.action, l.details, l.created_at
			FROM bill_activity_logs l
			LEFT JOIN "user" u ON l.user_id = u.id
			WHERE l.bill_id = $1
			ORDER BY l.created_at DESC
		`, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch logs")
		}
		defer rows.Close()

		var logs []ActivityLogDTO
		for rows.Next() {
			var l ActivityLogDTO
			if err := rows.Scan(&l.ID, &l.BillID, &l.UserID, &l.UserName, &l.UserEmail, &l.Action, &l.Details, &l.CreatedAt); err == nil {
				logs = append(logs, l)
			}
		}
		return &ListBillLogsOutput{Body: logs}, nil
	})

	// Bill Tracking
	huma.Register(api, huma.Operation{
		OperationID: "getBillTracking",
		Method:      http.MethodGet,
		Path:        "/api/bills/tracking",
		Summary:     "Get monthly utility bill tracking status vs expected services",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *GetBillTrackingInput) (*BillTrackingOutput, error) {
		sess, err := auth.RequireRoles(ctx, "admin", "auditor", "strategy_finance", "central_staff", "regional_staff", "user")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		month := input.Month
		if month <= 0 || month > 12 {
			month = int(time.Now().Month())
		}
		year := input.Year
		if year <= 0 {
			year = time.Now().Year()
		}

		isGlobalView := sess.Role == "admin" || sess.Role == "auditor" || sess.Role == "strategy_finance"

		deptFilter := ""
		if !isGlobalView && sess.DepartmentID != "" {
			deptFilter = sess.DepartmentID
		} else if input.DepartmentID != "" {
			deptFilter = input.DepartmentID
		}

		// 1. Fetch expected services
		servicesQuery := `
			SELECT ds.id, ds.department_id, ds.utility_type, ds.provider, ds.service_number, COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน')
			FROM department_services ds
			LEFT JOIN departments d ON d.id = ds.department_id
			WHERE ($1 = '' OR ds.department_id = $1)
		`
		sRows, err := pool.Query(ctx, servicesQuery, deptFilter)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch services")
		}
		defer sRows.Close()

		type rawService struct {
			ID             string
			DepartmentID   string
			UtilityType    string
			Provider       string
			ServiceNumber  string
			DepartmentName string
		}
		var services []rawService
		for sRows.Next() {
			var s rawService
			if err := sRows.Scan(&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.DepartmentName); err == nil {
				services = append(services, s)
			}
		}

		// 2. Fetch bills for the month & year
		billsQuery := `
			SELECT b.id, b.department_id, b.deposit_unit_id, dep_u.full_name AS deposit_unit_name,
			       b.utility_type, COALESCE(b.provider, ''),
			       COALESCE(b.service_number, ''), b.service_breakdown, b.invoice_status, b.payment_status,
			       COALESCE(b.invoice_amount, 0), b.paid_amount,
			       COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			       b.bill_code, b.invoice_number, b.payment_doc_number,
			       b.attachment_receipt,
			       b.is_reviewed,
			       COALESCE(u_rev.name, b.reviewed_by) AS reviewed_by,
			       b.reviewed_at,
			       a.status AS audit_status,
			       COALESCE(a.is_manual_anomaly, false) AS is_manual_anomaly,
			       a.manual_anomaly_reason,
			       a.manual_anomaly_detail,
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
			       a.remarks
			FROM utility_bills b
			LEFT JOIN departments d ON d.id = b.department_id
			LEFT JOIN departments dep_u ON dep_u.id = b.deposit_unit_id
			LEFT JOIN audits a ON a.utility_bill_id = b.id
			LEFT JOIN "user" u_rev ON b.reviewed_by = u_rev.id
			WHERE b.billing_month = $1 AND b.billing_year = $2
			  AND ($3 = '' OR b.department_id = $3 OR b.deposit_unit_id = $3)
		`
		bRows, err := pool.Query(ctx, billsQuery, month, year, deptFilter)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch bills")
		}
		defer bRows.Close()

		type rawBill struct {
			ID                        string
			DepartmentID              string
			DepositUnitID             *string
			DepositUnitName           *string
			UtilityType               string
			Provider                  string
			ServiceNumber             string
			ServiceBreakdown          *string
			InvoiceStatus             string
			PaymentStatus             string
			Amount                    float64
			PaidAmount                *float64
			DepartmentName            string
			BillCode                  *string
			InvoiceNumber             *string
			PaymentDocNumber          *string
			AttachmentReceipt         *string
			IsReviewed                bool
			ReviewedBy                *string
			ReviewedAt                *time.Time
			AuditStatus               *string
			IsManualAnomaly           bool
			ManualAnomalyReason       *string
			ManualAnomalyDetail       *string
			IsLateReceive             bool
			IsLatePayment             bool
			IsOverdueMoreThan2Months  bool
			IsDisbursementOver2Months bool
			IsWrongMonth              bool
			IsPhoneOverLimit          bool
			IsPhoneUsageOverLimit     bool
			IsWrongBudget             bool
			IsDuplicate               bool
			IsAnomalyExpense          bool
			Remarks                   *string
		}
		var flattenedBills []rawBill
		for bRows.Next() {
			var b rawBill
			if err := bRows.Scan(
				&b.ID, &b.DepartmentID, &b.DepositUnitID, &b.DepositUnitName,
				&b.UtilityType, &b.Provider, &b.ServiceNumber, &b.ServiceBreakdown, &b.InvoiceStatus, &b.PaymentStatus,
				&b.Amount, &b.PaidAmount, &b.DepartmentName,
				&b.BillCode, &b.InvoiceNumber, &b.PaymentDocNumber,
				&b.AttachmentReceipt,
				&b.IsReviewed, &b.ReviewedBy, &b.ReviewedAt,
				&b.AuditStatus, &b.IsManualAnomaly, &b.ManualAnomalyReason, &b.ManualAnomalyDetail,
				&b.IsLateReceive, &b.IsLatePayment, &b.IsOverdueMoreThan2Months,
				&b.IsDisbursementOver2Months, &b.IsWrongMonth, &b.IsPhoneOverLimit,
				&b.IsPhoneUsageOverLimit, &b.IsWrongBudget, &b.IsDuplicate,
				&b.IsAnomalyExpense, &b.Remarks,
			); err == nil {
				if strings.Contains(b.ServiceNumber, ",") {
					parts := strings.Split(b.ServiceNumber, ",")
					var breakdown map[string]string
					if b.ServiceBreakdown != nil && *b.ServiceBreakdown != "" {
						_ = json.Unmarshal([]byte(*b.ServiceBreakdown), &breakdown)
					}
					for _, part := range parts {
						p := strings.TrimSpace(part)
						if p != "" {
							clone := b
							clone.ServiceNumber = p
							if breakdown != nil {
								if amtStr, ok := breakdown[p]; ok {
									if parsedAmt, err := strconv.ParseFloat(amtStr, 64); err == nil {
										clone.Amount = parsedAmt
									}
								}
							} else if len(parts) > 0 {
								clone.Amount = b.Amount / float64(len(parts))
							}
							flattenedBills = append(flattenedBills, clone)
						}
					}
				} else {
					flattenedBills = append(flattenedBills, b)
				}
			}
		}

		// 3. Match services & bills
		var items []BillTrackingItemDTO
		processedBillKeys := make(map[string]bool)

		for _, s := range services {
			var matching []rawBill
			for _, b := range flattenedBills {
				if b.DepartmentID == s.DepartmentID && b.UtilityType == s.UtilityType && b.ServiceNumber == s.ServiceNumber {
					matching = append(matching, b)
				}
			}

			if len(matching) > 0 {
				for _, bill := range matching {
					key := fmt.Sprintf("%s-%s", bill.ID, bill.ServiceNumber)
					processedBillKeys[key] = true

					status := "UNKNOWN"
					if bill.InvoiceStatus == "NOT_RECEIVED" {
						status = "NOT_RECEIVED"
					} else if bill.InvoiceStatus == "RECEIVED" && bill.PaymentStatus == "PENDING" {
						status = "PENDING_PAYMENT"
					} else if bill.PaymentStatus == "PAID" {
						status = "PAID"
					}

					billID := bill.ID
					auditStatusStr := "NORMAL"
					if bill.AuditStatus != nil && *bill.AuditStatus != "" {
						auditStatusStr = *bill.AuditStatus
					}
					isReviewedVal := bill.IsReviewed
					isManualAnomalyVal := bill.IsManualAnomaly

					var auditIssues []string
					if bill.IsLateReceive {
						auditIssues = append(auditIssues, "ลงรับใบแจ้งหนี้ล่าช้า")
					}
					if bill.IsLatePayment {
						auditIssues = append(auditIssues, "เบิกจ่ายล่าช้า")
					}
					if bill.IsOverdueMoreThan2Months {
						auditIssues = append(auditIssues, "ค้างชำระเกิน 2 เดือน")
					}
					if bill.IsDisbursementOver2Months {
						auditIssues = append(auditIssues, "เบิกจ่ายเกิน 2 เดือน")
					}
					if bill.IsWrongMonth {
						auditIssues = append(auditIssues, "เบิกจ่ายผิดเดือน")
					}
					if bill.IsPhoneOverLimit {
						auditIssues = append(auditIssues, "เบิกค่าโทรศัพท์เกินเกณฑ์")
					}
					if bill.IsPhoneUsageOverLimit {
						auditIssues = append(auditIssues, "ใช้ค่าโทรศัพท์เกินเกณฑ์")
					}
					if bill.IsWrongBudget {
						auditIssues = append(auditIssues, "เบิกจ่ายผิดงบประมาณ")
					}
					if bill.IsDuplicate {
						auditIssues = append(auditIssues, "เบิกจ่ายซ้ำซ้อน")
					}
					if bill.IsAnomalyExpense {
						auditIssues = append(auditIssues, "ค่าใช้จ่ายสูงผิดปกติ")
					}
					if bill.IsManualAnomaly && bill.ManualAnomalyReason != nil && *bill.ManualAnomalyReason != "" {
						auditIssues = append(auditIssues, fmt.Sprintf("ระบุข้อผิดปกติ: %s", *bill.ManualAnomalyReason))
					}
					if bill.Remarks != nil && *bill.Remarks != "" {
						auditIssues = append(auditIssues, fmt.Sprintf("หมายเหตุ: %s", *bill.Remarks))
					}

					items = append(items, BillTrackingItemDTO{
						ID:                  fmt.Sprintf("bill-%s-%s", bill.ID, bill.ServiceNumber),
						DepartmentID:        bill.DepartmentID,
						DepartmentName:      bill.DepartmentName,
						DepositUnitName:     bill.DepositUnitName,
						UtilityType:         bill.UtilityType,
						Provider:            bill.Provider,
						ServiceNumber:       bill.ServiceNumber,
						BillCode:            bill.BillCode,
						InvoiceNumber:       bill.InvoiceNumber,
						PaymentDocNumber:    bill.PaymentDocNumber,
						PaidAmount:          bill.PaidAmount,
						Amount:              bill.Amount,
						Status:              status,
						IsExpected:          true,
						BillID:              &billID,
						AttachmentReceipt:   bill.AttachmentReceipt,
						IsReviewed:          &isReviewedVal,
						ReviewedBy:          bill.ReviewedBy,
						ReviewedAt:          bill.ReviewedAt,
						AuditStatus:         &auditStatusStr,
						IsManualAnomaly:     &isManualAnomalyVal,
						ManualAnomalyReason: bill.ManualAnomalyReason,
						ManualAnomalyDetail: bill.ManualAnomalyDetail,
						AuditIssues:         auditIssues,
					})
				}
			} else {
				items = append(items, BillTrackingItemDTO{
					ID:             fmt.Sprintf("service-%s", s.ID),
					DepartmentID:   s.DepartmentID,
					DepartmentName: s.DepartmentName,
					UtilityType:    s.UtilityType,
					Provider:       s.Provider,
					ServiceNumber:  s.ServiceNumber,
					Amount:         0,
					Status:         "UNRECORDED",
					IsExpected:     true,
				})
			}
		}

		for _, bill := range flattenedBills {
			key := fmt.Sprintf("%s-%s", bill.ID, bill.ServiceNumber)
			if !processedBillKeys[key] {
				status := "UNKNOWN"
				if bill.InvoiceStatus == "NOT_RECEIVED" {
					status = "NOT_RECEIVED"
				} else if bill.InvoiceStatus == "RECEIVED" && bill.PaymentStatus == "PENDING" {
					status = "PENDING_PAYMENT"
				} else if bill.PaymentStatus == "PAID" {
					status = "PAID"
				}

				billID := bill.ID
				auditStatusStr := "NORMAL"
				if bill.AuditStatus != nil && *bill.AuditStatus != "" {
					auditStatusStr = *bill.AuditStatus
				}
				isReviewedVal := bill.IsReviewed
				isManualAnomalyVal := bill.IsManualAnomaly

				var auditIssues []string
				if bill.IsLateReceive {
					auditIssues = append(auditIssues, "ลงรับใบแจ้งหนี้ล่าช้า")
				}
				if bill.IsLatePayment {
					auditIssues = append(auditIssues, "เบิกจ่ายล่าช้า")
				}
				if bill.IsOverdueMoreThan2Months {
					auditIssues = append(auditIssues, "ค้างชำระเกิน 2 เดือน")
				}
				if bill.IsDisbursementOver2Months {
					auditIssues = append(auditIssues, "เบิกจ่ายเกิน 2 เดือน")
				}
				if bill.IsWrongMonth {
					auditIssues = append(auditIssues, "เบิกจ่ายผิดเดือน")
				}
				if bill.IsPhoneOverLimit {
					auditIssues = append(auditIssues, "เบิกค่าโทรศัพท์เกินเกณฑ์")
				}
				if bill.IsPhoneUsageOverLimit {
					auditIssues = append(auditIssues, "ใช้ค่าโทรศัพท์เกินเกณฑ์")
				}
				if bill.IsWrongBudget {
					auditIssues = append(auditIssues, "เบิกจ่ายผิดงบประมาณ")
				}
				if bill.IsDuplicate {
					auditIssues = append(auditIssues, "เบิกจ่ายซ้ำซ้อน")
				}
				if bill.IsAnomalyExpense {
					auditIssues = append(auditIssues, "ค่าใช้จ่ายสูงผิดปกติ")
				}
				if bill.IsManualAnomaly && bill.ManualAnomalyReason != nil && *bill.ManualAnomalyReason != "" {
					auditIssues = append(auditIssues, fmt.Sprintf("ระบุข้อผิดปกติ: %s", *bill.ManualAnomalyReason))
				}
				if bill.Remarks != nil && *bill.Remarks != "" {
					auditIssues = append(auditIssues, fmt.Sprintf("หมายเหตุ: %s", *bill.Remarks))
				}

				items = append(items, BillTrackingItemDTO{
					ID:                  fmt.Sprintf("bill-%s-%s", bill.ID, bill.ServiceNumber),
					DepartmentID:        bill.DepartmentID,
					DepartmentName:      bill.DepartmentName,
					DepositUnitName:     bill.DepositUnitName,
					UtilityType:         bill.UtilityType,
					Provider:            bill.Provider,
					ServiceNumber:       bill.ServiceNumber,
					BillCode:            bill.BillCode,
					InvoiceNumber:       bill.InvoiceNumber,
					PaymentDocNumber:    bill.PaymentDocNumber,
					PaidAmount:          bill.PaidAmount,
					Amount:              bill.Amount,
					Status:              status,
					IsExpected:          false,
					BillID:              &billID,
					AttachmentReceipt:   bill.AttachmentReceipt,
					IsReviewed:          &isReviewedVal,
					ReviewedBy:          bill.ReviewedBy,
					ReviewedAt:          bill.ReviewedAt,
					AuditStatus:         &auditStatusStr,
					IsManualAnomaly:     &isManualAnomalyVal,
					ManualAnomalyReason: bill.ManualAnomalyReason,
					ManualAnomalyDetail: bill.ManualAnomalyDetail,
					AuditIssues:         auditIssues,
				})
			}
		}

		// Calculate summary
		summary := BillTrackingSummaryDTO{
			Total: len(items),
		}
		for _, item := range items {
			switch item.Status {
			case "UNRECORDED":
				summary.Unrecorded++
			case "NOT_RECEIVED":
				summary.NotReceived++
			case "PENDING_PAYMENT":
				summary.Pending++
				summary.PendingAmount += item.Amount
			case "PAID":
				summary.Paid++
				summary.PaidAmount += item.Amount
			}

			if item.BillID != nil {
				if item.IsReviewed != nil && *item.IsReviewed {
					summary.Reviewed++
				} else {
					summary.Unreviewed++
				}

				if item.AuditStatus != nil {
					if *item.AuditStatus == "PENDING_CORRECTION" {
						if item.IsManualAnomaly != nil && *item.IsManualAnomaly {
							summary.ManualAnomaly++
						} else {
							summary.AnomalyIssues++
						}
					} else if *item.AuditStatus == "CORRECTED" {
						summary.Corrected++
					} else {
						summary.Normal++
					}
				} else {
					summary.Normal++
				}
			}
		}

		out := &BillTrackingOutput{}
		out.Body.Month = month
		out.Body.Year = year
		out.Body.Summary = summary
		out.Body.Items = items
		return out, nil
	})
}
