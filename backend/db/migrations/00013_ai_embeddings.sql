-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS ai_embeddings (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'bill' or 'department'
    entity_id TEXT NOT NULL,
    department_id TEXT,
    search_text TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding DOUBLE PRECISION[] NOT NULL,
    model TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS ai_embeddings_entity_idx ON ai_embeddings (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ai_embeddings_dept_idx ON ai_embeddings (department_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS ai_embeddings;
-- +goose StatementEnd

