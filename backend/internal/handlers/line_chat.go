package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LineChatSessionDTO struct {
	ID               string     `json:"id" doc:"Session unique identifier"`
	LineUserID       string     `json:"lineUserId" doc:"LINE account user ID"`
	UserID           *string    `json:"userId,omitempty" doc:"Linked UMS user ID"`
	UserName         string     `json:"userName" doc:"User display name"`
	PictureURL       *string    `json:"pictureUrl,omitempty" doc:"User avatar or LINE profile picture URL"`
	DepartmentID     string     `json:"departmentId" doc:"Department ID"`
	DepartmentName   string     `json:"departmentName" doc:"Department full name"`
	ReplyMode        string     `json:"replyMode" doc:"Reply mode (AI or MANUAL)"`
	LastMessageText  string     `json:"lastMessageText" doc:"Last message content"`
	LastMessageAt    time.Time  `json:"lastMessageAt" doc:"Last message timestamp"`
	StaffActiveAt    *time.Time `json:"staffActiveAt,omitempty" doc:"Timestamp of last staff activity"`
	UnreadAdminCount int        `json:"unreadAdminCount" doc:"Unread messages count for admin"`
	CreatedAt        time.Time  `json:"createdAt" doc:"Session creation timestamp"`
}

type LineChatMessageDTO struct {
	ID         string    `json:"id" doc:"Message unique identifier"`
	SessionID  string    `json:"sessionId" doc:"Parent conversation session ID"`
	SenderType string    `json:"senderType" doc:"Sender type: USER, AI, ADMIN"`
	AdminName  *string   `json:"adminName,omitempty" doc:"Staff name if sender is ADMIN"`
	Text       string    `json:"text" doc:"Message text content"`
	CreatedAt  time.Time `json:"createdAt" doc:"Message sent timestamp"`
}

type ListLineConversationsInput struct {
	Search string `query:"search" doc:"Optional keyword search across user name, department, or message"`
	Mode   string `query:"mode" default:"ALL" doc:"Filter by mode: ALL, AI, MANUAL"`
	Page   int    `query:"page" default:"1" doc:"Page number (starts at 1)"`
	Limit  int    `query:"limit" default:"30" doc:"Items per page (max 100)"`
}

type ListLineConversationsOutput struct {
	Body struct {
		Items []LineChatSessionDTO `json:"items"`
		Total int                  `json:"total"`
		Page  int                  `json:"page"`
		Limit int                  `json:"limit"`
	} `json:"body"`
}

type GetLineConversationInput struct {
	ID string `path:"id" doc:"Session ID"`
}

type GetLineConversationOutput struct {
	Body struct {
		Conversation LineChatSessionDTO   `json:"conversation"`
		Messages     []LineChatMessageDTO `json:"messages"`
	} `json:"body"`
}

type UpdateLineChatModeInput struct {
	ID   string `path:"id" doc:"Session ID"`
	Body struct {
		Mode string `json:"mode" enum:"AI,MANUAL" doc:"Target reply mode: AI or MANUAL"`
	}
}

type UpdateLineChatModeOutput struct {
	Body LineChatSessionDTO `json:"body"`
}

type SendLineAdminMessageInput struct {
	ID   string `path:"id" doc:"Session ID"`
	Body struct {
		Text string `json:"text" minLength:"1" maxLength:"2000" doc:"Text message to deliver to the user's LINE chat"`
	}
}

type SendLineAdminMessageOutput struct {
	Body LineChatMessageDTO `json:"body"`
}

func generateLineID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}

