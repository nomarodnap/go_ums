package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/service"
	"github.com/dof/ums-backend/internal/storage"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// dbQuerier is satisfied by both *pgxpool.Pool and pgx.Tx.
type dbQuerier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// ArchivedBillDTO represents a soft-deleted/archived utility bill waiting for restore or permanent deletion.
type ArchivedBillDTO struct {
	ID                   string         `json:"id"`
	BillCode             string         `json:"billCode"`
	DepartmentID         string         `json:"departmentId"`
	DepartmentName       *string        `json:"departmentName,omitempty"`
	DepartmentShortName  *string        `json:"departmentShortName,omitempty"`
	DepartmentCostCenter *string        `json:"departmentCostCenter,omitempty"`
	DepartmentType       *string        `json:"departmentType,omitempty"`
	DepositUnitID        *string        `json:"depositUnitId,omitempty"`
	DepositUnitName      *string        `json:"depositUnitName,omitempty"`
	UtilityType          string         `json:"utilityType"`
	BillingMonth         int            `json:"billingMonth"`
	BillingYear          int            `json:"billingYear"`
	Provider             *string        `json:"provider,omitempty"`
	ServiceNumber        *string        `json:"serviceNumber,omitempty"`
	InvoiceNumber        *string        `json:"invoiceNumber,omitempty"`
	InvoiceAmount        float64        `json:"invoiceAmount"`
	PaymentStatus        string         `json:"paymentStatus"`
	BillData             map[string]any `json:"billData,omitempty"`
	ArchivedBy           string         `json:"archivedBy"`
	ArchivedByName       *string        `json:"archivedByName,omitempty"`
	ArchiveReason        *string        `json:"archiveReason,omitempty"`
	ArchivedAt           time.Time      `json:"archivedAt"`
}

