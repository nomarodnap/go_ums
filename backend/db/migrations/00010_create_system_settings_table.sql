-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default announcement setting
INSERT INTO system_settings (key, value)
VALUES ('login_announcements', '{
    "isEnabled": false,
    "intervalSeconds": 5,
    "images": []
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS system_settings;
-- +goose StatementEnd

