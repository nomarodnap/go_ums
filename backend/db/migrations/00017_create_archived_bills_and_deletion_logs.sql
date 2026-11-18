-- +goose Up
-- +goose StatementBegin

-- 1. Archived Utility Bills (2-step deletion staging area before permanent delete)
CREATE TABLE IF NOT EXISTS archived_utility_bills (
    id TEXT PRIMARY KEY,
    bill_code TEXT NOT NULL,
    department_id TEXT NOT NULL,
    department_name TEXT,
    deposit_unit_id TEXT,
    utility_type TEXT NOT NULL,
    billing_month INTEGER NOT NULL,
    billing_year INTEGER NOT NULL,
    provider TEXT,
    service_number TEXT,
    invoice_number TEXT,
    invoice_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    bill_data JSONB NOT NULL,
    archived_by TEXT NOT NULL,
    archived_by_name TEXT,
    archive_reason TEXT,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archived_bills_dept_at
    ON archived_utility_bills (department_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_archived_bills_archived_at
    ON archived_utility_bills (archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_archived_bills_period
    ON archived_utility_bills (billing_year DESC, billing_month DESC);

CREATE INDEX IF NOT EXISTS idx_archived_bills_bill_code
    ON archived_utility_bills (bill_code);

-- 2. Permanent Bill Deletion / Archive / Restore Audit Logs (survives permanent deletion)
CREATE TABLE IF NOT EXISTS bill_deletion_logs (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL,
    bill_code TEXT NOT NULL,
    department_id TEXT,
    department_name TEXT,
    utility_type TEXT,
    service_number TEXT,
    billing_month INTEGER,
    billing_year INTEGER,
    invoice_amount NUMERIC(15, 2),
    action TEXT NOT NULL, -- 'ARCHIVED' | 'RESTORED' | 'PERMANENTLY_DELETED'
    reason TEXT,
    performed_by TEXT NOT NULL,
    performed_by_name TEXT,
    bill_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_deletion_logs_created_at
    ON bill_deletion_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bill_deletion_logs_dept_at
    ON bill_deletion_logs (department_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bill_deletion_logs_action
    ON bill_deletion_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bill_deletion_logs_bill_id
    ON bill_deletion_logs (bill_id);

-- Optional Trigram indexes when pg_trgm is available
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_archived_bills_code_trgm
        ON archived_utility_bills USING GIN (bill_code gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_archived_bills_sn_trgm
        ON archived_utility_bills USING GIN (service_number gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_bill_deletion_logs_code_trgm
        ON bill_deletion_logs USING GIN (bill_code gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_bill_deletion_logs_sn_trgm
        ON bill_deletion_logs USING GIN (service_number gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm not available; skipped trigram indexes on archive tables.';
END $$;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS bill_deletion_logs;
DROP TABLE IF EXISTS archived_utility_bills;
-- +goose StatementEnd
