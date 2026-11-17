-- +goose Up
-- +goose StatementBegin
ALTER TABLE department_services ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_department_services_is_active ON department_services(is_active);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_department_services_is_active;
ALTER TABLE department_services DROP COLUMN IF EXISTS is_active;
-- +goose StatementEnd
