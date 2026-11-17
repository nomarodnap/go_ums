-- +goose Up
-- +goose StatementBegin
ALTER TABLE line_chat_sessions
ADD COLUMN IF NOT EXISTS staff_active_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS line_chat_sessions_staff_active_idx 
ON line_chat_sessions (reply_mode, staff_active_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS line_chat_sessions_staff_active_idx;

ALTER TABLE line_chat_sessions
DROP COLUMN IF EXISTS staff_active_at;
-- +goose StatementEnd

