-- name: GetAuditByBillID :one
SELECT * FROM audits
WHERE utility_bill_id = $1 LIMIT 1;

-- name: ListAudits :many
SELECT a.*, 
       b.bill_code, b.utility_type, b.invoice_amount, b.billing_month, b.billing_year,
       d.full_name AS department_name
FROM audits a
JOIN utility_bills b ON a.utility_bill_id = b.id
JOIN departments d ON b.department_id = d.id
WHERE (sqlc.narg('status')::text IS NULL OR a.status = sqlc.narg('status'))
ORDER BY a.created_at DESC;

-- name: UpsertAudit :one
INSERT INTO audits (
    id, utility_bill_id, auditor_id,
    is_late_receive, is_late_payment, is_overdue_more_than_2_months,
    is_disbursement_over_2_months, is_wrong_month, is_phone_over_limit,
    is_phone_usage_over_limit, is_wrong_budget, is_duplicate,
    is_anomaly_expense, is_manual_anomaly, status, remarks,
    manual_anomaly_reason, attachment_proof, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
    is_late_receive = EXCLUDED.is_late_receive,
    is_late_payment = EXCLUDED.is_late_payment,
    is_overdue_more_than_2_months = EXCLUDED.is_overdue_more_than_2_months,
    is_disbursement_over_2_months = EXCLUDED.is_disbursement_over_2_months,
    is_wrong_month = EXCLUDED.is_wrong_month,
    is_phone_over_limit = EXCLUDED.is_phone_over_limit,
    is_phone_usage_over_limit = EXCLUDED.is_phone_usage_over_limit,
    is_wrong_budget = EXCLUDED.is_wrong_budget,
    is_duplicate = EXCLUDED.is_duplicate,
    is_anomaly_expense = EXCLUDED.is_anomaly_expense,
    is_manual_anomaly = EXCLUDED.is_manual_anomaly,
    status = EXCLUDED.status,
    remarks = EXCLUDED.remarks,
    manual_anomaly_reason = EXCLUDED.manual_anomaly_reason,
    attachment_proof = EXCLUDED.attachment_proof,
    updated_at = NOW()
RETURNING *;

-- name: FlagManualAnomaly :one
INSERT INTO audits (
    id, utility_bill_id, auditor_id, is_manual_anomaly, manual_anomaly_reason,
    status, created_at, updated_at
) VALUES (
    $1, $2, $3, true, $4, 'PENDING_CORRECTION', NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
    is_manual_anomaly = true,
    manual_anomaly_reason = EXCLUDED.manual_anomaly_reason,
    status = 'PENDING_CORRECTION',
    updated_at = NOW()
RETURNING *;

-- name: UnflagManualAnomaly :one
UPDATE audits
SET 
    is_manual_anomaly = false,
    manual_anomaly_reason = NULL,
    updated_at = NOW()
WHERE utility_bill_id = $1
RETURNING *;

-- name: ResolveAudit :one
UPDATE audits
SET 
    status = 'CORRECTED',
    remarks = $2,
    attachment_proof = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;
