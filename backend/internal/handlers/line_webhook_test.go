package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/linenotify"
)

type mockLineMessenger struct {
	mu            sync.Mutex
	hasSecret     bool
	validSig      string
	loadingCalled bool
	replies       []string
	pushes        map[string][]string
	appURL        string
}

func (m *mockLineMessenger) HasChannelSecret() bool {
	return m.hasSecret
}

func (m *mockLineMessenger) VerifySignature(body []byte, signature string) bool {
	return signature == m.validSig
}

func (m *mockLineMessenger) ShowLoadingAnimation(ctx context.Context, chatId string, seconds int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.loadingCalled = true
	return nil
}

func (m *mockLineMessenger) ReplyMessage(ctx context.Context, replyToken string, text string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if replyToken == "force-push" {
		return errors.New("reply token expired")
	}
	m.replies = append(m.replies, text)
	return nil
}

func (m *mockLineMessenger) PushMessage(ctx context.Context, toUserID string, text string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.pushes == nil {
		m.pushes = make(map[string][]string)
	}
	m.pushes[toUserID] = append(m.pushes[toUserID], text)
	return nil
}

func (m *mockLineMessenger) GetAppURL() string {
	return m.appURL
}

func (m *mockLineMessenger) GetUserProfile(ctx context.Context, lineUserID string) (*linenotify.LineProfile, error) {
	return &linenotify.LineProfile{
		UserID:      lineUserID,
		DisplayName: "Mock LINE User",
		PictureURL:  "https://profile.line-scdn.net/mock-avatar",
	}, nil
}

type mockLineUserFinder struct {
	users map[string]*linenotify.LineConnectedUser
	err   error
}

func (f *mockLineUserFinder) FindUserByLineAccountID(_ context.Context, accountID string) (*linenotify.LineConnectedUser, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.users[accountID], nil
}

type mockLineChatter struct {
	mu           sync.Mutex
	lastScope    ai.UserScope
	lastHistory  []ai.ChatMessage
	reply        string
	err          error
	isConfigured bool
}

func (c *mockLineChatter) IsConfigured() bool {
	return c.isConfigured
}

func (c *mockLineChatter) Chat(_ context.Context, scope ai.UserScope, history []ai.ChatMessage) (*ai.ChatResult, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lastScope = scope
	c.lastHistory = history
	if c.err != nil {
		return nil, c.err
	}
	return &ai.ChatResult{
		Reply:     c.reply,
		ToolsUsed: []string{"get_utility_summary"},
		Model:     "gemini-test",
	}, nil
}

func TestLineWebhookSignatureValidation(t *testing.T) {
	messenger := &mockLineMessenger{
		hasSecret: true,
		validSig:  "correct-sig",
	}
	handler := NewLineWebhookHandler(nil, messenger, &mockLineUserFinder{}, &mockLineChatter{}, nil)

	// 1. Invalid signature
	req := httptest.NewRequest(http.MethodPost, "/api/line/webhook", bytes.NewReader([]byte(`{"events":[]}`)))
	req.Header.Set("X-Line-Signature", "wrong-sig")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for bad signature, got %d", rec.Code)
	}

	// 2. Valid signature
	req = httptest.NewRequest(http.MethodPost, "/api/line/webhook", bytes.NewReader([]byte(`{"events":[]}`)))
	req.Header.Set("X-Line-Signature", "correct-sig")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid signature, got %d", rec.Code)
	}
}

