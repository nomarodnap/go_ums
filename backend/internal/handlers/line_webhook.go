package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	chi "github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/linenotify"
)

const (
	maxLineHistoryMessages = 8
	lineSessionTTL          = 20 * time.Minute
)

// LineWebhookRequest models the incoming webhook payload from LINE Messaging API.
type LineWebhookRequest struct {
	Destination string             `json:"destination"`
	Events      []LineWebhookEvent `json:"events"`
}

// LineWebhookEvent models a single webhook event from LINE.
type LineWebhookEvent struct {
	Type           string              `json:"type"` // "message", "follow", "unfollow"
	Mode           string              `json:"mode"`
	Timestamp      int64               `json:"timestamp"`
	Source         LineWebhookSource   `json:"source"`
	WebhookEventID string              `json:"webhookEventId"`
	ReplyToken     string              `json:"replyToken"`
	Message        *LineWebhookMessage `json:"message,omitempty"`
}

// LineWebhookSource models the origin of an event.
type LineWebhookSource struct {
	Type    string `json:"type"` // "user", "group", "room"
	UserID  string `json:"userId"`
	GroupID string `json:"groupId,omitempty"`
	RoomID  string `json:"roomId,omitempty"`
}

// LineWebhookMessage models the message payload inside an event.
type LineWebhookMessage struct {
	ID   string `json:"id"`
	Type string `json:"type"` // "text", "sticker", "image", etc.
	Text string `json:"text"`
}

// LineUserFinder finds user and department info by connected LINE account ID.
type LineUserFinder interface {
	FindUserByLineAccountID(ctx context.Context, accountID string) (*linenotify.LineConnectedUser, error)
}

// LineChatter abstracts the AI Chat service for testing.
type LineChatter interface {
	Chat(ctx context.Context, scope ai.UserScope, history []ai.ChatMessage) (*ai.ChatResult, error)
	IsConfigured() bool
}

// LineMessenger abstracts outbound LINE Messaging API calls.
type LineMessenger interface {
	HasChannelSecret() bool
	VerifySignature(body []byte, signature string) bool
	ShowLoadingAnimation(ctx context.Context, chatId string, seconds int) error
	ReplyMessage(ctx context.Context, replyToken string, text string) error
	PushMessage(ctx context.Context, toUserID string, text string) error
	GetAppURL() string
	GetUserProfile(ctx context.Context, lineUserID string) (*linenotify.LineProfile, error)
}

type lineChatSession struct {
	messages  []ai.ChatMessage
	updatedAt time.Time
}

// LineSessionStore maintains short-lived conversational history for LINE users.
type LineSessionStore struct {
	mu       sync.Mutex
	sessions map[string]*lineChatSession
}

// NewLineSessionStore initializes the in-memory LINE chat history store.
func NewLineSessionStore() *LineSessionStore {
	return &LineSessionStore{
		sessions: make(map[string]*lineChatSession),
	}
}

// GetHistory returns recent conversation history for a LINE user.
func (s *LineSessionStore) GetHistory(userID string) []ai.ChatMessage {
	if s == nil || userID == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	s.pruneExpiredLocked()
	sess, ok := s.sessions[userID]
	if !ok || sess == nil {
		return nil
	}
	copied := make([]ai.ChatMessage, len(sess.messages))
	copy(copied, sess.messages)
	return copied
}

// AppendTurn records a completed user prompt and assistant response.
func (s *LineSessionStore) AppendTurn(userID, userText, assistantReply string) {
	if s == nil || userID == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	sess, ok := s.sessions[userID]
	if !ok || sess == nil {
		sess = &lineChatSession{}
		s.sessions[userID] = sess
	}
	sess.updatedAt = time.Now()
	sess.messages = append(sess.messages,
		ai.ChatMessage{Role: "user", Content: strings.TrimSpace(userText)},
		ai.ChatMessage{Role: "assistant", Content: strings.TrimSpace(assistantReply)},
	)
	if len(sess.messages) > maxLineHistoryMessages {
		sess.messages = sess.messages[len(sess.messages)-maxLineHistoryMessages:]
	}
}