// BillDeletionLogDTO represents a permanent audit log entry for archive / restore / permanent deletion.
type BillDeletionLogDTO struct {
	ID              string    `json:"id"`
	BillID          string    `json:"billId"`
	BillCode        string    `json:"billCode"`
	DepartmentID    *string   `json:"departmentId,omitempty"`
	DepartmentName  *string   `json:"departmentName,omitempty"`
	UtilityType     *string   `json:"utilityType,omitempty"`
	ServiceNumber   *string   `json:"serviceNumber,omitempty"`
	BillingMonth    *int      `json:"billingMonth,omitempty"`
	BillingYear     *int      `json:"billingYear,omitempty"`
	InvoiceAmount   *float64  `json:"invoiceAmount,omitempty"`
	Action          string    `json:"action"` // ARCHIVED | RESTORED | PERMANENTLY_DELETED
	Reason          *string   `json:"reason,omitempty"`
	PerformedBy     string    `json:"performedBy"`
	PerformedByName *string   `json:"performedByName,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
}

// parseServiceNumbers splits a comma-separated service number string into clean, non-empty items.
func parseServiceNumbers(raw string) []string {
	parts := strings.Split(raw, ",")
	var out []string
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

// findOverlappingServiceNumber returns the first overlapping service number (case-insensitive) between targetNumbers and an existing comma-separated service number string.
func findOverlappingServiceNumber(targetNumbers []string, existingRaw string) (string, bool) {
	if len(targetNumbers) == 0 || strings.TrimSpace(existingRaw) == "" {
		return "", false
	}
	existingParts := parseServiceNumbers(existingRaw)
	for _, existing := range existingParts {
		for _, target := range targetNumbers {
			if strings.EqualFold(existing, target) {
				return target, true
			}
		}
	}
	return "", false
}

// checkDuplicateBillServiceNumber checks whether any service number in serviceNumber already exists
// in active utility_bills for the same billingMonth, billingYear, and unit (department_id / deposit_unit_id).
func checkDuplicateBillServiceNumber(
	ctx context.Context,
	q dbQuerier,
	deptID string,
	depositUnitID string,
	serviceNumber string,
	billingMonth int,
	billingYear int,
	excludeBillID string,
) (conflictNumber string, conflictBillCode string, err error) {
	targetNumbers := parseServiceNumbers(serviceNumber)
	if len(targetNumbers) == 0 {
		return "", "", nil
	}

	// Match bills belonging to the same department/deposit unit for the exact billing month & year.
	// If neither unit ID is set, fall back to matching across all departments for safety.
	rows, err := q.Query(ctx, `
		SELECT b.id, b.bill_code, COALESCE(b.service_number, '')
		FROM utility_bills b
		WHERE b.billing_month = $1
		  AND b.billing_year = $2
		  AND ($3 = '' OR b.id <> $3)
		  AND COALESCE(b.service_number, '') <> ''
		  AND (
		      ($4 = '' AND $5 = '')
		      OR ($4 <> '' AND (b.department_id = $4 OR COALESCE(b.deposit_unit_id, '') = $4))
		      OR ($5 <> '' AND (b.department_id = $5 OR COALESCE(b.deposit_unit_id, '') = $5))
		  )
	`, billingMonth, billingYear, excludeBillID, deptID, depositUnitID)
	if err != nil {
		return "", "", err
	}
	defer rows.Close()

	for rows.Next() {
		var dID, dCode, dSN string
		if scanErr := rows.Scan(&dID, &dCode, &dSN); scanErr == nil {
			if matched, ok := findOverlappingServiceNumber(targetNumbers, dSN); ok {
				return matched, dCode, nil
			}
		}
	}
	return "", "", rows.Err()
}

func resolveActorDisplayName(ctx context.Context, q dbQuerier, user *auth.Claims) string {
	if user == nil {
		return ""
	}
	if strings.TrimSpace(user.Name) != "" {
		return strings.TrimSpace(user.Name)
	}
	var name string
	if err := q.QueryRow(ctx, `SELECT COALESCE(NULLIF(name, ''), email, id) FROM "user" WHERE id = $1`, user.UserID).Scan(&name); err == nil && name != "" {
		return name
	}
	if user.Email != "" {
		return user.Email
	}
	return user.UserID
}

func canAccessAllArchivedBills(role string) bool {
	return role == "admin" || role == "central_staff" || role == "auditor" || role == "strategy_finance"
}

// archiveBillTx moves an active utility_bill into archived_utility_bills and writes an ARCHIVED log entry atomically.
func archiveBillTx(
	ctx context.Context,
	pool *pgxpool.Pool,
	user *auth.Claims,
	billID string,
	reason string,
	searchService *ai.SearchService,
) error {
	trimmedReason := strings.TrimSpace(reason)
	if trimmedReason == "" {
		return huma.Error400BadRequest("กรุณาระบุเหตุผลการลบรายการบิล")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return huma.Error500InternalServerError("failed to begin archive transaction")
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		billCode       string
		departmentID   string
		departmentName *string
		depositUnitID  *string
		utilityType    string
		billingMonth   int
		billingYear    int
		provider       *string
		serviceNumber  *string
		invoiceNumber  *string
		invoiceAmount  float64
		paymentStatus  string
		billDataJSON   []byte
	)

	err = tx.QueryRow(ctx, `
		SELECT b.bill_code, b.department_id, d.full_name, b.deposit_unit_id,
		       b.utility_type, b.billing_month, b.billing_year,
		       b.provider, b.service_number, b.invoice_number,
		       COALESCE(b.invoice_amount, 0)::float8, b.payment_status,
		       to_jsonb(b)
		FROM utility_bills b
		LEFT JOIN departments d ON b.department_id = d.id
		WHERE b.id = $1
		FOR UPDATE OF b
	`, billID).Scan(
		&billCode, &departmentID, &departmentName, &depositUnitID,
		&utilityType, &billingMonth, &billingYear,
		&provider, &serviceNumber, &invoiceNumber,
		&invoiceAmount, &paymentStatus,
		&billDataJSON,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return huma.Error404NotFound("ไม่พบรายการบิลที่ต้องการลบ")
		}
		return huma.Error500InternalServerError("failed to load bill for archiving: " + err.Error())
	}

	// Enforce department ownership for regional_staff
	if !canAccessAllArchivedBills(user.Role) && user.DepartmentID != "" && departmentID != user.DepartmentID {
		return huma.Error403Forbidden("คุณไม่มีสิทธิ์ลบรายการบิลของหน่วยงานอื่น")
	}

	actorName := resolveActorDisplayName(ctx, tx, user)
	var reasonPtr *string
	if trimmed := strings.TrimSpace(reason); trimmed != "" {
		reasonPtr = &trimmed
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO archived_utility_bills (
			id, bill_code, department_id, department_name, deposit_unit_id,
			utility_type, billing_month, billing_year, provider, service_number,
			invoice_number, invoice_amount, payment_status, bill_data,
			archived_by, archived_by_name, archive_reason, archived_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14::jsonb,
			$15, $16, $17, NOW()
		)
	`, billID, billCode, departmentID, departmentName, depositUnitID,
		utilityType, billingMonth, billingYear, provider, serviceNumber,
		invoiceNumber, invoiceAmount, paymentStatus, string(billDataJSON),
		user.UserID, actorName, reasonPtr)
	if err != nil {
		return huma.Error500InternalServerError("failed to archive bill: " + err.Error())
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO bill_deletion_logs (
			id, bill_id, bill_code, department_id, department_name,
			utility_type, service_number, billing_month, billing_year, invoice_amount,
			action, reason, performed_by, performed_by_name, bill_snapshot, created_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			'ARCHIVED', $11, $12, $13, $14::jsonb, NOW()
		)
	`, uuid.New().String(), billID, billCode, departmentID, departmentName,
		utilityType, serviceNumber, billingMonth, billingYear, invoiceAmount,
		reasonPtr, user.UserID, actorName, string(billDataJSON))
	if err != nil {
		return huma.Error500InternalServerError("failed to log bill archive: " + err.Error())
	}

	if _, err := tx.Exec(ctx, `DELETE FROM utility_bills WHERE id = $1`, billID); err != nil {
		return huma.Error500InternalServerError("failed to remove bill from active table: " + err.Error())
	}

	// Preserve & append activity log so full bill history remains visible in Archived and after Restore
	archiveDetails := fmt.Sprintf("ย้ายบิล %s ไปเก็บถาวรโดย %s", billCode, actorName)
	if reasonPtr != nil {
		archiveDetails = fmt.Sprintf("%s (เหตุผล: %s)", archiveDetails, *reasonPtr)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO bill_activity_logs (id, bill_id, user_id, action, details, created_at)
		VALUES ($1, $2, $3, 'ARCHIVED', $4, NOW())
	`, uuid.New().String(), billID, user.UserID, archiveDetails); err != nil {
		return huma.Error500InternalServerError("failed to record archive activity log: " + err.Error())
	}

	if err := tx.Commit(ctx); err != nil {
		return huma.Error500InternalServerError("failed to commit archive transaction")
	}

	if searchService != nil {
		go func(id string) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = searchService.DeleteBillEmbedding(bgCtx, id)
		}(billID)
	}

	return nil
}

