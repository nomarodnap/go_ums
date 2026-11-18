-- +goose Up
-- +goose StatementBegin

-- =====================================================================
-- 1. PostgreSQL Extensions: pg_trgm (Thai/substring ILIKE) & pg_stat_statements (Observability)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_stat_statements requires shared_preload_libraries = ''pg_stat_statements''. Skipped on this host.';
END $$;

-- =====================================================================
-- 2. GIN Trigram Indexes (Accelerate Thai & substring ILIKE '%...%' queries)
-- =====================================================================
-- Departments (used by AI tools, LINE chat search, department lookup)
CREATE INDEX IF NOT EXISTS idx_departments_full_name_trgm
    ON departments USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_departments_short_name_trgm
    ON departments USING GIN (short_name gin_trgm_ops);

-- Utility Bills (bill_code, service_number, invoice_number, provider)
CREATE INDEX IF NOT EXISTS idx_utility_bills_bill_code_trgm
    ON utility_bills USING GIN (bill_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_utility_bills_service_number_trgm
    ON utility_bills USING GIN (service_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_utility_bills_invoice_number_trgm
    ON utility_bills USING GIN (invoice_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_utility_bills_provider_trgm
    ON utility_bills USING GIN (provider gin_trgm_ops);

-- LINE Chat Sessions & Users (used by LINE inbox search)
CREATE INDEX IF NOT EXISTS idx_line_chat_sessions_display_name_trgm
    ON line_chat_sessions USING GIN (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_line_chat_sessions_last_msg_trgm
    ON line_chat_sessions USING GIN (last_message_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_name_trgm
    ON "user" USING GIN (name gin_trgm_ops);

-- =====================================================================
-- 3. Composite & Partial Indexes (Hot paths: Unpaid Bills, Open Audits, Unread Notifications)
-- =====================================================================
-- Audits FK join + partial indexes for open / anomalous audits
CREATE INDEX IF NOT EXISTS idx_audits_utility_bill_id
    ON audits (utility_bill_id);

CREATE INDEX IF NOT EXISTS idx_audits_open_issues
    ON audits (utility_bill_id, status)
    WHERE status <> 'CORRECTED';

CREATE INDEX IF NOT EXISTS idx_audits_anomalies_partial
    ON audits (utility_bill_id)
    WHERE (
        is_late_receive OR
        is_late_payment OR
        is_overdue_more_than_2_months OR
        is_disbursement_over_2_months OR
        is_wrong_month OR
        is_phone_over_limit OR
        is_phone_usage_over_limit OR
        is_wrong_budget OR
        is_duplicate OR
        is_anomaly_expense OR
        is_manual_anomaly
    );

-- Utility Bills: department + billing period + partial indexes for unpaid & unreviewed queues
CREATE INDEX IF NOT EXISTS idx_utility_bills_dept_period
    ON utility_bills (department_id, billing_year DESC, billing_month DESC);

CREATE INDEX IF NOT EXISTS idx_utility_bills_unpaid_partial
    ON utility_bills (department_id, billing_year DESC, billing_month DESC)
    WHERE payment_status <> 'PAID';

CREATE INDEX IF NOT EXISTS idx_utility_bills_unreviewed_partial
    ON utility_bills (department_id, created_at DESC)
    WHERE is_reviewed = false;

-- Notifications: partial indexes for fast unread badge counts & feed queries
CREATE INDEX IF NOT EXISTS idx_notifications_unread_dept_partial
    ON notifications (department_id, created_at DESC)
    WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_unread_role_partial
    ON notifications (target_role, created_at DESC)
    WHERE is_read = false;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_notifications_unread_role_partial;
DROP INDEX IF EXISTS idx_notifications_unread_dept_partial;
DROP INDEX IF EXISTS idx_utility_bills_unreviewed_partial;
DROP INDEX IF EXISTS idx_utility_bills_unpaid_partial;
DROP INDEX IF EXISTS idx_utility_bills_dept_period;
DROP INDEX IF EXISTS idx_audits_anomalies_partial;
DROP INDEX IF EXISTS idx_audits_open_issues;
DROP INDEX IF EXISTS idx_audits_utility_bill_id;
DROP INDEX IF EXISTS idx_user_name_trgm;
DROP INDEX IF EXISTS idx_line_chat_sessions_last_msg_trgm;
DROP INDEX IF EXISTS idx_line_chat_sessions_display_name_trgm;
DROP INDEX IF EXISTS idx_utility_bills_provider_trgm;
DROP INDEX IF EXISTS idx_utility_bills_invoice_number_trgm;
DROP INDEX IF EXISTS idx_utility_bills_service_number_trgm;
DROP INDEX IF EXISTS idx_utility_bills_bill_code_trgm;
DROP INDEX IF EXISTS idx_departments_short_name_trgm;
DROP INDEX IF EXISTS idx_departments_full_name_trgm;
-- +goose StatementEnd