func fetchConversationByID(ctx context.Context, pool *pgxpool.Pool, sessionID string) (*LineChatSessionDTO, error) {
	sessQuery := `
		SELECT 
			s.id,
			s.line_user_id,
			s.user_id,
			COALESCE(u.name, s.display_name, 'ผู้ใช้ LINE') as user_name,
			COALESCE(s.picture_url, u.image, '') as picture_url,
			COALESCE(u.department_id, s.department_id, '') as department_id,
			COALESCE(d.full_name, '') as department_name,
			s.reply_mode,
			COALESCE(s.last_message_text, ''),
			s.last_message_at,
			s.staff_active_at,
			s.unread_admin_count,
			s.created_at
		FROM line_chat_sessions s
		LEFT JOIN "user" u ON u.id = s.user_id
		LEFT JOIN departments d ON d.id = COALESCE(u.department_id, s.department_id)
		WHERE s.id = $1
	`
	var conv LineChatSessionDTO
	var picURL string
	if scanErr := pool.QueryRow(ctx, sessQuery, sessionID).Scan(
		&conv.ID,
		&conv.LineUserID,
		&conv.UserID,
		&conv.UserName,
		&picURL,
		&conv.DepartmentID,
		&conv.DepartmentName,
		&conv.ReplyMode,
		&conv.LastMessageText,
		&conv.LastMessageAt,
		&conv.StaffActiveAt,
		&conv.UnreadAdminCount,
		&conv.CreatedAt,
	); scanErr != nil {
		return nil, scanErr
	}
	if picURL != "" {
		conv.PictureURL = &picURL
	}
	return &conv, nil
}