func (s *LineSessionStore) pruneExpiredLocked() {
	now := time.Now()
	for id, sess := range s.sessions {
		if now.Sub(sess.updatedAt) > lineSessionTTL {
			delete(s.sessions, id)
		}
	}
}

// RegisterLineWebhookRoutes attaches the LINE Messaging API Webhook endpoint to the Chi router.
func RegisterLineWebhookRoutes(router chi.Router, pool *pgxpool.Pool, cfg *config.Config, lineService *linenotify.Service, chatService *ai.ChatService) {
	sessionStore := NewLineSessionStore()
	handler := NewLineWebhookHandler(pool, lineService, lineService, chatService, sessionStore)
	handler.StartInactivityReverter(context.Background())

	router.Get("/api/line/webhook", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"UMS LINE Bot Webhook","time":"` + time.Now().Format(time.RFC3339) + `"}`))
	})

	router.Post("/api/line/webhook", handler.ServeHTTP)
}

// LineWebhookHandler handles incoming LINE Messaging API events and processes department-scoped AI queries.
type LineWebhookHandler struct {
	pool                   *pgxpool.Pool
	messenger              LineMessenger
	finder                 LineUserFinder
	chatter                LineChatter
	sessionStore           *LineSessionStore
	staffInactivityTimeout time.Duration
}

// NewLineWebhookHandler constructs a new webhook handler.
func NewLineWebhookHandler(pool *pgxpool.Pool, messenger LineMessenger, finder LineUserFinder, chatter LineChatter, sessionStore *LineSessionStore) *LineWebhookHandler {
	if sessionStore == nil {
		sessionStore = NewLineSessionStore()
	}
	timeout := 10 * time.Minute
	if envMins := os.Getenv("LINE_STAFF_INACTIVE_TIMEOUT_MINUTES"); envMins != "" {
		if mins, err := strconv.Atoi(envMins); err == nil && mins > 0 {
			timeout = time.Duration(mins) * time.Minute
		}
	}
	return &LineWebhookHandler{
		pool:                   pool,
		messenger:              messenger,
		finder:                 finder,
		chatter:                chatter,
		sessionStore:           sessionStore,
		staffInactivityTimeout: timeout,
	}
}

// StartInactivityReverter runs a background routine every minute to automatically switch idle MANUAL sessions back to AI.
func (h *LineWebhookHandler) StartInactivityReverter(ctx context.Context) {
	if h.pool == nil {
		return
	}
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				timeout := h.staffInactivityTimeout
				if timeout <= 0 {
					timeout = 10 * time.Minute
				}
				cutoff := time.Now().Add(-timeout)
				res, err := h.pool.Exec(context.Background(), `
					UPDATE line_chat_sessions
					SET reply_mode = 'AI', updated_at = NOW()
					WHERE reply_mode = 'MANUAL' AND COALESCE(staff_active_at, updated_at) < $1
				`, cutoff)
				if err == nil && res.RowsAffected() > 0 {
					log.Printf("[LINE Webhook] Auto-reverted %d inactive session(s) from MANUAL to AI mode", res.RowsAffected())
				}
			}
		}
	}()
}

func (h *LineWebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB limit
	if err != nil {
		log.Printf("[LINE Webhook] Failed to read request body: %v", err)
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}

	sig := r.Header.Get("X-Line-Signature")
	log.Printf("[LINE Webhook] Received POST /api/line/webhook from %s (bytes=%d, hasSig=%v)", r.RemoteAddr, len(body), sig != "")

	// Verify HMAC-SHA256 signature if Channel Secret is configured
	if h.messenger != nil && h.messenger.HasChannelSecret() {
		if sig == "" || !h.messenger.VerifySignature(body, sig) {
			log.Printf("[LINE Webhook] Rejected: Invalid X-Line-Signature. (Signature: %q). Ensure LINE_MESSAGING_CHANNEL_SECRET in .env matches Messaging API channel secret.", sig)
			http.Error(w, "invalid signature", http.StatusUnauthorized)
			return
		}
		log.Printf("[LINE Webhook] Signature verification successful")
	} else {
		log.Printf("[LINE Webhook] Warning: LINE_MESSAGING_CHANNEL_SECRET not set, signature check skipped")
	}

	var req LineWebhookRequest
	if err := json.Unmarshal(body, &req); err != nil {
		log.Printf("[LINE Webhook] Failed to parse JSON: %v", err)
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}

	// Immediate 200 OK so LINE never encounters a delivery timeout
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))

	// Empty events check (used by LINE Developers Console 'Verify' probe)
	if len(req.Events) == 0 {
		log.Printf("[LINE Webhook] Received 0 events (LINE Developers Console verify probe)")
		return
	}

	log.Printf("[LINE Webhook] Processing %d event(s)", len(req.Events))
	for _, event := range req.Events {
		ev := event
		go h.processEvent(context.Background(), ev)
	}
}

func (h *LineWebhookHandler) processEvent(ctx context.Context, event LineWebhookEvent) {
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	userID := strings.TrimSpace(event.Source.UserID)
	log.Printf("[LINE Webhook] Event received: type=%s, user=%s, replyToken=%s", event.Type, userID, event.ReplyToken)

	switch event.Type {
	case "follow":
		h.handleFollow(ctx, event)
	case "message":
		if event.Message == nil {
			return
		}
		if event.Message.Type != "text" {
			log.Printf("[LINE Webhook] Non-text message type %q from user %s", event.Message.Type, userID)
			h.replyOrPush(ctx, event.ReplyToken, userID,
				"ขอบคุณครับ! หากท่านมีข้อสงสัยเกี่ยวกับค่าสาธารณูปโภคหรือบิลของหน่วยงาน สามารถพิมพ์ข้อความสอบถามผมได้เลยนะครับ เช่น \"เดือนนี้มีบิลค้างจ่ายไหม\" หรือ \"สรุปค่าไฟปีนี้ให้หน่อย\" 😊")
			return
		}
		h.handleTextMessage(ctx, event)
	default:
		// ignore unfollow, postback, etc.
	}
}

func (h *LineWebhookHandler) handleFollow(ctx context.Context, event LineWebhookEvent) {
	appURL := "ระบบ UMS"
	if h.messenger != nil && h.messenger.GetAppURL() != "" {
		appURL = h.messenger.GetAppURL()
	}
	welcome := fmt.Sprintf(`สวัสดีครับ! ยินดีต้อนรับสู่ระบบรายงานค่าสาธารณูปโภค กรมประมง (UMS AI Assistant) 🐟

ท่านสามารถสอบถามข้อมูลค่าสาธารณูปโภค บิลค้างชำระ และงบประมาณเฉพาะหน่วยงานของท่านได้ตลอดเวลา

💡 หากท่านยังไม่ได้เชื่อมต่อบัญชี LINE ในระบบ UMS กรุณาเข้าสู่ระบบผ่านเว็บไซต์ (%s) ไปที่เมนู "แก้ไขข้อมูลส่วนตัว" เพื่อกดเชื่อมต่อบัญชี LINE ก่อนเริ่มใช้งานครับ`, appURL)

	h.replyOrPush(ctx, event.ReplyToken, event.Source.UserID, welcome)
}

func (h *LineWebhookHandler) handleTextMessage(ctx context.Context, event LineWebhookEvent) {
	userText := strings.TrimSpace(event.Message.Text)
	if userText == "" {
		return
	}
	userID := strings.TrimSpace(event.Source.UserID)
	if userID == "" {
		return
	}

	log.Printf("[LINE Webhook] Text message from %s: %q", userID, userText)

	// 1. Show typing loading animation in LINE chat
	if h.messenger != nil {
		if animErr := h.messenger.ShowLoadingAnimation(ctx, userID, 20); animErr != nil {
			log.Printf("[LINE Webhook] Loading animation error (non-fatal): %v", animErr)
		}
	}

	// 2. Identify linked UMS user
	if h.finder == nil {
		log.Printf("[LINE Webhook] Error: LineUserFinder is nil")
		h.replyOrPush(ctx, event.ReplyToken, userID, "ขออภัยครับ ระบบฐานข้อมูลยังไม่พร้อมให้บริการในขณะนี้")
		return
	}

	user, err := h.finder.FindUserByLineAccountID(ctx, userID)
	if err != nil {
		log.Printf("[LINE Webhook] Error querying user for line account %s: %v", userID, err)
		h.replyOrPush(ctx, event.ReplyToken, userID, "ขออภัยครับ เกิดข้อผิดพลาดในการตรวจสอบบัญชีผู้ใช้งาน กรุณาลองใหม่อีกครั้ง")
		return
	}

	// 3. Persist incoming user message to PostgreSQL and check reply mode (AI vs MANUAL)
	var sessionID string
	replyMode := "AI"
	if h.pool != nil {
		var uid *string
		var deptID *string
		var pictureURL *string
		displayName := "ผู้ใช้ LINE (ยังไม่เชื่อมต่อ)"
		if user != nil {
			uid = &user.UserID
			if user.DepartmentID != "" {
				deptID = &user.DepartmentID
			}
			if user.Name != "" {
				displayName = user.Name
			}
			if user.Image != "" {
				pictureURL = &user.Image
			}
		}

		// Sync profile (display name, picture URL) from LINE Messaging API
		if h.messenger != nil {
			profCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			prof, profErr := h.messenger.GetUserProfile(profCtx, userID)
			cancel()
			if profErr == nil && prof != nil {
				if prof.PictureURL != "" {
					pictureURL = &prof.PictureURL
				}
				if user == nil && prof.DisplayName != "" {
					displayName = prof.DisplayName
				}
			}
		}

		sessID := generateLineID("line_sess")
		upsertSQL := `
			INSERT INTO line_chat_sessions (
				id, line_user_id, user_id, department_id, display_name, picture_url, reply_mode, last_message_text, last_message_at, unread_admin_count, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, 'AI', $7, NOW(), 1, NOW()
			)
			ON CONFLICT (line_user_id) DO UPDATE SET
				user_id = COALESCE(EXCLUDED.user_id, line_chat_sessions.user_id),
				department_id = COALESCE(EXCLUDED.department_id, line_chat_sessions.department_id),
				display_name = COALESCE(EXCLUDED.display_name, line_chat_sessions.display_name),
				picture_url = COALESCE(EXCLUDED.picture_url, line_chat_sessions.picture_url),
				last_message_text = EXCLUDED.last_message_text,
				last_message_at = NOW(),
				unread_admin_count = line_chat_sessions.unread_admin_count + 1,
				updated_at = NOW()
			RETURNING id, reply_mode
		`
		if dbErr := h.pool.QueryRow(ctx, upsertSQL, sessID, userID, uid, deptID, displayName, pictureURL, userText).Scan(&sessionID, &replyMode); dbErr != nil {
			log.Printf("[LINE Webhook] Failed to upsert session for %s: %v", userID, dbErr)
		} else {
			msgID := generateLineID("line_msg")
			insertMsgSQL := `
				INSERT INTO line_chat_messages (id, session_id, line_user_id, sender_type, text, reply_token, created_at)
				VALUES ($1, $2, $3, 'USER', $4, $5, NOW())
			`
			if _, msgErr := h.pool.Exec(ctx, insertMsgSQL, msgID, sessionID, userID, userText, event.ReplyToken); msgErr != nil {
				log.Printf("[LINE Webhook] Failed to insert user message: %v", msgErr)
			}
		}
	}

	// 4. If conversation is in MANUAL mode, check staff inactivity before skipping AI!
	if strings.ToUpper(replyMode) == "MANUAL" {
		var staffActiveAt *time.Time
		if h.pool != nil && sessionID != "" {
			_ = h.pool.QueryRow(ctx, `SELECT COALESCE(staff_active_at, updated_at) FROM line_chat_sessions WHERE id = $1`, sessionID).Scan(&staffActiveAt)
		}

		timeout := h.staffInactivityTimeout
		if timeout <= 0 {
			timeout = 10 * time.Minute
		}

		if staffActiveAt != nil && time.Since(*staffActiveAt) > timeout {
			log.Printf("[LINE Webhook] Staff inactive for %v (> %v). Auto-reverting session %s to AI mode.",
				time.Since(*staffActiveAt).Round(time.Second), timeout, sessionID)

			if h.pool != nil {
				_, _ = h.pool.Exec(ctx, `UPDATE line_chat_sessions SET reply_mode = 'AI', updated_at = NOW() WHERE id = $1`, sessionID)
			}
			replyMode = "AI"
			// DO NOT RETURN: Falls through to AI processing below so the user gets answered!
		} else {
			elapsed := time.Duration(0)
			if staffActiveAt != nil {
				elapsed = time.Since(*staffActiveAt).Round(time.Second)
			}
			log.Printf("[LINE Webhook] Session %s (user %s) is in active MANUAL mode (staff active %v ago). AI auto-reply skipped.",
				sessionID, userID, elapsed)
			return
		}
	}

	recordBotReply := func(reply string) {
		if h.pool != nil && sessionID != "" && strings.TrimSpace(reply) != "" {
			aiMsgID := generateLineID("line_msg")
			now := time.Now()
			insertAIMsgSQL := `
				INSERT INTO line_chat_messages (id, session_id, line_user_id, sender_type, text, created_at)
				VALUES ($1, $2, $3, 'AI', $4, $5)
			`
			_, _ = h.pool.Exec(context.Background(), insertAIMsgSQL, aiMsgID, sessionID, userID, reply, now)
			_, _ = h.pool.Exec(context.Background(), `UPDATE line_chat_sessions SET last_message_text = $1, last_message_at = $2, updated_at = $2 WHERE id = $3`, reply, now, sessionID)
		}
	}

	// Case 1: Account not connected
	if user == nil {
		log.Printf("[LINE Webhook] Line account %s is not linked to any UMS user", userID)
		appURL := "ระบบ UMS"
		if h.messenger != nil && h.messenger.GetAppURL() != "" {
			appURL = h.messenger.GetAppURL()
		}
		msg := fmt.Sprintf(`ขออภัยครับ ยังไม่พบบัญชีผู้ใช้งานระบบ UMS ที่เชื่อมต่อกับบัญชี LINE นี้ 👤

กรุณาเข้าสู่ระบบผ่านเว็บไซต์ (%s) แล้วไปที่เมนู "แก้ไขข้อมูลส่วนตัว" เพื่อกดปุ่ม "เชื่อมต่อ LINE" หรือ "Resync LINE" ให้เรียบร้อยก่อน จึงจะสามารถสอบถามข้อมูลเฉพาะหน่วยงานได้ครับ`, appURL)
		h.replyOrPush(ctx, event.ReplyToken, userID, msg)
		recordBotReply(msg)
		return
	}

	// Case 2: User account is banned
	if user.IsBanned {
		log.Printf("[LINE Webhook] User %s (%s) is banned", user.UserID, user.Name)
		msg := "ขออภัยครับ บัญชีผู้ใช้งานของคุณถูกระงับการใช้งานในระบบ UMS กรุณาติดต่อผู้ดูแลระบบครับ"
		h.replyOrPush(ctx, event.ReplyToken, userID, msg)
		recordBotReply(msg)
		return
	}

	// Case 3: User has no department assigned
	if user.DepartmentID == "" {
		log.Printf("[LINE Webhook] User %s (%s) has no department assigned", user.UserID, user.Name)
		msg := fmt.Sprintf(`สวัสดีครับคุณ %s

บัญชีผู้ใช้ของคุณยังไม่ได้กำหนดสังกัดหน่วยงานในระบบ UMS จึงไม่สามารถดึงข้อมูลค่าสาธารณูปโภคเฉพาะหน่วยงานได้ กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดหน่วยงานก่อนครับ`, user.Name)
		h.replyOrPush(ctx, event.ReplyToken, userID, msg)
		recordBotReply(msg)
		return
	}

	log.Printf("[LINE Webhook] User identified: %s (name=%s, dept=%s - %s)", user.UserID, user.Name, user.DepartmentID, user.DepartmentName)

	// Case 4: Valid user with Department -> Strictly enforce department-level scope!
	// Per requirement: "ตอบคำถามแค่เฉพาะระดับหน่วยงานของผู้ใช้นั้นๆเท่านั้นนะ ไม่ใช่ระดับทั้งกรม"
	scope := ai.UserScope{
		UserID:         user.UserID,
		Role:           user.Role,
		IsAdmin:        false, // STRICTLY FALSE: never whole-department macro level!
		DepartmentID:   user.DepartmentID,
		DepartmentName: user.DepartmentName,
		Channel:        "line",
	}

	if h.chatter == nil || !h.chatter.IsConfigured() {
		log.Printf("[LINE Webhook] AI Chatter is not configured (missing GEMINI_API_KEY)")
		msg := "ขออภัยครับ ขณะนี้ระบบ AI ยังไม่ได้เปิดใช้งานในระบบ Backend กรุณาติดต่อผู้ดูแลระบบครับ"
		h.replyOrPush(ctx, event.ReplyToken, userID, msg)
		recordBotReply(msg)
		return
	}

	// Retrieve conversation history for context
	history := h.sessionStore.GetHistory(userID)
	history = append(history, ai.ChatMessage{Role: "user", Content: userText})

	log.Printf("[LINE Webhook] Calling AI Chat with history length %d...", len(history))
	t0 := time.Now()
	res, err := h.chatter.Chat(ctx, scope, history)
	if err != nil {
		log.Printf("[LINE Webhook] AI chat error for user %s (dept=%s, elapsed=%v): %v", userID, user.DepartmentID, time.Since(t0), err)
		msg := "ขออภัยครับ AI ไม่สามารถประมวลผลคำตอบได้ในขณะนี้ กรุณาลองถามใหม่อีกครั้งครับ"
		h.replyOrPush(ctx, event.ReplyToken, userID, msg)
		recordBotReply(msg)
		return
	}

	replyText := strings.TrimSpace(res.Reply)
	if replyText == "" {
		replyText = "ขออภัยครับ ระบบไม่สามารถสร้างคำตอบได้ กรุณาลองถามใหม่อีกครั้งครับ"
	}
	log.Printf("[LINE Webhook] AI generated reply in %v (%d chars)", time.Since(t0), len([]rune(replyText)))

	// Save turn to history
	h.sessionStore.AppendTurn(userID, userText, replyText)

	// Save AI reply to PostgreSQL
	recordBotReply(replyText)

	// Send reply to LINE
	h.replyOrPush(ctx, event.ReplyToken, userID, replyText)
}

func (h *LineWebhookHandler) replyOrPush(ctx context.Context, replyToken, userID, text string) {
	if h.messenger == nil || strings.TrimSpace(text) == "" {
		return
	}

	// Use an independent context with 15s timeout so that an earlier AI timeout never cancels the outbound reply!
	outboundCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Prefer replying with replyToken if available and not a dummy test token
	if replyToken != "" && replyToken != "00000000000000000000000000000000" && replyToken != "ffffffffffffffffffffffffffffffff" {
		if err := h.messenger.ReplyMessage(outboundCtx, replyToken, text); err == nil {
			log.Printf("[LINE Webhook] ReplyMessage delivered successfully to replyToken=%s", replyToken)
			return
		} else {
			log.Printf("[LINE Webhook] ReplyMessage failed for replyToken=%s: %v, falling back to PushMessage", replyToken, err)
		}
	}

	if userID != "" {
		if err := h.messenger.PushMessage(outboundCtx, userID, text); err != nil {
			log.Printf("[LINE Webhook] PushMessage failed for user %s: %v", userID, err)
		} else {
			log.Printf("[LINE Webhook] PushMessage delivered successfully to user %s", userID)
		}
	}
}

