-- +goose Up
-- +goose StatementBegin
CREATE INDEX IF NOT EXISTS idx_department_services_service_number_upper ON department_services (UPPER(TRIM(service_number)));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_department_services_service_number_upper;
-- +goose StatementEnd