func TestLineWebhookUnlinkedUserReply(t *testing.T) {
	messenger := &mockLineMessenger{appURL: "http://localhost:3000"}
	finder := &mockLineUserFinder{users: map[string]*linenotify.LineConnectedUser{}}
	chatter := &mockLineChatter{isConfigured: true}
	handler := NewLineWebhookHandler(nil, messenger, finder, chatter, nil)

	payload := LineWebhookRequest{
		Events: []LineWebhookEvent{
			{
				Type:       "message",
				ReplyToken: "reply-123",
				Source:     LineWebhookSource{Type: "user", UserID: "U-unknown"},
				Message:    &LineWebhookMessage{Type: "text", Text: "เดือนนี้ค่าไฟเท่าไหร่"},
			},
		},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/line/webhook", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	// Wait for background goroutine
	time.Sleep(50 * time.Millisecond)

	messenger.mu.Lock()
	defer messenger.mu.Unlock()
	if len(messenger.replies) == 0 {
		t.Fatalf("expected unlinked user warning reply, got 0 replies")
	}
	reply := messenger.replies[0]
	if !strings.Contains(reply, "ยังไม่พบบัญชีผู้ใช้งานระบบ UMS") || !strings.Contains(reply, "แก้ไขข้อมูลส่วนตัว") {
		t.Fatalf("unexpected unlinked user message: %s", reply)
	}
}

func TestLineWebhookLinkedUserAnswersWithDepartmentScope(t *testing.T) {
	messenger := &mockLineMessenger{appURL: "http://localhost:3000"}
	finder := &mockLineUserFinder{
		users: map[string]*linenotify.LineConnectedUser{
			"U-kongkiat": {
				UserID:         "user-001",
				Name:           "ก้องเกียรติ",
				Role:           "admin", // Even if role is admin...
				DepartmentID:   "dept-it-01",
				DepartmentName: "ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร",
				IsBanned:       false,
			},
		},
	}
	chatter := &mockLineChatter{
		isConfigured: true,
		reply:        "ในรอบบิลเดือนนี้ หน่วยงานศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร มีค่าไฟฟ้ารวม 45,200.00 บาทครับ",
	}
	sessionStore := NewLineSessionStore()
	handler := NewLineWebhookHandler(nil, messenger, finder, chatter, sessionStore)

	payload := LineWebhookRequest{
		Events: []LineWebhookEvent{
			{
				Type:       "message",
				ReplyToken: "reply-456",
				Source:     LineWebhookSource{Type: "user", UserID: "U-kongkiat"},
				Message:    &LineWebhookMessage{Type: "text", Text: "สรุปค่าไฟเดือนนี้หน่อย"},
			},
		},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/line/webhook", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	time.Sleep(50 * time.Millisecond)

	chatter.mu.Lock()
	defer chatter.mu.Unlock()

	// Verify requirement: "ตอบคำถามแค่เฉพาะระดับหน่วยงานของผู้ใช้นั้นๆเท่านั้นนะ ไม่ใช่ระดับทั้งกรม"
	if chatter.lastScope.IsAdmin {
		t.Fatalf("expected IsAdmin to be FALSE for LINE OA chat to lock to department level, got true")
	}
	if chatter.lastScope.DepartmentID != "dept-it-01" {
		t.Fatalf("expected DepartmentID 'dept-it-01', got %s", chatter.lastScope.DepartmentID)
	}
	if chatter.lastScope.DepartmentName != "ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร" {
		t.Fatalf("unexpected DepartmentName: %s", chatter.lastScope.DepartmentName)
	}
	if chatter.lastScope.Channel != "line" {
		t.Fatalf("expected Channel 'line', got %s", chatter.lastScope.Channel)
	}

	messenger.mu.Lock()
	defer messenger.mu.Unlock()
	if len(messenger.replies) == 0 {
		t.Fatalf("expected AI reply sent to LINE user")
	}
	if !strings.Contains(messenger.replies[0], "45,200.00 บาท") {
		t.Fatalf("unexpected AI reply: %s", messenger.replies[0])
	}

	// Verify history was recorded in sessionStore
	history := sessionStore.GetHistory("U-kongkiat")
	if len(history) != 2 {
		t.Fatalf("expected 2 history items (1 user + 1 assistant), got %d", len(history))
	}
	if history[0].Role != "user" || history[1].Role != "assistant" {
		t.Fatalf("unexpected history turn roles: %#v", history)
	}
}

func TestLineWebhookFallbackToPushWhenReplyFails(t *testing.T) {
	messenger := &mockLineMessenger{appURL: "http://localhost:3000"}
	finder := &mockLineUserFinder{
		users: map[string]*linenotify.LineConnectedUser{
			"U-user-push": {
				UserID:         "user-002",
				Name:           "สมชาย",
				Role:           "user",
				DepartmentID:   "dept-north-01",
				DepartmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
			},
		},
	}
	chatter := &mockLineChatter{
		isConfigured: true,
		reply:        "ยอดค้างชำระทั้งหมด 0.00 บาทครับ",
	}
	handler := NewLineWebhookHandler(nil, messenger, finder, chatter, nil)

	payload := LineWebhookRequest{
		Events: []LineWebhookEvent{
			{
				Type:       "message",
				ReplyToken: "force-push", // Will fail ReplyMessage and trigger PushMessage
				Source:     LineWebhookSource{Type: "user", UserID: "U-user-push"},
				Message:    &LineWebhookMessage{Type: "text", Text: "มีบิลค้างไหม"},
			},
		},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/line/webhook", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	time.Sleep(50 * time.Millisecond)

	messenger.mu.Lock()
	defer messenger.mu.Unlock()
	pushes := messenger.pushes["U-user-push"]
	if len(pushes) == 0 {
		t.Fatalf("expected fallback push message to user, got 0 pushes")
	}
	if !strings.Contains(pushes[0], "0.00 บาท") {
		t.Fatalf("unexpected fallback push text: %s", pushes[0])
	}
}

