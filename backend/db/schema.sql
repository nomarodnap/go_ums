-- PostgreSQL Schema for Department of Fisheries Utility Management System (UMS)
-- Compatible with sqlc (pgx/v5) and Better Auth

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

-- Better Auth user table
CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'auditor', 'strategy_finance', 'central_staff', 'regional_staff', 'user'
    banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    ban_expires TIMESTAMPTZ,
    "banReason" TEXT,
    "banExpires" TIMESTAMPTZ,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    phone TEXT,
    clerk_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Better Auth session table
CREATE TABLE IF NOT EXISTS "session" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    "impersonatedBy" TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Better Auth account table (stores credentials and password hashes)
CREATE TABLE IF NOT EXISTS "account" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Better Auth verification table
CREATE TABLE IF NOT EXISTS "verification" (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_token_idx ON "session"(token);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON "session"(user_id);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON "account"(user_id);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification"(identifier);

-- View to maintain compatibility with legacy queries
CREATE OR REPLACE VIEW users AS SELECT * FROM "user";

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
    utility_type TEXT NOT NULL,
    billing_month INTEGER NOT NULL,
    billing_year INTEGER NOT NULL,
    provider TEXT,
    service_number TEXT,
    service_breakdown TEXT,
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
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    invoice_status TEXT NOT NULL DEFAULT 'RECEIVED',
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
    status TEXT NOT NULL DEFAULT 'PENDING_CORRECTION',
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
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'NORMAL',
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
