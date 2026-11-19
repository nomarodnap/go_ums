package ai

import (
	"context"
	"testing"
)

func TestSessionStoreNilPool(t *testing.T) {
	store := NewSessionStore(nil)

	// EnsureSchema with nil pool is a no-op returning nil
	if err := store.EnsureSchema(context.Background()); err != nil {
		t.Fatalf("expected nil error for nil pool EnsureSchema, got: %v", err)
	}

	// ListSessions with nil pool returns empty slice
	sessions, err := store.ListSessions(context.Background(), "user-1", "all", 10)
	if err != nil {
		t.Fatalf("expected nil error for ListSessions with nil pool, got: %v", err)
	}
	if len(sessions) != 0 {
		t.Fatalf("expected 0 sessions, got: %d", len(sessions))
	}

	// GetSessionMessages with nil pool returns empty slice
	msgs, err := store.GetSessionMessages(context.Background(), "sess-1", "user-1")
	if err != nil {
		t.Fatalf("expected nil error for GetSessionMessages with nil pool, got: %v", err)
	}
	if len(msgs) != 0 {
		t.Fatalf("expected 0 messages, got: %d", len(msgs))
	}

	// CreateSession with nil pool returns error
	if _, err := store.CreateSession(context.Background(), "user-1", "all", "", "New Session"); err == nil {
		t.Fatalf("expected error for CreateSession with nil pool")
	}

	// AppendMessage with nil pool returns error
	if _, err := store.AppendMessage(context.Background(), "sess-1", "user", "hello", "", nil); err == nil {
		t.Fatalf("expected error for AppendMessage with nil pool")
	}
	if _, err := store.AppendMessage(context.Background(), "sess-1", "user", "bill", "", nil, "bill.pdf", "application/pdf"); err == nil {
		t.Fatalf("expected error for AppendMessage with attachmentMeta and nil pool")
	}

	// DeleteSession with nil pool returns error
	if err := store.DeleteSession(context.Background(), "sess-1", "user-1"); err == nil {
		t.Fatalf("expected error for DeleteSession with nil pool")
	}
}
