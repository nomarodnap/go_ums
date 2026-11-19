package ai

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ChatSession struct {
	ID             string    `json:"id"`
	UserID         string    `json:"userId"`
	Title          string    `json:"title"`
	Scope          string    `json:"scope"`
	DepartmentID   string    `json:"departmentId,omitempty"`
	DepartmentName string    `json:"departmentName,omitempty"`
	MessageCount   int       `json:"messageCount"`
	LastMessage    string    `json:"lastMessage,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type ChatSessionMessage struct {
	ID             string    `json:"id"`
	SessionID      string    `json:"sessionId"`
	Role           string    `json:"role"`
	Content        string    `json:"content"`
	ToolsUsed      []string  `json:"toolsUsed"`
	Model          string    `json:"model"`
	AttachmentName string    `json:"attachmentName,omitempty"`
	AttachmentType string    `json:"attachmentType,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

type SessionStore struct {
	pool        *pgxpool.Pool
	schemaMu    sync.Mutex
	schemaReady bool
}

func NewSessionStore(pool *pgxpool.Pool) *SessionStore {
	return &SessionStore{
		pool: pool,
	}
}

func (s *SessionStore) EnsureSchema(ctx context.Context) error {
	if s == nil || s.pool == nil {
		return nil
	}
	s.schemaMu.Lock()
	defer s.schemaMu.Unlock()
	if s.schemaReady {
		return nil
	}

	ddlCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	_, err := s.pool.Exec(ddlCtx, `
		CREATE TABLE IF NOT EXISTS ai_chat_sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			title TEXT NOT NULL DEFAULT 'บทสนทนาใหม่',
			scope TEXT NOT NULL DEFAULT 'all',
			department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_idx ON ai_chat_sessions (user_id, updated_at DESC);
		CREATE INDEX IF NOT EXISTS ai_chat_sessions_dept_idx ON ai_chat_sessions (department_id);

		CREATE TABLE IF NOT EXISTS ai_chat_messages (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			tools_used TEXT[] NOT NULL DEFAULT '{}',
			model TEXT NOT NULL DEFAULT '',
			attachment_name TEXT NOT NULL DEFAULT '',
			attachment_type TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS ai_chat_messages_session_idx ON ai_chat_messages (session_id, created_at ASC);

		ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT NOT NULL DEFAULT '';
		ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT NOT NULL DEFAULT '';
	`)
	if err == nil {
		s.schemaReady = true
	}
	return err
}

func (s *SessionStore) ListSessions(ctx context.Context, userID, scope string, limit int) ([]ChatSession, error) {
	if s == nil || s.pool == nil {
		return []ChatSession{}, nil
	}
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT 
			s.id, s.user_id, s.title, s.scope, 
			COALESCE(s.department_id, ''), 
			COALESCE(d.full_name, ''),
			COALESCE(m_stat.cnt, 0),
			COALESCE(m_stat.last_content, ''),
			s.created_at, s.updated_at
		FROM ai_chat_sessions s
		LEFT JOIN departments d ON s.department_id = d.id
		LEFT JOIN LATERAL (
			SELECT 
				COUNT(*)::int AS cnt,
				(SELECT content FROM ai_chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) AS last_content
			FROM ai_chat_messages 
			WHERE session_id = s.id
		) m_stat ON true
		WHERE s.user_id = $1 AND ($2::text = '' OR s.scope = $2)
		ORDER BY s.updated_at DESC
		LIMIT $3
	`

	rows, err := s.pool.Query(ctx, query, userID, scope, limit)
	if err != nil {
		return nil, fmt.Errorf("list ai chat sessions: %w", err)
	}
	defer rows.Close()

	var sessions []ChatSession
	for rows.Next() {
		var cs ChatSession
		if err := rows.Scan(
			&cs.ID, &cs.UserID, &cs.Title, &cs.Scope,
			&cs.DepartmentID, &cs.DepartmentName,
			&cs.MessageCount, &cs.LastMessage,
			&cs.CreatedAt, &cs.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan session: %w", err)
		}
		sessions = append(sessions, cs)
	}
	return sessions, nil
}

func (s *SessionStore) GetSession(ctx context.Context, sessionID, userID string) (*ChatSession, error) {
	if s == nil || s.pool == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			s.id, s.user_id, s.title, s.scope, 
			COALESCE(s.department_id, ''), 
			COALESCE(d.full_name, ''),
			COALESCE(m_stat.cnt, 0),
			COALESCE(m_stat.last_content, ''),
			s.created_at, s.updated_at
		FROM ai_chat_sessions s
		LEFT JOIN departments d ON s.department_id = d.id
		LEFT JOIN LATERAL (
			SELECT 
				COUNT(*)::int AS cnt,
				(SELECT content FROM ai_chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) AS last_content
			FROM ai_chat_messages 
			WHERE session_id = s.id
		) m_stat ON true
		WHERE s.id = $1 AND ($2::text = '' OR s.user_id = $2)
	`
	var cs ChatSession
	err := s.pool.QueryRow(ctx, query, sessionID, userID).Scan(
		&cs.ID, &cs.UserID, &cs.Title, &cs.Scope,
		&cs.DepartmentID, &cs.DepartmentName,
		&cs.MessageCount, &cs.LastMessage,
		&cs.CreatedAt, &cs.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}
	return &cs, nil
}

func (s *SessionStore) GetSessionMessages(ctx context.Context, sessionID, userID string) ([]ChatSessionMessage, error) {
	if s == nil || s.pool == nil {
		return []ChatSessionMessage{}, nil
	}
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}

	if userID != "" {
		if _, err := s.GetSession(ctx, sessionID, userID); err != nil {
			return nil, err
		}
	}

	query := `
		SELECT id, session_id, role, content, tools_used, model,
		       COALESCE(attachment_name, ''), COALESCE(attachment_type, ''), created_at
		FROM ai_chat_messages
		WHERE session_id = $1
		ORDER BY created_at ASC
	`
	rows, err := s.pool.Query(ctx, query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("get session messages: %w", err)
	}
	defer rows.Close()

	var msgs []ChatSessionMessage
	for rows.Next() {
		var m ChatSessionMessage
		if err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.ToolsUsed, &m.Model, &m.AttachmentName, &m.AttachmentType, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan session message: %w", err)
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}

func (s *SessionStore) CreateSession(ctx context.Context, userID, scope, departmentID, title string) (*ChatSession, error) {
	if s == nil || s.pool == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}

	id := uuid.New().String()
	cleanTitle := strings.TrimSpace(title)
	if cleanTitle == "" {
		cleanTitle = "บทสนทนาใหม่"
	}
	cleanScope := strings.TrimSpace(scope)
	if cleanScope == "" {
		cleanScope = "all"
	}

	now := time.Now()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO ai_chat_sessions (id, user_id, title, scope, department_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $6)
	`, id, userID, cleanTitle, cleanScope, departmentID, now)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	return s.GetSession(ctx, id, userID)
}

func (s *SessionStore) AppendMessage(ctx context.Context, sessionID, role, content, model string, toolsUsed []string, attachmentMeta ...string) (*ChatSessionMessage, error) {
	if s == nil || s.pool == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}

	id := uuid.New().String()
	now := time.Now()
	if toolsUsed == nil {
		toolsUsed = []string{}
	}

	var attachmentName, attachmentType string
	if len(attachmentMeta) > 0 {
		attachmentName = attachmentMeta[0]
	}
	if len(attachmentMeta) > 1 {
		attachmentType = attachmentMeta[1]
	}

	_, err := s.pool.Exec(ctx, `
		INSERT INTO ai_chat_messages (id, session_id, role, content, tools_used, model, attachment_name, attachment_type, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, id, sessionID, role, content, toolsUsed, model, attachmentName, attachmentType, now)
	if err != nil {
		return nil, fmt.Errorf("append message: %w", err)
	}

	_, _ = s.pool.Exec(ctx, `UPDATE ai_chat_sessions SET updated_at = $1 WHERE id = $2`, now, sessionID)

	return &ChatSessionMessage{
		ID:             id,
		SessionID:      sessionID,
		Role:           role,
		Content:        content,
		ToolsUsed:      toolsUsed,
		Model:          model,
		AttachmentName: attachmentName,
		AttachmentType: attachmentType,
		CreatedAt:      now,
	}, nil
}

func (s *SessionStore) UpdateSessionTitle(ctx context.Context, sessionID, userID, title string) error {
	if s == nil || s.pool == nil {
		return fmt.Errorf("database unavailable")
	}
	if err := s.EnsureSchema(ctx); err != nil {
		return err
	}

	cleanTitle := strings.TrimSpace(title)
	if cleanTitle == "" {
		cleanTitle = "บทสนทนาใหม่"
	}

	res, err := s.pool.Exec(ctx, `
		UPDATE ai_chat_sessions 
		SET title = $1, updated_at = NOW() 
		WHERE id = $2 AND ($3::text = '' OR user_id = $3)
	`, cleanTitle, sessionID, userID)
	if err != nil {
		return fmt.Errorf("update session title: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}

func (s *SessionStore) DeleteSession(ctx context.Context, sessionID, userID string) error {
	if s == nil || s.pool == nil {
		return fmt.Errorf("database unavailable")
	}
	if err := s.EnsureSchema(ctx); err != nil {
		return err
	}

	res, err := s.pool.Exec(ctx, `
		DELETE FROM ai_chat_sessions 
		WHERE id = $1 AND ($2::text = '' OR user_id = $2)
	`, sessionID, userID)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}
