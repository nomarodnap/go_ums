package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditDTO struct {
	ID                        string    `json:"id"`
	UtilityBillID             string    `json:"utilityBillId"`
	BillCode                  *string   `json:"billCode,omitempty"`
	DepartmentName            *string   `json:"departmentName,omitempty"`
	UtilityType               *string   `json:"utilityType,omitempty"`
	InvoiceAmount             *float64  `json:"invoiceAmount,omitempty"`
	BillingMonth              *int      `json:"billingMonth,omitempty"`
	BillingYear               *int      `json:"billingYear,omitempty"`
	AuditorID                 string    `json:"auditorId"`
	IsLateReceive             bool      `json:"isLateReceive"`
	IsLatePayment             bool      `json:"isLatePayment"`
	IsOverdueMoreThan2Months  bool      `json:"isOverdueMoreThan2Months"`
	IsDisbursementOver2Months bool      `json:"isDisbursementOver2Months"`
	IsWrongMonth              bool      `json:"isWrongMonth"`
	IsPhoneOverLimit          bool      `json:"isPhoneOverLimit"`
	IsPhoneUsageOverLimit     bool      `json:"isPhoneUsageOverLimit"`
	IsWrongBudget             bool      `json:"isWrongBudget"`
	IsDuplicate               bool      `json:"isDuplicate"`
	IsAnomalyExpense          bool      `json:"isAnomalyExpense"`
	IsManualAnomaly           bool      `json:"isManualAnomaly"`
	Status                    string    `json:"status"`
	Remarks                   *string   `json:"remarks,omitempty"`
	ManualAnomalyReason       *string   `json:"manualAnomalyReason,omitempty"`
	AttachmentProof           *string   `json:"attachmentProof,omitempty"`
	CreatedAt                 time.Time `json:"createdAt"`
	UpdatedAt                 time.Time `json:"updatedAt"`
}

type ListAuditsOutput struct {
	Body []AuditDTO `json:"body"`
}

type FlagManualAnomalyInput struct {
	BillID string `path:"billId"`
	Body   struct {
		Reason string `json:"reason" minLength:"3" doc:"Reason for marking as manual anomaly"`
	}
}

type ResolveAuditInput struct {
	AuditID string `path:"auditId"`
	Body    struct {
		Remarks         string  `json:"remarks"`
		AttachmentProof *string `json:"attachmentProof,omitempty"`
	}
}

func RegisterAuditRoutes(api huma.API, pool *pgxpool.Pool) {
	// List Audits
	huma.Register(api, huma.Operation{
		OperationID: "listAudits",
		Method:      http.MethodGet,
		Path:        "/api/audits",
		Summary:     "List internal audits",
		Tags:        []string{"Audits"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Status string `query:"status" doc:"Filter by status: PENDING_CORRECTION or CORRECTED"`
	}) (*ListAuditsOutput, error) {
		query := `
			SELECT a.id, a.utility_bill_id, b.bill_code, d.full_name, b.utility_type,
			       b.invoice_amount, b.billing_month, b.billing_year, a.auditor_id,
			       a.is_late_receive, a.is_late_payment, a.is_overdue_more_than_2_months,
			       a.is_disbursement_over_2_months, a.is_wrong_month, a.is_phone_over_limit,
			       a.is_phone_usage_over_limit, a.is_wrong_budget, a.is_duplicate,
			       a.is_anomaly_expense, a.is_manual_anomaly, a.status, a.remarks,
			       a.manual_anomaly_reason, a.attachment_proof, a.created_at, a.updated_at
			FROM audits a
			JOIN utility_bills b ON a.utility_bill_id = b.id
			JOIN departments d ON b.department_id = d.id
		`
		var args []interface{}
		if input.Status != "" {
			query += " WHERE a.status = $1"
			args = append(args, input.Status)
		}
		query += " ORDER BY a.created_at DESC"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch audits")
		}
		defer rows.Close()

		var results []AuditDTO
		for rows.Next() {
			var a AuditDTO
			if err := rows.Scan(
				&a.ID, &a.UtilityBillID, &a.BillCode, &a.DepartmentName, &a.UtilityType,
				&a.InvoiceAmount, &a.BillingMonth, &a.BillingYear, &a.AuditorID,
				&a.IsLateReceive, &a.IsLatePayment, &a.IsOverdueMoreThan2Months,
				&a.IsDisbursementOver2Months, &a.IsWrongMonth, &a.IsPhoneOverLimit,
				&a.IsPhoneUsageOverLimit, &a.IsWrongBudget, &a.IsDuplicate,
				&a.IsAnomalyExpense, &a.IsManualAnomaly, &a.Status, &a.Remarks,
				&a.ManualAnomalyReason, &a.AttachmentProof, &a.CreatedAt, &a.UpdatedAt,
			); err == nil {
				results = append(results, a)
			}
		}

		return &ListAuditsOutput{Body: results}, nil
	})

	// Flag Manual Anomaly
	huma.Register(api, huma.Operation{
		OperationID: "flagManualAnomaly",
		Method:      http.MethodPost,
		Path:        "/api/audits/bills/{billId}/flag",
		Summary:     "Flag a bill as manual anomaly by auditor",
		Tags:        []string{"Audits"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *FlagManualAnomalyInput) (*struct{ Body bool `json:"body"` }, error) {
		user, err := auth.RequireRoles(ctx, "admin", "auditor")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		auditID := uuid.New().String()
		_, err = pool.Exec(ctx, `
			INSERT INTO audits (id, utility_bill_id, auditor_id, is_manual_anomaly, manual_anomaly_reason, status, created_at, updated_at)
			VALUES ($1, $2, $3, true, $4, 'PENDING_CORRECTION', NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET is_manual_anomaly = true, manual_anomaly_reason = EXCLUDED.manual_anomaly_reason, status = 'PENDING_CORRECTION', updated_at = NOW()
		`, auditID, input.BillID, user.UserID, input.Body.Reason)

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to flag anomaly")
		}

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Unflag Manual Anomaly
	huma.Register(api, huma.Operation{
		OperationID: "unflagManualAnomaly",
		Method:      http.MethodDelete,
		Path:        "/api/audits/bills/{billId}/flag",
		Summary:     "Remove manual anomaly flag from bill",
		Tags:        []string{"Audits"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		BillID string `path:"billId"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "auditor"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		_, err := pool.Exec(ctx, `
			UPDATE audits SET is_manual_anomaly = false, manual_anomaly_reason = NULL, updated_at = NOW()
			WHERE utility_bill_id = $1
		`, input.BillID)

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to unflag anomaly")
		}

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})
}
