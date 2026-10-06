-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    cost_center_code TEXT,
    disbursing_unit TEXT,
    deposit_unit TEXT,
    full_name TEXT NOT NULL,
    short_name TEXT,
    division TEXT,
    location TEXT,
    province TEXT,
    responsible_person TEXT,
    phone TEXT,
    responsible_phone TEXT,
    email TEXT,
    type TEXT, -- 'central', 'regional_central', 'regional'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'auditor', 'strategy_finance', 'central_staff', 'regional_staff', 'user'
    banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    ban_expires TIMESTAMPTZ,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS department_services (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    utility_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    service_number TEXT NOT NULL,
    location_type TEXT,
    phone_owner_name TEXT,
    phone_owner_position TEXT,
    phone_reimbursement_limit INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    budget_code TEXT NOT NULL,
    name TEXT NOT NULL,
    fund_source TEXT,
    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    transferred_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS utility_bills (
    id TEXT PRIMARY KEY,
    bill_code TEXT UNIQUE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    utility_type TEXT NOT NULL, -- 'ค่าไฟฟ้า', 'ค่าประปา&น้ำบาดาล', 'ค่าโทรศัพท์', 'ค่าสื่อสาร&โทรคมนาคม', 'ค่าบริการไปรษณีย์'
    billing_month INTEGER NOT NULL,
    billing_year INTEGER NOT NULL,
    provider TEXT,
    service_number TEXT,
    service_breakdown TEXT, -- JSON string
    invoice_number TEXT,
    invoice_date TIMESTAMPTZ,
    location_type TEXT,
    usage_amount NUMERIC(10, 2),
    invoice_amount NUMERIC(15, 2),
    estimated_amount NUMERIC(15, 2),
    received_date TIMESTAMPTZ,
    sent_to_disbursing_date TIMESTAMPTZ,
    disbursing_received_date TIMESTAMPTZ,
    payment_date TIMESTAMPTZ,
    payment_doc_number TEXT,
    doc_type TEXT,
    account_code TEXT,
    budget_code TEXT,
    fund_source TEXT,
    paid_amount NUMERIC(15, 2),
    payment_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID'
    invoice_status TEXT NOT NULL DEFAULT 'RECEIVED', -- 'RECEIVED', 'NOT_RECEIVED'
    receipt_number TEXT,
    receipt_date TIMESTAMPTZ,
    receipt_payment_date TIMESTAMPTZ,
    attachment_invoice TEXT,
    attachment_receipt TEXT,
    attachment_payment_doc TEXT,
    attachment_direct_payment TEXT,
    attachment_ktb_report TEXT,
    is_pending_bill_only BOOLEAN NOT NULL DEFAULT FALSE,
    deposit_unit_id TEXT,
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    utility_bill_id TEXT NOT NULL REFERENCES utility_bills(id) ON DELETE CASCADE,
    auditor_id TEXT NOT NULL,
    is_late_receive BOOLEAN DEFAULT FALSE,
    is_late_payment BOOLEAN DEFAULT FALSE,
    is_overdue_more_than_2_months BOOLEAN DEFAULT FALSE,
    is_disbursement_over_2_months BOOLEAN DEFAULT FALSE,
    is_wrong_month BOOLEAN DEFAULT FALSE,
    is_phone_over_limit BOOLEAN DEFAULT FALSE,
    is_phone_usage_over_limit BOOLEAN DEFAULT FALSE,
    is_wrong_budget BOOLEAN DEFAULT FALSE,
    is_duplicate BOOLEAN DEFAULT FALSE,
    is_anomaly_expense BOOLEAN DEFAULT FALSE,
    is_manual_anomaly BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'PENDING_CORRECTION', -- 'PENDING_CORRECTION', 'CORRECTED'
    remarks TEXT,
    manual_anomaly_reason TEXT,
    attachment_proof TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    department_id TEXT REFERENCES departments(id) ON DELETE CASCADE,
    target_role TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'BUDGET_LIMIT', 'LATE_PAYMENT', 'PENDING_BILL', 'MISSING_DATA', 'ABNORMAL_EXPENSE'
    severity TEXT NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'WARNING', 'URGENT'
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_activity_logs (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES utility_bills(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS bill_activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audits CASCADE;
DROP TABLE IF EXISTS utility_bills CASCADE;
DROP TABLE IF EXISTS budget_codes CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS department_services CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
-- +goose StatementEnd
