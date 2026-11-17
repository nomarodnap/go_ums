-- +goose Up
-- +goose StatementBegin
ALTER TABLE department_services ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_department_services_suspended_at ON department_services(suspended_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_department_services_suspended_at;
ALTER TABLE department_services DROP COLUMN IF EXISTS suspended_at;
-- +goose StatementEnd

