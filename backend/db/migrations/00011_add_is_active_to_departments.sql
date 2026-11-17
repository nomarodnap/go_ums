-- +goose Up
-- +goose StatementBegin
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_departments_is_active;
ALTER TABLE departments DROP COLUMN IF EXISTS suspended_at;
ALTER TABLE departments DROP COLUMN IF EXISTS is_active;
-- +goose StatementEnd

