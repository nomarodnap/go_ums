-- +goose Up
-- +goose StatementBegin

-- 1. L2 Cache: Postgres UNLOGGED TABLE (High speed transient cache without WAL overhead)
CREATE UNLOGGED TABLE IF NOT EXISTS app_cache (
    key TEXT PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_cache_expires_at ON app_cache(expires_at);

-- 2. Full-Text Search (tsvector + GIN) for Utility Bills and Departments
CREATE INDEX IF NOT EXISTS idx_utility_bills_fts ON utility_bills USING GIN (
    to_tsvector('simple', coalesce(bill_code, '') || ' ' || coalesce(invoice_number, '') || ' ' || coalesce(service_number, '') || ' ' || coalesce(provider, '') || ' ' || coalesce(payment_doc_number, ''))
);

CREATE INDEX IF NOT EXISTS idx_departments_fts ON departments USING GIN (
    to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(short_name, '') || ' ' || coalesce(cost_center_code, '') || ' ' || coalesce(location, ''))
);

-- 3. pgvector: Attempt to create vector extension if installed on host OS
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not installed on host OS yet. Skipped.';
END $$;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_departments_fts;
DROP INDEX IF EXISTS idx_utility_bills_fts;
DROP TABLE IF EXISTS app_cache;
-- +goose StatementEnd
