package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/linenotify"
	"github.com/dof/ums-backend/internal/service"
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
	ManualAnomalyDetail       *string   `json:"manualAnomalyDetail,omitempty"`
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
		Reason string  `json:"reason" minLength:"3" doc:"Reason for marking as manual anomaly"`
		Detail *string `json:"detail,omitempty" doc:"Detailed explanation / instructions for fixing"`
	}
}

type ResolveAuditInput struct {
	AuditID string `path:"auditId"`
	Body    struct {
		Remarks         string  `json:"remarks"`
		AttachmentProof *string `json:"attachmentProof,omitempty"`
	}
}

func RegisterAuditRoutes(api huma.API, pool *pgxpool.Pool, lineNotifiers ...*linenotify.Service) {
	var lineNotifier *linenotify.Service
	if len(lineNotifiers) > 0 {
		lineNotifier = lineNotifiers[0]
	}

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
		Status string `query:"status" doc:"Filter by status: PENDING_CORRECTION, PENDING_RECHECK, or CORRECTED"`
	}) (*ListAuditsOutput, error) {
		query := `
			SELECT a.id, a.utility_bill_id, b.bill_code, d.full_name, b.utility_type,
			       b.invoice_amount, b.billing_month, b.billing_year, a.auditor_id,
			       a.is_late_receive, a.is_late_payment, a.is_overdue_more_than_2_months,
			       a.is_disbursement_over_2_months, a.is_wrong_month, a.is_phone_over_limit,
			       a.is_phone_usage_over_limit, a.is_wrong_budget, a.is_duplicate,
			       a.is_anomaly_expense, a.is_manual_anomaly, a.status, a.remarks,
			       a.manual_anomaly_reason, a.manual_anomaly_detail, a.attachment_proof, a.created_at, a.updated_at
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

		results := make([]AuditDTO, 0)
		for rows.Next() {
			var a AuditDTO
			if err := rows.Scan(
				&a.ID, &a.UtilityBillID, &a.BillCode, &a.DepartmentName, &a.UtilityType,
				&a.InvoiceAmount, &a.BillingMonth, &a.BillingYear, &a.AuditorID,
				&a.IsLateReceive, &a.IsLatePayment, &a.IsOverdueMoreThan2Months,
				&a.IsDisbursementOver2Months, &a.IsWrongMonth, &a.IsPhoneOverLimit,
				&a.IsPhoneUsageOverLimit, &a.IsWrongBudget, &a.IsDuplicate,
				&a.IsAnomalyExpense, &a.IsManualAnomaly, &a.Status, &a.Remarks,
				&a.ManualAnomalyReason, &a.ManualAnomalyDetail, &a.AttachmentProof, &a.CreatedAt, &a.UpdatedAt,
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
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("unauthorized")
		}
		if !HasRolePermission(ctx, pool, user.Role, "/bills:flag", "/all-bills:flag") {
			if user.Role != "admin" && user.Role != "auditor" {
				return nil, huma.Error403Forbidden("forbidden: insufficient permissions")
			}
		}

		var err error
		var existingAuditID string
		_ = pool.QueryRow(ctx, "SELECT id FROM audits WHERE utility_bill_id = $1 LIMIT 1", input.BillID).Scan(&existingAuditID)

		if existingAuditID != "" {
			_, err = pool.Exec(ctx, `
				UPDATE audits SET
					is_manual_anomaly = true,
					manual_anomaly_reason = $1,
					manual_anomaly_detail = $2,
					status = 'PENDING_CORRECTION',
					updated_at = NOW()
				WHERE id = $3
			`, input.Body.Reason, input.Body.Detail, existingAuditID)
		} else {
			auditID := uuid.New().String()
			_, err = pool.Exec(ctx, `
				INSERT INTO audits (
					id, utility_bill_id, auditor_id,
					is_manual_anomaly, manual_anomaly_reason, manual_anomaly_detail,
					status, created_at, updated_at
				) VALUES (
					$1, $2, $3,
					true, $4, $5,
					'PENDING_CORRECTION', NOW(), NOW()
				)
			`, auditID, input.BillID, user.UserID, input.Body.Reason, input.Body.Detail)
		}

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to flag anomaly")
		}

		logID := uuid.New().String()
		_, _ = pool.Exec(ctx, `
			INSERT INTO bill_activity_logs (id, bill_id, user_id, action, details, created_at)
			VALUES ($1, $2, $3, 'AUDITED', $4, NOW())
		`, logID, input.BillID, user.UserID, fmt.Sprintf("พบความผิดปกติ (บันทึกด้วยตนเอง): %s", input.Body.Reason))

		// Fetch bill details to send notification to the department
		var billInfo struct {
			departmentID   string
			utilityType    string
			billingMonth   int
			billingYear    int
			serviceNumber  *string
			billCode       *string
			departmentName string
		}
		bErr := pool.QueryRow(ctx, `
			SELECT b.department_id, b.utility_type, b.billing_month, b.billing_year, b.service_number, b.bill_code,
			       COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน')
			FROM utility_bills b
			LEFT JOIN departments d ON b.department_id = d.id
			WHERE b.id = $1
		`, input.BillID).Scan(
			&billInfo.departmentID, &billInfo.utilityType, &billInfo.billingMonth, &billInfo.billingYear,
			&billInfo.serviceNumber, &billInfo.billCode, &billInfo.departmentName,
		)

		if bErr == nil && billInfo.departmentID != "" {
			thaiMonths := []string{
				"", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
				"ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
			}
			mName := ""
			if billInfo.billingMonth >= 1 && billInfo.billingMonth <= 12 {
				mName = thaiMonths[billInfo.billingMonth]
			}
			sNum := "-"
			if billInfo.serviceNumber != nil && *billInfo.serviceNumber != "" {
				sNum = *billInfo.serviceNumber
			}
			billCodeStr := ""
			if billInfo.billCode != nil && *billInfo.billCode != "" {
				billCodeStr = fmt.Sprintf(" (รหัสบิล: %s)", *billInfo.billCode)
			}

			detailMsg := ""
			if input.Body.Detail != nil && *input.Body.Detail != "" {
				detailMsg = fmt.Sprintf("\nรายละเอียดเพิ่มเติม: %s", *input.Body.Detail)
			}
			title := "แจ้งเตือนพบข้อสังเกต/ความผิดปกติในรายการบิล"
			msg := fmt.Sprintf("[%s] รายการ%s รอบบิล %s %d%s หมายเลข: %s ถูกระบุข้อสังเกต: %s%s",
				billInfo.departmentName, billInfo.utilityType, mName, billInfo.billingYear+543, billCodeStr, sNum, input.Body.Reason, detailMsg)
			link := fmt.Sprintf("/bills/%s/edit", input.BillID)

			// Check if notification already exists for this bill to update, or create a new one
			var existingNotifID string
			_ = pool.QueryRow(ctx, `
				SELECT id FROM notifications 
				WHERE link = $1 AND type = 'MANUAL_ANOMALY' 
				ORDER BY created_at DESC LIMIT 1
			`, link).Scan(&existingNotifID)

			var sentNotifID string
			if existingNotifID != "" {
				if _, uErr := pool.Exec(ctx, `
					UPDATE notifications 
					SET title = $1, message = $2, severity = 'WARNING', is_read = false, 
					    acknowledged_reason = NULL, acknowledged_by = NULL, acknowledged_at = NULL, updated_at = NOW()
					WHERE id = $3
				`, title, msg, existingNotifID); uErr == nil {
					sentNotifID = existingNotifID
				}
			} else {
				notifID := uuid.New().String()
				if _, insErr := pool.Exec(ctx, `
					INSERT INTO notifications (
						id, department_id, title, message, type, severity, is_read, link, created_at, updated_at
					) VALUES (
						$1, $2, $3, $4, 'MANUAL_ANOMALY', 'WARNING', false, $5, NOW(), NOW()
					)
				`, notifID, billInfo.departmentID, title, msg, link); insErr == nil {
					sentNotifID = notifID
				}
			}

			if lineNotifier != nil && sentNotifID != "" {
				lineNotifier.NotifyDepartmentAsync(linenotify.NotificationPayload{
					ID:             sentNotifID,
					DepartmentID:   billInfo.departmentID,
					DepartmentName: billInfo.departmentName,
					Title:          title,
					Message:        msg,
					Type:           "MANUAL_ANOMALY",
					Severity:       "WARNING",
					Link:           link,
				})
			}

			// Broadcast via PostgreSQL notify channel for realtime SSE
			_, _ = pool.Exec(ctx, `SELECT pg_notify('notifications', $1)`, fmt.Sprintf(`{"action":"anomaly_flagged","billId":"%s","departmentId":"%s"}`, input.BillID, billInfo.departmentID))
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
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("unauthorized")
		}
		if !HasRolePermission(ctx, pool, user.Role, "/bills:flag", "/all-bills:flag") {
			if user.Role != "admin" && user.Role != "auditor" {
				return nil, huma.Error403Forbidden("forbidden: insufficient permissions")
			}
		}

		var err error
		var existingAudit struct {
			id                        string
			isLateReceive             bool
			isLatePayment             bool
			isOverdueMoreThan2Months  bool
			isDisbursementOver2Months bool
			isWrongMonth              bool
			isPhoneOverLimit          bool
			isPhoneUsageOverLimit     bool
			isWrongBudget             bool
			isDuplicate               bool
			isAnomalyExpense          bool
		}
		err = pool.QueryRow(ctx, `
			SELECT id, is_late_receive, is_late_payment, is_overdue_more_than_2_months,
			       is_disbursement_over_2_months, is_wrong_month, is_phone_over_limit,
			       is_phone_usage_over_limit, is_wrong_budget, is_duplicate, is_anomaly_expense
			FROM audits
			WHERE utility_bill_id = $1
			LIMIT 1
		`, input.BillID).Scan(
			&existingAudit.id, &existingAudit.isLateReceive, &existingAudit.isLatePayment,
			&existingAudit.isOverdueMoreThan2Months, &existingAudit.isDisbursementOver2Months,
			&existingAudit.isWrongMonth, &existingAudit.isPhoneOverLimit,
			&existingAudit.isPhoneUsageOverLimit, &existingAudit.isWrongBudget,
			&existingAudit.isDuplicate, &existingAudit.isAnomalyExpense,
		)
		if err == nil && existingAudit.id != "" {
			hasOtherIssues := existingAudit.isLateReceive || existingAudit.isLatePayment ||
				existingAudit.isOverdueMoreThan2Months || existingAudit.isDisbursementOver2Months ||
				existingAudit.isWrongMonth || existingAudit.isPhoneOverLimit ||
				existingAudit.isPhoneUsageOverLimit || existingAudit.isWrongBudget ||
				existingAudit.isDuplicate || existingAudit.isAnomalyExpense

			status := "CORRECTED"
			if hasOtherIssues {
				status = "PENDING_CORRECTION"
			}

			_, err = pool.Exec(ctx, `
				UPDATE audits SET
					is_manual_anomaly = false,
					manual_anomaly_reason = NULL,
					manual_anomaly_detail = NULL,
					status = $1,
					updated_at = NOW()
				WHERE id = $2
			`, status, existingAudit.id)
			if err != nil {
				return nil, huma.Error500InternalServerError("failed to unflag anomaly")
			}

			logID := uuid.New().String()
			_, _ = pool.Exec(ctx, `
				INSERT INTO bill_activity_logs (id, bill_id, user_id, action, details, created_at)
				VALUES ($1, $2, $3, 'AUDITED', 'ยกเลิกการตั้งค่าความผิดปกติด้วยตนเอง', NOW())
			`, logID, input.BillID, user.UserID)

			// Mark unread manual anomaly notification as resolved/read when unflagged
			link := fmt.Sprintf("/bills/%s/edit", input.BillID)
			_, _ = pool.Exec(ctx, `
				UPDATE notifications 
				SET is_read = true, acknowledged_reason = 'ผู้ตรวจสอบยกเลิกข้อสังเกตความผิดปกติแล้ว', acknowledged_at = NOW(), updated_at = NOW()
				WHERE link = $1 AND type = 'MANUAL_ANOMALY' AND is_read = false
			`, link)
			_, _ = pool.Exec(ctx, `SELECT pg_notify('notifications', $1)`, fmt.Sprintf(`{"action":"anomaly_unflagged","billId":"%s"}`, input.BillID))
		}

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Resolve Audit
	huma.Register(api, huma.Operation{
		OperationID: "resolveAudit",
		Method:      http.MethodPut,
		Path:        "/api/audits/{auditId}/resolve",
		Summary:     "Resolve internal audit findings and mark as corrected",
		Tags:        []string{"Audits"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *ResolveAuditInput) (*struct{ Body bool `json:"body"` }, error) {
		user, err := auth.RequireRoles(ctx, "admin", "auditor", "central_staff", "regional_staff")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		var billID string
		err = pool.QueryRow(ctx, `
			UPDATE audits
			SET status = 'CORRECTED', remarks = $1, attachment_proof = $2, updated_at = NOW()
			WHERE id = $3
			RETURNING utility_bill_id
		`, input.Body.Remarks, input.Body.AttachmentProof, input.AuditID).Scan(&billID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to resolve audit: " + err.Error())
		}

		logID := uuid.New().String()
		remarksText := input.Body.Remarks
		if remarksText == "" {
			remarksText = "ไม่มีหมายเหตุ"
		}
		_, _ = pool.Exec(ctx, `
			INSERT INTO bill_activity_logs (id, bill_id, user_id, action, details, created_at)
			VALUES ($1, $2, $3, 'AUDITED', $4, NOW())
		`, logID, billID, user.UserID, fmt.Sprintf("ตรวจสอบแก้ไขความผิดปกติ: %s", remarksText))

		// Mark unread manual anomaly notification as resolved/read when audit is resolved
		link := fmt.Sprintf("/bills/%s/edit", billID)
		ackReason := fmt.Sprintf("แก้ไขข้อสังเกตเรียบร้อยแล้ว: %s", remarksText)
		_, _ = pool.Exec(ctx, `
			UPDATE notifications 
			SET is_read = true, acknowledged_reason = $1, acknowledged_at = NOW(), acknowledged_by = $2, updated_at = NOW()
			WHERE link = $3 AND type = 'MANUAL_ANOMALY' AND is_read = false
		`, ackReason, user.UserID, link)
		_, _ = pool.Exec(ctx, `SELECT pg_notify('notifications', $1)`, fmt.Sprintf(`{"action":"anomaly_resolved","billId":"%s"}`, billID))

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Recheck All Audits
	huma.Register(api, huma.Operation{
		OperationID: "recheckAllAudits",
		Method:      http.MethodPost,
		Path:        "/api/audits/recheck-all",
		Summary:     "Re-evaluate audit rules for all bills",
		Tags:        []string{"Audits"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct{}) (*struct {
		Body struct {
			Success bool `json:"success"`
			Count   int  `json:"count"`
		} `json:"body"`
	}, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "auditor"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		rows, err := pool.Query(ctx, "SELECT id FROM utility_bills")
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch bills for recheck")
		}
		defer rows.Close()

		var billIDs []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err == nil {
				billIDs = append(billIDs, id)
			}
		}
		rows.Close()

		count := 0
		for _, id := range billIDs {
			if err := service.RunAuditChecks(ctx, pool, id, "SYSTEM", false); err == nil {
				count++
			}
		}

		out := &struct {
			Body struct {
				Success bool `json:"success"`
				Count   int  `json:"count"`
			} `json:"body"`
		}{}
		out.Body.Success = true
		out.Body.Count = count
		return out, nil
	})

}
