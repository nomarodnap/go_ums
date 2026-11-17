-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS line_chat_sessions (
    id TEXT PRIMARY KEY,
    line_user_id TEXT NOT NULL UNIQUE,
    user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    display_name TEXT,
    picture_url TEXT,
    reply_mode TEXT NOT NULL DEFAULT 'AI', -- 'AI' or 'MANUAL'
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unread_admin_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS line_chat_sessions_user_idx ON line_chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS line_chat_sessions_dept_idx ON line_chat_sessions (department_id);
CREATE INDEX IF NOT EXISTS line_chat_sessions_last_msg_idx ON line_chat_sessions (last_message_at DESC);

CREATE TABLE IF NOT EXISTS line_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES line_chat_sessions(id) ON DELETE CASCADE,
    line_user_id TEXT NOT NULL,
    sender_type TEXT NOT NULL, -- 'USER', 'AI', 'ADMIN'
    admin_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    reply_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS line_chat_messages_session_idx ON line_chat_messages (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS line_chat_messages_line_user_idx ON line_chat_messages (line_user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS line_chat_messages;
DROP TABLE IF EXISTS line_chat_sessions;
-- +goose StatementEnd