// RegisterBillArchiveRoutes registers archived bills listing, restore (with duplicate check),
// permanent deletion (with Garage attachment cleanup), and deletion audit log endpoints.
func RegisterBillArchiveRoutes(
	api huma.API,
	pool *pgxpool.Pool,
	storageService storage.StorageService,
	searchServices ...*ai.SearchService,
) {
	var searchService *ai.SearchService
	if len(searchServices) > 0 {
		searchService = searchServices[0]
	}

	// 1. List Archived Bills
	huma.Register(api, huma.Operation{
		OperationID: "listArchivedBills",
		Method:      http.MethodGet,
		Path:        "/api/bills/archived",
		Summary:     "List archived (soft-deleted) utility bills",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Search       string `query:"search"`
		DepartmentID string `query:"departmentId"`
		UtilityType  string `query:"utilityType"`
		BillingYear  int    `query:"billingYear"`
		BillingMonth int    `query:"billingMonth"`
	}) (*struct {
		Body []ArchivedBillDTO `json:"body"`
	}, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		query := `
			SELECT a.id, a.bill_code, a.department_id, COALESCE(a.department_name, d.full_name),
			       d.short_name, d.cost_center_code, d.type, a.deposit_unit_id, du.full_name,
			       a.utility_type, a.billing_month, a.billing_year, a.provider, a.service_number,
			       a.invoice_number, COALESCE(a.invoice_amount, 0)::float8, a.payment_status,
			       a.bill_data, a.archived_by, a.archived_by_name, a.archive_reason, a.archived_at
			FROM archived_utility_bills a
			LEFT JOIN departments d ON a.department_id = d.id
			LEFT JOIN departments du ON a.deposit_unit_id = du.id
			WHERE 1=1
		`
		args := []any{}
		argIdx := 1

		if !canAccessAllArchivedBills(user.Role) && user.DepartmentID != "" {
			query += fmt.Sprintf(" AND a.department_id = $%d", argIdx)
			args = append(args, user.DepartmentID)
			argIdx++
		} else if input.DepartmentID != "" && input.DepartmentID != "ALL" {
			query += fmt.Sprintf(" AND a.department_id = $%d", argIdx)
			args = append(args, input.DepartmentID)
			argIdx++
		}

		if input.UtilityType != "" && input.UtilityType != "ALL" {
			query += fmt.Sprintf(" AND a.utility_type = $%d", argIdx)
			args = append(args, input.UtilityType)
			argIdx++
		}

		if input.BillingYear > 0 {
			query += fmt.Sprintf(" AND a.billing_year = $%d", argIdx)
			args = append(args, input.BillingYear)
			argIdx++
		}

		if input.BillingMonth > 0 {
			query += fmt.Sprintf(" AND a.billing_month = $%d", argIdx)
			args = append(args, input.BillingMonth)
			argIdx++
		}

		if s := strings.TrimSpace(input.Search); s != "" {
			like := "%" + s + "%"
			query += fmt.Sprintf(" AND (a.bill_code ILIKE $%d OR COALESCE(a.service_number, '') ILIKE $%d OR COALESCE(a.department_name, d.full_name, '') ILIKE $%d OR COALESCE(a.invoice_number, '') ILIKE $%d OR COALESCE(a.archived_by_name, '') ILIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx)
			args = append(args, like)
			argIdx++
		}

		query += " ORDER BY a.archived_at DESC LIMIT 300"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list archived bills: " + err.Error())
		}
		defer rows.Close()

		results := []ArchivedBillDTO{}
		for rows.Next() {
			var b ArchivedBillDTO
			var rawBillData []byte
			if scanErr := rows.Scan(
				&b.ID, &b.BillCode, &b.DepartmentID, &b.DepartmentName,
				&b.DepartmentShortName, &b.DepartmentCostCenter, &b.DepartmentType, &b.DepositUnitID, &b.DepositUnitName,
				&b.UtilityType, &b.BillingMonth, &b.BillingYear, &b.Provider, &b.ServiceNumber,
				&b.InvoiceNumber, &b.InvoiceAmount, &b.PaymentStatus,
				&rawBillData, &b.ArchivedBy, &b.ArchivedByName, &b.ArchiveReason, &b.ArchivedAt,
			); scanErr == nil {
				if len(rawBillData) > 0 {
					var parsed map[string]any
					if err := json.Unmarshal(rawBillData, &parsed); err == nil {
						b.BillData = parsed
					}
				}
				results = append(results, b)
			}
		}
		return &struct {
			Body []ArchivedBillDTO `json:"body"`
		}{Body: results}, nil
	})

	// 2. Restore Archived Bill (with strict duplicate check on service_number + billing_month/year)
	huma.Register(api, huma.Operation{
		OperationID: "restoreArchivedBill",
		Method:      http.MethodPost,
		Path:        "/api/bills/archived/{id}/restore",
		Summary:     "Restore an archived bill back to active utility_bills after verifying no duplicate exists",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id" doc:"Archived bill unique ID"`
	}) (*struct {
		Body struct {
			Restored bool   `json:"restored"`
			BillID   string `json:"billId"`
			BillCode string `json:"billCode"`
		} `json:"body"`
	}, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to begin restore transaction")
		}
		defer func() { _ = tx.Rollback(ctx) }()

		var (
			billCode       string
			departmentID   string
			departmentName *string
			depositUnitID  *string
			utilityType    string
			billingMonth   int
			billingYear    int
			serviceNumber  *string
			invoiceAmount  float64
			billDataJSON   []byte
		)

		err = tx.QueryRow(ctx, `
			SELECT bill_code, department_id, department_name, deposit_unit_id,
			       utility_type, billing_month, billing_year, service_number,
			       COALESCE(invoice_amount, 0)::float8, bill_data
			FROM archived_utility_bills
			WHERE id = $1
			FOR UPDATE
		`, input.ID).Scan(
			&billCode, &departmentID, &departmentName, &depositUnitID,
			&utilityType, &billingMonth, &billingYear, &serviceNumber,
			&invoiceAmount, &billDataJSON,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, huma.Error404NotFound("ไม่พบรายการบิลในคลังเก็บถาวร")
			}
			return nil, huma.Error500InternalServerError("failed to fetch archived bill")
		}

		if !canAccessAllArchivedBills(user.Role) && user.DepartmentID != "" && departmentID != user.DepartmentID {
			return nil, huma.Error403Forbidden("คุณไม่มีสิทธิ์กู้คืนรายการบิลของหน่วยงานอื่น")
		}

		// Serialize restores for the same billing period to prevent race conditions
		lockKey := fmt.Sprintf("bill_restore_%d_%d", billingYear, billingMonth)
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, lockKey); err != nil {
			return nil, huma.Error500InternalServerError("failed to acquire restore lock")
		}

		// Strict Duplicate Check: service_number + billing_month + billing_year in active utility_bills
		depUnit := ""
		if depositUnitID != nil {
			depUnit = *depositUnitID
		}
		snStr := ""
		if serviceNumber != nil {
			snStr = *serviceNumber
		}

		conflictSN, conflictCode, dupErr := checkDuplicateBillServiceNumber(
			ctx, tx, departmentID, depUnit, snStr, billingMonth, billingYear, input.ID,
		)
		if dupErr != nil {
			return nil, huma.Error500InternalServerError("failed to check duplicate bills before restore")
		}
		if conflictSN != "" {
			return nil, huma.Error409Conflict(fmt.Sprintf(
				"ไม่สามารถกู้คืนได้: หมายเลข %s ประจำเดือน %d/%d มีบิลอยู่ในระบบปัจจุบันแล้ว (รหัสบิล: %s) เพื่อป้องกันข้อมูลซ้ำซ้อน",
				conflictSN, billingMonth, billingYear, conflictCode,
			))
		}

		// Check bill_code uniqueness in active utility_bills
		var existingCodeID string
		if err := tx.QueryRow(ctx, `SELECT id FROM utility_bills WHERE bill_code = $1`, billCode).Scan(&existingCodeID); err == nil {
			return nil, huma.Error409Conflict(fmt.Sprintf(
				"ไม่สามารถกู้คืนได้: รหัสบิล %s ถูกใช้งานอยู่ในระบบปัจจุบันแล้ว",
				billCode,
			))
		}

		// Re-insert exact row into utility_bills using PostgreSQL jsonb_populate_record
		_, err = tx.Exec(ctx, `
			INSERT INTO utility_bills
			SELECT * FROM jsonb_populate_record(NULL::utility_bills, $1::jsonb)
		`, string(billDataJSON))
		if err != nil {
			return nil, huma.Error500InternalServerError("ไม่สามารถกู้คืนบิลกลับเข้าสู่ระบบได้: " + err.Error())
		}

		// Update updated_at timestamp on restored bill
		_, _ = tx.Exec(ctx, `UPDATE utility_bills SET updated_at = NOW() WHERE id = $1`, input.ID)

		// Remove from archived_utility_bills
		if _, err := tx.Exec(ctx, `DELETE FROM archived_utility_bills WHERE id = $1`, input.ID); err != nil {
			return nil, huma.Error500InternalServerError("failed to clean up archived bill record")
		}

		actorName := resolveActorDisplayName(ctx, tx, user)
		restoreDetails := fmt.Sprintf("กู้คืนบิล %s กลับเข้าสู่ระบบโดย %s", billCode, actorName)

		// Log into bill_activity_logs (visible inside bill detail view)
		_, _ = tx.Exec(ctx, `
			INSERT INTO bill_activity_logs (id, bill_id, user_id, action, details, created_at)
			VALUES ($1, $2, $3, 'RESTORED', $4, NOW())
		`, uuid.New().String(), input.ID, user.UserID, restoreDetails)

		// Log into permanent bill_deletion_logs
		_, err = tx.Exec(ctx, `
			INSERT INTO bill_deletion_logs (
				id, bill_id, bill_code, department_id, department_name,
				utility_type, service_number, billing_month, billing_year, invoice_amount,
				action, reason, performed_by, performed_by_name, bill_snapshot, created_at
			) VALUES (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9, $10,
				'RESTORED', $11, $12, $13, $14::jsonb, NOW()
			)
		`, uuid.New().String(), input.ID, billCode, departmentID, departmentName,
			utilityType, serviceNumber, billingMonth, billingYear, invoiceAmount,
			restoreDetails, user.UserID, actorName, string(billDataJSON))
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to log bill restoration")
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("failed to commit restore transaction")
		}

		// Re-run audit engine and re-index AI embedding asynchronously
		go func(id, uid string) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			_ = service.RunAuditChecks(bgCtx, pool, id, uid, true)
			if searchService != nil {
				_ = searchService.UpsertBillEmbedding(bgCtx, id)
			}
		}(input.ID, user.UserID)

		resp := &struct {
			Body struct {
				Restored bool   `json:"restored"`
				BillID   string `json:"billId"`
				BillCode string `json:"billCode"`
			} `json:"body"`
		}{}
		resp.Body.Restored = true
		resp.Body.BillID = input.ID
		resp.Body.BillCode = billCode
		return resp, nil
	})

	// 3. Permanently Delete Archived Bill (with permanent audit log + Garage file cleanup)
	huma.Register(api, huma.Operation{
		OperationID: "permanentlyDeleteArchivedBill",
		Method:      http.MethodDelete,
		Path:        "/api/bills/archived/{id}",
		Summary:     "Permanently delete an archived bill and record permanent deletion log",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID     string `path:"id" doc:"Archived bill unique ID"`
		Reason string `query:"reason" doc:"Required reason for permanent deletion"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}
		if strings.TrimSpace(input.Reason) == "" {
			return nil, huma.Error400BadRequest("กรุณาระบุเหตุผลการลบถาวร")
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to begin permanent delete transaction")
		}
		defer func() { _ = tx.Rollback(ctx) }()

		var (
			billCode       string
			departmentID   string
			departmentName *string
			utilityType    string
			billingMonth   int
			billingYear    int
			serviceNumber  *string
			invoiceAmount  float64
			billDataJSON   []byte
		)

		err = tx.QueryRow(ctx, `
			SELECT bill_code, department_id, department_name,
			       utility_type, billing_month, billing_year, service_number,
			       COALESCE(invoice_amount, 0)::float8, bill_data
			FROM archived_utility_bills
			WHERE id = $1
			FOR UPDATE
		`, input.ID).Scan(
			&billCode, &departmentID, &departmentName,
			&utilityType, &billingMonth, &billingYear, &serviceNumber,
			&invoiceAmount, &billDataJSON,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, huma.Error404NotFound("ไม่พบรายการบิลในคลังเก็บถาวร")
			}
			return nil, huma.Error500InternalServerError("failed to fetch archived bill")
		}

		if !canAccessAllArchivedBills(user.Role) && user.DepartmentID != "" && departmentID != user.DepartmentID {
			return nil, huma.Error403Forbidden("คุณไม่มีสิทธิ์ลบรายการบิลของหน่วยงานอื่น")
		}

		actorName := resolveActorDisplayName(ctx, tx, user)
		var reasonPtr *string
		if trimmed := strings.TrimSpace(input.Reason); trimmed != "" {
			reasonPtr = &trimmed
		}

		// Write permanent audit log BEFORE deleting archived record
		_, err = tx.Exec(ctx, `
			INSERT INTO bill_deletion_logs (
				id, bill_id, bill_code, department_id, department_name,
				utility_type, service_number, billing_month, billing_year, invoice_amount,
				action, reason, performed_by, performed_by_name, bill_snapshot, created_at
			) VALUES (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9, $10,
				'PERMANENTLY_DELETED', $11, $12, $13, $14::jsonb, NOW()
			)
		`, uuid.New().String(), input.ID, billCode, departmentID, departmentName,
			utilityType, serviceNumber, billingMonth, billingYear, invoiceAmount,
			reasonPtr, user.UserID, actorName, string(billDataJSON))
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to write permanent deletion log: " + err.Error())
		}

		if _, err := tx.Exec(ctx, `DELETE FROM archived_utility_bills WHERE id = $1`, input.ID); err != nil {
			return nil, huma.Error500InternalServerError("failed to permanently delete archived bill")
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("failed to commit permanent delete transaction")
		}

		// Clean up Garage S3 / uploaded attachments asynchronously after permanent delete
		if storageService != nil && len(billDataJSON) > 0 {
			go cleanupBillAttachments(storageService, billDataJSON)
		}

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// 4. List Bill Deletion / Archive / Restore Audit Logs
	huma.Register(api, huma.Operation{
		OperationID: "listBillDeletionLogs",
		Method:      http.MethodGet,
		Path:        "/api/bills/deletion-logs",
		Summary:     "List permanent archive, restore, and deletion audit logs for bills",
		Tags:        []string{"Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Action string `query:"action" doc:"Filter by action: ARCHIVED, RESTORED, PERMANENTLY_DELETED"`
		Search string `query:"search"`
		Limit  int    `query:"limit"`
	}) (*struct {
		Body []BillDeletionLogDTO `json:"body"`
	}, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		limit := input.Limit
		if limit <= 0 || limit > 500 {
			limit = 150
		}

		query := `
			SELECT id, bill_id, bill_code, department_id, department_name,
			       utility_type, service_number, billing_month, billing_year,
			       invoice_amount::float8, action, reason, performed_by, performed_by_name, created_at
			FROM bill_deletion_logs
			WHERE 1=1
		`
		args := []any{}
		argIdx := 1

		if !canAccessAllArchivedBills(user.Role) && user.DepartmentID != "" {
			query += fmt.Sprintf(" AND department_id = $%d", argIdx)
			args = append(args, user.DepartmentID)
			argIdx++
		}

		if input.Action != "" && input.Action != "ALL" {
			query += fmt.Sprintf(" AND action = $%d", argIdx)
			args = append(args, input.Action)
			argIdx++
		}

		if s := strings.TrimSpace(input.Search); s != "" {
			like := "%" + s + "%"
			query += fmt.Sprintf(" AND (bill_code ILIKE $%d OR COALESCE(service_number, '') ILIKE $%d OR COALESCE(department_name, '') ILIKE $%d OR COALESCE(performed_by_name, '') ILIKE $%d OR COALESCE(reason, '') ILIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx)
			args = append(args, like)
			argIdx++
		}

		query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIdx)
		args = append(args, limit)

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list deletion logs: " + err.Error())
		}
		defer rows.Close()

		logs := []BillDeletionLogDTO{}
		for rows.Next() {
			var l BillDeletionLogDTO
			if scanErr := rows.Scan(
				&l.ID, &l.BillID, &l.BillCode, &l.DepartmentID, &l.DepartmentName,
				&l.UtilityType, &l.ServiceNumber, &l.BillingMonth, &l.BillingYear,
				&l.InvoiceAmount, &l.Action, &l.Reason, &l.PerformedBy, &l.PerformedByName, &l.CreatedAt,
			); scanErr == nil {
				logs = append(logs, l)
			}
		}
		return &struct {
			Body []BillDeletionLogDTO `json:"body"`
		}{Body: logs}, nil
	})
}

func cleanupBillAttachments(storageService storage.StorageService, billDataJSON []byte) {
	var raw map[string]any
	if err := json.Unmarshal(billDataJSON, &raw); err != nil {
		return
	}
	attachmentFields := []string{
		"attachment_invoice",
		"attachment_receipt",
		"attachment_payment_doc",
		"attachment_direct_payment",
		"attachment_ktb_report",
	}
	bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	for _, field := range attachmentFields {
		if val, ok := raw[field].(string); ok && strings.HasPrefix(val, "/uploads/") {
			filename := strings.TrimPrefix(val, "/uploads/")
			if filename != "" {
				_ = storageService.Delete(bgCtx, filename)
			}
		}
	}
}
