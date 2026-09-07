-- name: GetBillByID :one
SELECT b.*, 
       d.full_name AS department_name, 
       d.short_name AS department_short_name,
       d.cost_center_code AS department_cost_center,
       dep_unit.full_name AS deposit_unit_name,
       a.id AS audit_id,
       a.status AS audit_status,
       a.is_late_receive,
       a.is_late_payment,
       a.is_overdue_more_than_2_months,
       a.is_disbursement_over_2_months,
       a.is_wrong_month,
       a.is_phone_over_limit,
       a.is_phone_usage_over_limit,
       a.is_wrong_budget,
       a.is_duplicate,
       a.is_anomaly_expense,
       a.is_manual_anomaly,
       a.manual_anomaly_reason
FROM utility_bills b
LEFT JOIN departments d ON b.department_id = d.id
LEFT JOIN departments dep_unit ON b.deposit_unit_id = dep_unit.id
LEFT JOIN audits a ON b.id = a.utility_bill_id
WHERE b.id = $1 LIMIT 1;

-- name: ListBills :many
SELECT b.*, 
       d.full_name AS department_name, 
       d.short_name AS department_short_name,
       d.cost_center_code AS department_cost_center,
       dep_unit.full_name AS deposit_unit_name,
       a.id AS audit_id,
       a.status AS audit_status,
       a.is_late_receive,
       a.is_late_payment,
       a.is_overdue_more_than_2_months,
       a.is_disbursement_over_2_months,
       a.is_wrong_month,
       a.is_phone_over_limit,
       a.is_phone_usage_over_limit,
       a.is_wrong_budget,
       a.is_duplicate,
       a.is_anomaly_expense,
       a.is_manual_anomaly,
       a.manual_anomaly_reason
FROM utility_bills b
LEFT JOIN departments d ON b.department_id = d.id
LEFT JOIN departments dep_unit ON b.deposit_unit_id = dep_unit.id
LEFT JOIN audits a ON b.id = a.utility_bill_id
WHERE 
    (sqlc.narg('department_id')::text IS NULL OR b.department_id = sqlc.narg('department_id'))
    AND (sqlc.narg('utility_type')::text IS NULL OR b.utility_type = sqlc.narg('utility_type'))
    AND (sqlc.narg('billing_year')::int IS NULL OR b.billing_year = sqlc.narg('billing_year'))
    AND (sqlc.narg('billing_month')::int IS NULL OR b.billing_month = sqlc.narg('billing_month'))
    AND (sqlc.narg('payment_status')::text IS NULL OR b.payment_status = sqlc.narg('payment_status'))
ORDER BY b.created_at DESC
LIMIT 500;

-- name: GetLatestBillCodeForPrefix :one
SELECT bill_code FROM utility_bills
WHERE bill_code LIKE $1
ORDER BY bill_code DESC
LIMIT 1;

-- name: CreateBill :one
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
RETURNING *;

-- name: UpdateBill :one
UPDATE utility_bills
SET
    bill_code = $2,
    department_id = $3,
    utility_type = $4,
    billing_month = $5,
    billing_year = $6,
    provider = $7,
    service_number = $8,
    service_breakdown = $9,
    invoice_number = $10,
    invoice_date = $11,
    location_type = $12,
    usage_amount = $13,
    invoice_amount = $14,
    estimated_amount = $15,
    received_date = $16,
    sent_to_disbursing_date = $17,
    disbursing_received_date = $18,
    payment_date = $19,
    payment_doc_number = $20,
    doc_type = $21,
    account_code = $22,
    budget_code = $23,
    fund_source = $24,
    paid_amount = $25,
    payment_status = $26,
    invoice_status = $27,
    receipt_number = $28,
    receipt_date = $29,
    receipt_payment_date = $30,
    attachment_invoice = $31,
    attachment_receipt = $32,
    attachment_payment_doc = $33,
    attachment_direct_payment = $34,
    attachment_ktb_report = $35,
    is_pending_bill_only = $36,
    deposit_unit_id = $37,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteBill :exec
DELETE FROM utility_bills
WHERE id = $1;

-- name: MarkBillReviewed :one
UPDATE utility_bills
SET is_reviewed = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CreateBillActivityLog :one
INSERT INTO bill_activity_logs (
    id, bill_id, user_id, action, details, created_at
) VALUES (
    $1, $2, $3, $4, $5, NOW()
)
RETURNING *;

-- name: GetBillActivityLogs :many
SELECT l.*, u.name AS user_name, u.email AS user_email
FROM bill_activity_logs l
LEFT JOIN users u ON l.user_id = u.id
WHERE l.bill_id = $1
ORDER BY l.created_at DESC;