// RegisterLineChatRoutes registers admin back-office endpoints for managing LINE OA conversations.
func RegisterLineChatRoutes(api huma.API, pool *pgxpool.Pool, messenger LineMessenger) {
	// 1. List LINE conversations
	huma.Register(api, huma.Operation{
		OperationID: "listLineConversations",
		Method:      http.MethodGet,
		Path:        "/api/line-chat/conversations",
		Summary:     "List LINE OA conversations for Admin Back-office",
		Tags:        []string{"LINE Chat", "Admin"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *ListLineConversationsInput) (*ListLineConversationsOutput, error) {
		_, err := auth.RequireRoles(ctx, "admin", "central_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden("สิทธิ์การเข้าถึงไม่เพียงพอ: เฉพาะผู้ดูแลระบบและเจ้าหน้าที่ส่วนกลาง")
		}

		if pool == nil {
			return nil, huma.Error500InternalServerError("ฐานข้อมูลไม่พร้อมใช้งาน")
		}

		limit := input.Limit
		if limit <= 0 {
			limit = 30
		} else if limit > 100 {
			limit = 100
		}

		page := input.Page
		if page <= 0 {
			page = 1
		}
		offset := (page - 1) * limit

		search := strings.TrimSpace(input.Search)
		mode := strings.ToUpper(strings.TrimSpace(input.Mode))
		if mode != "AI" && mode != "MANUAL" {
			mode = "ALL"
		}

		// Count total
		countQuery := `
			SELECT COUNT(*)
			FROM line_chat_sessions s
			LEFT JOIN "user" u ON u.id = s.user_id
			LEFT JOIN departments d ON d.id = COALESCE(u.department_id, s.department_id)
			WHERE ($1 = '' OR 
				   u.name ILIKE '%' || $1 || '%' OR 
				   d.full_name ILIKE '%' || $1 || '%' OR 
				   s.display_name ILIKE '%' || $1 || '%' OR
				   s.last_message_text ILIKE '%' || $1 || '%')
			  AND ($2 = 'ALL' OR s.reply_mode = $2)
		`
		var total int
		if countErr := pool.QueryRow(ctx, countQuery, search, mode).Scan(&total); countErr != nil {
			return nil, huma.Error500InternalServerError("failed to count conversations: " + countErr.Error())
		}

		// Query rows
		listQuery := `
			SELECT 
				s.id,
				s.line_user_id,
				s.user_id,
				COALESCE(u.name, s.display_name, 'ผู้ใช้ LINE') as user_name,
				COALESCE(s.picture_url, u.image, '') as picture_url,
				COALESCE(u.department_id, s.department_id, '') as department_id,
				COALESCE(d.full_name, '') as department_name,
				s.reply_mode,
				COALESCE(s.last_message_text, ''),
				s.last_message_at,
				s.staff_active_at,
				s.unread_admin_count,
				s.created_at
			FROM line_chat_sessions s
			LEFT JOIN "user" u ON u.id = s.user_id
			LEFT JOIN departments d ON d.id = COALESCE(u.department_id, s.department_id)
			WHERE ($1 = '' OR 
				   u.name ILIKE '%' || $1 || '%' OR 
				   d.full_name ILIKE '%' || $1 || '%' OR 
				   s.display_name ILIKE '%' || $1 || '%' OR
				   s.last_message_text ILIKE '%' || $1 || '%')
			  AND ($2 = 'ALL' OR s.reply_mode = $2)
			ORDER BY s.last_message_at DESC
			LIMIT $3 OFFSET $4
		`
		rows, err := pool.Query(ctx, listQuery, search, mode, limit, offset)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to query conversations: " + err.Error())
		}
		defer rows.Close()

		items := make([]LineChatSessionDTO, 0)
		for rows.Next() {
			var item LineChatSessionDTO
			var picURL string
			if scanErr := rows.Scan(
				&item.ID,
				&item.LineUserID,
				&item.UserID,
				&item.UserName,
				&picURL,
				&item.DepartmentID,
				&item.DepartmentName,
				&item.ReplyMode,
				&item.LastMessageText,
				&item.LastMessageAt,
				&item.StaffActiveAt,
				&item.UnreadAdminCount,
				&item.CreatedAt,
			); scanErr != nil {
				return nil, huma.Error500InternalServerError("failed to scan conversation: " + scanErr.Error())
			}
			if picURL != "" {
				item.PictureURL = &picURL
			}
			items = append(items, item)
		}

		out := &ListLineConversationsOutput{}
		out.Body.Items = items
		out.Body.Total = total
		out.Body.Page = page
		out.Body.Limit = limit
		return out, nil
	})

	// 2. Get conversation detail & messages
	huma.Register(api, huma.Operation{
		OperationID: "getLineConversation",
		Method:      http.MethodGet,
		Path:        "/api/line-chat/conversations/{id}",
		Summary:     "Get conversation history and messages",
		Tags:        []string{"LINE Chat", "Admin"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *GetLineConversationInput) (*GetLineConversationOutput, error) {
		_, err := auth.RequireRoles(ctx, "admin", "central_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden("สิทธิ์การเข้าถึงไม่เพียงพอ")
		}

		if pool == nil {
			return nil, huma.Error500InternalServerError("ฐานข้อมูลไม่พร้อมใช้งาน")
		}

		sessionID := strings.TrimSpace(input.ID)
		conv, scanErr := fetchConversationByID(ctx, pool, sessionID)
		if scanErr != nil {
			return nil, huma.Error404NotFound("ไม่พบบทสนทนาที่ต้องการ")
		}

		// If picture_url is missing, attempt on-the-fly fetch from LINE and cache
		if conv.PictureURL == nil && messenger != nil && conv.LineUserID != "" {
			profCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			prof, profErr := messenger.GetUserProfile(profCtx, conv.LineUserID)
			cancel()
			if profErr == nil && prof != nil && prof.PictureURL != "" {
				conv.PictureURL = &prof.PictureURL
				_, _ = pool.Exec(ctx, `UPDATE line_chat_sessions SET picture_url = $1 WHERE id = $2`, prof.PictureURL, sessionID)
			}
		}

		// Reset unread count for admin
		_, _ = pool.Exec(ctx, `UPDATE line_chat_sessions SET unread_admin_count = 0 WHERE id = $1`, sessionID)
		conv.UnreadAdminCount = 0

		// Query messages
		msgQuery := `
			SELECT 
				m.id,
				m.session_id,
				m.sender_type,
				u.name as admin_name,
				m.text,
				m.created_at
			FROM line_chat_messages m
			LEFT JOIN "user" u ON u.id = m.admin_user_id
			WHERE m.session_id = $1
			ORDER BY m.created_at ASC
			LIMIT 300
		`
		rows, err := pool.Query(ctx, msgQuery, sessionID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to query messages: " + err.Error())
		}
		defer rows.Close()

		messages := make([]LineChatMessageDTO, 0)
		for rows.Next() {
			var m LineChatMessageDTO
			if scanErr := rows.Scan(
				&m.ID,
				&m.SessionID,
				&m.SenderType,
				&m.AdminName,
				&m.Text,
				&m.CreatedAt,
			); scanErr != nil {
				return nil, huma.Error500InternalServerError("failed to scan message: " + scanErr.Error())
			}
			messages = append(messages, m)
		}

		out := &GetLineConversationOutput{}
		out.Body.Conversation = *conv
		out.Body.Messages = messages
		return out, nil
	})

	// 3. Switch reply mode (AI / MANUAL)
	huma.Register(api, huma.Operation{
		OperationID: "updateLineChatMode",
		Method:      http.MethodPatch,
		Path:        "/api/line-chat/conversations/{id}/mode",
		Summary:     "Switch reply mode between AI and MANUAL",
		Tags:        []string{"LINE Chat", "Admin"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *UpdateLineChatModeInput) (*UpdateLineChatModeOutput, error) {
		_, err := auth.RequireRoles(ctx, "admin", "central_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden("สิทธิ์การเข้าถึงไม่เพียงพอ")
		}

		if pool == nil {
			return nil, huma.Error500InternalServerError("ฐานข้อมูลไม่พร้อมใช้งาน")
		}

		sessionID := strings.TrimSpace(input.ID)
		targetMode := strings.ToUpper(strings.TrimSpace(input.Body.Mode))
		if targetMode != "AI" && targetMode != "MANUAL" {
			return nil, huma.Error400BadRequest("โหมดต้องเป็น 'AI' หรือ 'MANUAL' เท่านั้น")
		}

		updateQuery := `
			UPDATE line_chat_sessions
			SET reply_mode = $1, staff_active_at = NOW(), updated_at = NOW()
			WHERE id = $2
		`
		res, err := pool.Exec(ctx, updateQuery, targetMode, sessionID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update mode: " + err.Error())
		}
		if res.RowsAffected() == 0 {
			return nil, huma.Error404NotFound("ไม่พบบทสนทนาที่ต้องการ")
		}

		// Fetch updated session
		conv, err := fetchConversationByID(ctx, pool, sessionID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to query updated conversation: " + err.Error())
		}

		return &UpdateLineChatModeOutput{Body: *conv}, nil
	})

	// 4. Admin sends manual reply to user via LINE Push Message
	huma.Register(api, huma.Operation{
		OperationID: "sendLineAdminMessage",
		Method:      http.MethodPost,
		Path:        "/api/line-chat/conversations/{id}/messages",
		Summary:     "Send a manual reply from Admin to the user's LINE chat",
		Tags:        []string{"LINE Chat", "Admin"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *SendLineAdminMessageInput) (*SendLineAdminMessageOutput, error) {
		adminClaims, err := auth.RequireRoles(ctx, "admin", "central_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden("สิทธิ์การเข้าถึงไม่เพียงพอ")
		}

		if pool == nil {
			return nil, huma.Error500InternalServerError("ฐานข้อมูลไม่พร้อมใช้งาน")
		}

		text := strings.TrimSpace(input.Body.Text)
		if text == "" {
			return nil, huma.Error400BadRequest("กรุณาระบุข้อความที่ต้องการส่ง")
		}

		sessionID := strings.TrimSpace(input.ID)
		var lineUserID string
		err = pool.QueryRow(ctx, `SELECT line_user_id FROM line_chat_sessions WHERE id = $1`, sessionID).Scan(&lineUserID)
		if err != nil {
			return nil, huma.Error404NotFound("ไม่พบบทสนทนาที่ต้องการ")
		}

		// Push message to LINE
		if messenger != nil {
			pushCtx, pushCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer pushCancel()
			if pushErr := messenger.PushMessage(pushCtx, lineUserID, text); pushErr != nil {
				return nil, huma.Error500InternalServerError("ไม่สามารถส่งข้อความไปยัง LINE ได้: " + pushErr.Error())
			}
		}

		// Insert admin message into line_chat_messages
		msgID := generateLineID("line_msg")
		now := time.Now()
		insertMsgSQL := `
			INSERT INTO line_chat_messages (id, session_id, line_user_id, sender_type, admin_user_id, text, created_at)
			VALUES ($1, $2, $3, 'ADMIN', $4, $5, $6)
		`
		if _, insertErr := pool.Exec(ctx, insertMsgSQL, msgID, sessionID, lineUserID, adminClaims.UserID, text, now); insertErr != nil {
			return nil, huma.Error500InternalServerError("failed to save message: " + insertErr.Error())
		}

		// Update session last message, refresh staff_active_at, and mark read
		updateSessSQL := `
			UPDATE line_chat_sessions
			SET last_message_text = $1, last_message_at = $2, staff_active_at = $2, unread_admin_count = 0, updated_at = $2
			WHERE id = $3
		`
		_, _ = pool.Exec(ctx, updateSessSQL, text, now, sessionID)

		adminName := adminClaims.Name
		return &SendLineAdminMessageOutput{
			Body: LineChatMessageDTO{
				ID:         msgID,
				SessionID:  sessionID,
				SenderType: "ADMIN",
				AdminName:  &adminName,
				Text:       text,
				CreatedAt:  now,
			},
		}, nil
	})

	// 5. Extend staff active session timer (+10 minutes)
	huma.Register(api, huma.Operation{
		OperationID: "extendLineChatStaffSession",
		Method:      http.MethodPost,
		Path:        "/api/line-chat/conversations/{id}/extend",
		Summary:     "Extend staff active session timer (+10 minutes)",
		Tags:        []string{"LINE Chat", "Admin"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id" doc:"Session ID"`
	}) (*UpdateLineChatModeOutput, error) {
		_, err := auth.RequireRoles(ctx, "admin", "central_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden("สิทธิ์การเข้าถึงไม่เพียงพอ")
		}

		if pool == nil {
			return nil, huma.Error500InternalServerError("ฐานข้อมูลไม่พร้อมใช้งาน")
		}

		sessionID := strings.TrimSpace(input.ID)
		updateQuery := `
			UPDATE line_chat_sessions
			SET reply_mode = 'MANUAL', staff_active_at = NOW(), updated_at = NOW()
			WHERE id = $1
		`
		res, err := pool.Exec(ctx, updateQuery, sessionID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to extend staff session: " + err.Error())
		}
		if res.RowsAffected() == 0 {
			return nil, huma.Error404NotFound("ไม่พบบทสนทนาที่ต้องการ")
		}

		conv, err := fetchConversationByID(ctx, pool, sessionID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to query updated conversation: " + err.Error())
		}

		return &UpdateLineChatModeOutput{Body: *conv}, nil
	})

	// 6. Sync profile from LINE Messaging API
	huma.Register(api, huma.Operation{
		OperationID: "syncLineUserProfile",
		Method:      http.MethodPost,
		Path:        "/api/line-chat/conversations/{id}/sync-profile",
		Summary:     "Sync user display name and avatar from LINE Messaging API",
		Tags:        []string{"LINE Chat", "Admin"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id" doc:"Session ID"`
	}) (*UpdateLineChatModeOutput, error) {
		_, err := auth.RequireRoles(ctx, "admin", "central_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden("สิทธิ์การเข้าถึงไม่เพียงพอ")
		}

		if pool == nil {
			return nil, huma.Error500InternalServerError("ฐานข้อมูลไม่พร้อมใช้งาน")
		}

		sessionID := strings.TrimSpace(input.ID)
		var lineUserID string
		err = pool.QueryRow(ctx, `SELECT line_user_id FROM line_chat_sessions WHERE id = $1`, sessionID).Scan(&lineUserID)
		if err != nil {
			return nil, huma.Error404NotFound("ไม่พบบทสนทนาที่ต้องการ")
		}

		if messenger == nil {
			return nil, huma.Error500InternalServerError("ระบบเชื่อมต่อ LINE ไม่พร้อมใช้งาน")
		}

		prof, err := messenger.GetUserProfile(ctx, lineUserID)
		if err != nil {
			return nil, huma.Error502BadGateway("ไม่สามารถดึงข้อมูลโปรไฟล์จาก LINE ได้: " + err.Error())
		}

		if prof != nil {
			updateQuery := `
				UPDATE line_chat_sessions
				SET picture_url = CASE WHEN $1 <> '' THEN $1 ELSE picture_url END,
				    display_name = CASE WHEN user_id IS NULL AND $2 <> '' THEN $2 ELSE display_name END,
				    updated_at = NOW()
				WHERE id = $3
			`
			_, _ = pool.Exec(ctx, updateQuery, prof.PictureURL, prof.DisplayName, sessionID)
		}

		conv, err := fetchConversationByID(ctx, pool, sessionID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch updated conversation: " + err.Error())
		}
		return &UpdateLineChatModeOutput{Body: *conv}, nil
	})
}

