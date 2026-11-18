-- +goose Up
-- +goose StatementBegin

-- Preserve bill_activity_logs when a utility_bill is archived (moved to archived_utility_bills)
-- or restored back into utility_bills, instead of deleting history via ON DELETE CASCADE.
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    FOR fk_name IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = current_schema()
          AND tc.table_name = 'bill_activity_logs'
          AND ccu.table_name = 'utility_bills'
    LOOP
        EXECUTE format('ALTER TABLE bill_activity_logs DROP CONSTRAINT IF EXISTS %I', fk_name);
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_bill_activity_logs_bill_id_created_at
    ON bill_activity_logs (bill_id, created_at DESC);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_bill_activity_logs_bill_id_created_at;

-- Remove orphaned logs before restoring FK on rollback
DELETE FROM bill_activity_logs
WHERE bill_id NOT IN (SELECT id FROM utility_bills);

ALTER TABLE bill_activity_logs
    ADD CONSTRAINT bill_activity_logs_bill_id_fkey
    FOREIGN KEY (bill_id) REFERENCES utility_bills(id) ON DELETE CASCADE;

-- +goose StatementEnd
