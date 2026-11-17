-- +goose Up
-- +goose StatementBegin
ALTER TABLE department_services ADD COLUMN IF NOT EXISTS phone_owner_division TEXT;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE department_services DROP COLUMN IF EXISTS phone_owner_division;
-- +goose StatementEnd
