package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AIStatusOutput struct {
	Body struct {
		Enabled        bool   `json:"enabled"`
		Provider       string `json:"provider"`
		Model          string `json:"model"`
		IsAdmin        bool   `json:"isAdmin"`
		DepartmentName string `json:"departmentName"`
	} `json:"body"`
}

type AIChatInput struct {
	Body struct {
		Messages     []ai.ChatMessage `json:"messages" minItems:"1" doc:"Conversation history ending with the latest user message"`
		Scope        string           `json:"scope,omitempty" doc:"Target scope: 'all' (whole department 292 departments) or 'department' (strictly department scope, like LINE OA)"`
		DepartmentID string           `json:"departmentId,omitempty" doc:"Specific department ID when in department scope"`
		SessionID    string           `json:"sessionId,omitempty" doc:"Optional session ID for persistent web chat history"`
	}
}

type AIChatOutput struct {
	Body struct {
		Reply     string   `json:"reply"`
		ToolsUsed []string `json:"toolsUsed"`
		Model     string   `json:"model"`
		SessionID string   `json:"sessionId,omitempty"`
	} `json:"body"`
}

type AIListSessionsInput struct {
	Scope string `query:"scope" doc:"Scope filter: 'all' or 'department'"`
	Limit int    `query:"limit" doc:"Max sessions to list (default 30)"`
}

type AIListSessionsOutput struct {
	Body struct {
		Sessions []ai.ChatSession `json:"sessions"`
	} `json:"body"`
}

type AIGetSessionInput struct {
	SessionID string `path:"sessionId" doc:"Chat session ID"`
}

type AIGetSessionOutput struct {
	Body struct {
		Session  ai.ChatSession          `json:"session"`
		Messages []ai.ChatSessionMessage `json:"messages"`
	} `json:"body"`
}

type AIDeleteSessionInput struct {
	SessionID string `path:"sessionId" doc:"Chat session ID"`
}

type AIDeleteSessionOutput struct {
	Body struct {
		Success bool `json:"success"`
	} `json:"body"`
}

type AISummaryResponseBody struct {
	Enabled bool `json:"enabled"`
	ai.MonthlySummary
}

type AISummaryOutput struct {
	Body AISummaryResponseBody `json:"body"`
}

type AIRefreshSummaryInput struct {
	Body struct {
		Scope        string `json:"scope,omitempty" doc:"Target scope: 'all' or 'department'"`
		DepartmentID string `json:"departmentId,omitempty" doc:"Target department ID when scope is 'department'"`
		Month        int    `json:"month,omitempty" doc:"Billing month (1-12)"`
		Year         int    `json:"year,omitempty" doc:"Billing year (BE or CE)"`
	}
}

type AIExplainBillInput struct {
	BillID string `path:"billId" doc:"Utility bill ID to explain"`
	Body   struct {
		Force bool `json:"force,omitempty" doc:"Bypass cache and regenerate explanation"`
	}
}

type AIExplainBillOutput struct {
	Body ai.AnomalyExplanation `json:"body"`
}

type AISearchInput struct {
	Body ai.SearchRequest `json:"body"`
}

type AISearchOutput struct {
	Body ai.SearchResponse `json:"body"`
}

type AISyncEmbeddingsInput struct {
	Body struct {
		Force bool `json:"force,omitempty" doc:"Re-generate embeddings even when content hash is unchanged"`
	}
}

type AISyncEmbeddingsOutput struct {
	Body ai.SyncEmbeddingsResult `json:"body"`
}

type AICategorizeBillInput struct {
	Body ai.CategorizeBillRequest `json:"body"`
}

type AICategorizeBillOutput struct {
	Body ai.CategorizeBillResult `json:"body"`
}

type AIExtractDocumentForm struct {
	File         huma.FormFile `form:"file" required:"true" doc:"Uploaded invoice PDF or image (PNG, JPEG, WebP, max 15MB)"`
	DepartmentID string        `form:"departmentId" doc:"Optional target department ID for matching services"`
}

type AIExtractDocumentInput struct {
	RawBody huma.MultipartFormFiles[AIExtractDocumentForm]
}

type AIExtractDocumentOutput struct {
	Body ai.ExtractDocumentResult `json:"body"`
}

type AIForecastInsightsInput struct {
	Body struct {
		Scope        string `json:"scope,omitempty" doc:"Target scope: 'all' or 'department'"`
		DepartmentID string `json:"departmentId,omitempty" doc:"Target department ID when scope is 'department'"`
		Horizon      int    `json:"horizon,omitempty" doc:"Forecast horizon in months (1-12, default 6)"`
		FiscalYear   int    `json:"fiscalYear,omitempty" doc:"Target fiscal year (BE or CE, 0 = auto)"`
		Force        bool   `json:"force,omitempty" doc:"Bypass cache and regenerate AI forecast advice"`
	}
}

type AIForecastOutput struct {
	Body ai.ForecastResponse `json:"body"`
}

type AIRouteDeps struct {
	Summary      *ai.SummaryService
	Search       *ai.SearchService
	Categorizer  *ai.CategorizerService
	Extractor    *ai.ExtractorService
	Forecast     *ai.ForecastService
	Chat         *ai.ChatService
	SessionStore *ai.SessionStore
}

func resolveAIUserScope(ctx context.Context, pool *pgxpool.Pool, user *auth.Claims) ai.UserScope {
	scope := ai.UserScope{
		UserID:       user.UserID,
		Role:         user.Role,
		DepartmentID: user.DepartmentID,
	}
	if user.Role == "admin" || user.Role == "auditor" || user.Role == "strategy_finance" || user.Role == "central_staff" {
		scope.IsAdmin = true
		scope.DepartmentName = "ภาพรวมทั้งกรมประมง (292 หน่วยงาน)"
		return scope
	}
	if pool != nil && user.DepartmentID != "" {
		var deptName string
		if err := pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", user.DepartmentID).Scan(&deptName); err == nil {
			scope.DepartmentName = deptName
		}
	}
	return scope
}

func applySummaryScope(ctx context.Context, pool *pgxpool.Pool, user *auth.Claims, reqScope, reqDeptID string) (ai.UserScope, error) {
	base := resolveAIUserScope(ctx, pool, user)
	normScope := strings.ToLower(strings.TrimSpace(reqScope))
	cleanDeptID := strings.TrimSpace(reqDeptID)

	if !base.IsAdmin {
		if normScope == "all" || (cleanDeptID != "" && cleanDeptID != user.DepartmentID) {
			return ai.UserScope{}, ai.ErrUnauthorizedScope
		}
		if base.DepartmentID == "" {
			return ai.UserScope{}, ai.ErrUnauthorizedScope
		}
		return base, nil
	}

	if normScope == "department" {
		targetID := cleanDeptID
		if targetID == "" {
			targetID = user.DepartmentID
		}
		out := ai.UserScope{
			UserID:       user.UserID,
			Role:         user.Role,
			IsAdmin:      true,
			DepartmentID: targetID,
		}
		if pool != nil && targetID != "" {
			var deptName string
			if err := pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", targetID).Scan(&deptName); err == nil {
				out.DepartmentName = deptName
			}
		}
		return out, nil
	}

	// Default admin/central scope: whole department group
	base.DepartmentID = ""
	return base, nil
}

func RegisterAIRoutes(api huma.API, pool *pgxpool.Pool, cfg *config.Config, summaryServices ...*ai.SummaryService) {
	var summaryService *ai.SummaryService
	if len(summaryServices) > 0 && summaryServices[0] != nil {
		summaryService = summaryServices[0]
	}
	RegisterAIRoutesWithServices(api, pool, cfg, AIRouteDeps{
		Summary: summaryService,
	})
}

func RegisterAIRoutesWithServices(api huma.API, pool *pgxpool.Pool, cfg *config.Config, deps AIRouteDeps) {
	var geminiAPIKey, geminiModel string
	if cfg != nil {
		geminiAPIKey = cfg.GeminiAPIKey
		geminiModel = cfg.GeminiModel
	}
	client := ai.NewClient(geminiAPIKey, geminiModel)
	tools := ai.NewToolExecutor(pool)
	chatService := deps.Chat
	if chatService == nil {
		chatService = ai.NewChatService(client, tools)
	}

	summaryService := deps.Summary
	if summaryService == nil {
		summaryService = ai.NewSummaryService(client, tools, pool, nil)
	}
	searchService := deps.Search
	if searchService == nil {
		searchService = ai.NewSearchService(client, pool)
	}
	categorizerService := deps.Categorizer
	if categorizerService == nil {
		categorizerService = ai.NewCategorizerService(client, pool)
	}
	extractorService := deps.Extractor
	if extractorService == nil {
		extractorService = ai.NewExtractorService(client, pool)
	}
	forecastService := deps.Forecast
	if forecastService == nil {
		forecastService = ai.NewForecastService(client, pool, nil)
	}

	sessionStore := deps.SessionStore
	if sessionStore == nil && pool != nil {
		sessionStore = ai.NewSessionStore(pool)
	}

	tools.SetForecastService(forecastService)
	tools.SetSearchService(searchService)

	// GET /api/ai/status
	huma.Register(api, huma.Operation{
		OperationID: "getAIStatus",
		Method:      http.MethodGet,
		Path:        "/api/ai/status",
		Summary:     "Check AI assistant configuration status and caller scope",
		Tags:        []string{"AI"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, _ *struct{}) (*AIStatusOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งาน AI ผู้ช่วย")
		}

		scope := resolveAIUserScope(ctx, pool, user)
		out := &AIStatusOutput{}
		out.Body.Enabled = chatService.IsConfigured()
		out.Body.Provider = "google-gemini"
		out.Body.Model = chatService.Model()
		out.Body.IsAdmin = scope.IsAdmin
		out.Body.DepartmentName = scope.DepartmentName
		return out, nil
	})

	// POST /api/ai/chat
	huma.Register(api, huma.Operation{
		OperationID: "postAIChat",
		Method:      http.MethodPost,
		Path:        "/api/ai/chat",
		Summary:     "Chat with the UMS Thai AI Assistant using Safe Tool Calling",
		Tags:        []string{"AI"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AIChatInput) (*AIChatOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งาน AI ผู้ช่วย")
		}
		if !chatService.IsConfigured() {
			return nil, huma.Error503ServiceUnavailable("ระบบ AI ยังไม่พร้อมใช้งาน เนื่องจากยังไม่ได้กำหนดค่า GEMINI_API_KEY ในไฟล์ .env ของ Backend")
		}

		baseScope := resolveAIUserScope(ctx, pool, user)
		reqScope := strings.ToLower(strings.TrimSpace(input.Body.Scope))

		scope := baseScope
		if reqScope == "all" {
			// Whole Department AI (292 departments)
			if !baseScope.IsAdmin {
				return nil, huma.Error403Forbidden("สิทธิ์การเข้าถึงไม่เพียงพอ: ผู้ช่วย AI ภาพรวมทั้งกรมอนุญาตเฉพาะผู้ดูแลระบบและเจ้าหน้าที่ส่วนกลาง")
			}
			scope.IsAdmin = true
			scope.Channel = "web_all"
			scope.DepartmentName = "ภาพรวมทั้งกรมประมง (292 หน่วยงาน)"
		} else {
			// Department-level AI (strictly scoped to a single department, identical to LINE OA)
			scope.IsAdmin = false
			scope.Channel = "web_department"

			// If admin/central explicitly requested a specific department
			if input.Body.DepartmentID != "" && baseScope.IsAdmin {
				scope.DepartmentID = strings.TrimSpace(input.Body.DepartmentID)
			} else {
				scope.DepartmentID = user.DepartmentID
			}

			if pool != nil && scope.DepartmentID != "" {
				var deptName string
				if err := pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", scope.DepartmentID).Scan(&deptName); err == nil && deptName != "" {
					scope.DepartmentName = deptName
				}
			}
			if scope.DepartmentName == "" {
				scope.DepartmentName = "หน่วยงานของคุณ"
			}
		}

		sessionID := strings.TrimSpace(input.Body.SessionID)
		var lastUserText string
		for i := len(input.Body.Messages) - 1; i >= 0; i-- {
			if input.Body.Messages[i].Role == "user" {
				lastUserText = strings.TrimSpace(input.Body.Messages[i].Content)
				break
			}
		}

		if sessionStore != nil && user != nil {
			if sessionID == "" && lastUserText != "" {
				title := "บทสนทนาใหม่"
				runes := []rune(lastUserText)
				if len(runes) > 40 {
					title = string(runes[:40]) + "..."
				} else {
					title = string(runes)
				}
				if created, err := sessionStore.CreateSession(ctx, user.UserID, reqScope, scope.DepartmentID, title); err == nil && created != nil {
					sessionID = created.ID
				}
			}
			if sessionID != "" && lastUserText != "" {
				_, _ = sessionStore.AppendMessage(ctx, sessionID, "user", lastUserText, "", nil)
			}
		}

		res, err := chatService.Chat(ctx, scope, input.Body.Messages)
		if err != nil {
			return nil, mapAIError("ไม่สามารถประมวลผลคำถามด้วย AI ได้", chatService.Model(), err)
		}

		out := &AIChatOutput{}
		out.Body.Reply = res.Reply
		out.Body.ToolsUsed = res.ToolsUsed
		if out.Body.ToolsUsed == nil {
			out.Body.ToolsUsed = []string{}
		}
		out.Body.Model = res.Model
		if sessionStore != nil && sessionID != "" {
			_, _ = sessionStore.AppendMessage(ctx, sessionID, "assistant", res.Reply, res.Model, res.ToolsUsed)
			out.Body.SessionID = sessionID
		}
		return out, nil
	})

	// GET /api/ai/sessions
	huma.Register(api, huma.Operation{
		OperationID: "listAIChatSessions",
		Method:      http.MethodGet,
		Path:        "/api/ai/sessions",
		Summary:     "List stored AI chat sessions for the current user",
		Tags:        []string{"AI", "Sessions"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AIListSessionsInput) (*AIListSessionsOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนดูประวัติการสนทนา")
		}
		if sessionStore == nil {
			out := &AIListSessionsOutput{}
			out.Body.Sessions = []ai.ChatSession{}
			return out, nil
		}

		sessions, err := sessionStore.ListSessions(ctx, user.UserID, input.Scope, input.Limit)
		if err != nil {
			return nil, huma.Error500InternalServerError("ไม่สามารถโหลดประวัติการสนทนาได้: " + err.Error())
		}
		out := &AIListSessionsOutput{}
		out.Body.Sessions = sessions
		if out.Body.Sessions == nil {
			out.Body.Sessions = []ai.ChatSession{}
		}
		return out, nil
	})

	// GET /api/ai/sessions/{sessionId}
	huma.Register(api, huma.Operation{
		OperationID: "getAIChatSession",
		Method:      http.MethodGet,
		Path:        "/api/ai/sessions/{sessionId}",
		Summary:     "Get a chat session and its full message history",
		Tags:        []string{"AI", "Sessions"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AIGetSessionInput) (*AIGetSessionOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนดูประวัติการสนทนา")
		}
		if sessionStore == nil {
			return nil, huma.Error503ServiceUnavailable("ฐานข้อมูลประวัติการสนทนายังไม่พร้อมใช้งาน")
		}

		sess, err := sessionStore.GetSession(ctx, input.SessionID, user.UserID)
		if err != nil {
			return nil, huma.Error404NotFound("ไม่พบบทสนทนานี้")
		}

		msgs, err := sessionStore.GetSessionMessages(ctx, input.SessionID, user.UserID)
		if err != nil {
			return nil, huma.Error500InternalServerError("ไม่สามารถโหลดข้อความในบทสนทนาได้: " + err.Error())
		}

		out := &AIGetSessionOutput{}
		out.Body.Session = *sess
		out.Body.Messages = msgs
		if out.Body.Messages == nil {
			out.Body.Messages = []ai.ChatSessionMessage{}
		}
		return out, nil
	})

	// DELETE /api/ai/sessions/{sessionId}
	huma.Register(api, huma.Operation{
		OperationID: "deleteAIChatSession",
		Method:      http.MethodDelete,
		Path:        "/api/ai/sessions/{sessionId}",
		Summary:     "Delete a chat session and its message history",
		Tags:        []string{"AI", "Sessions"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AIDeleteSessionInput) (*AIDeleteSessionOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนจัดการบทสนทนา")
		}
		if sessionStore == nil {
			return nil, huma.Error503ServiceUnavailable("ฐานข้อมูลประวัติการสนทนายังไม่พร้อมใช้งาน")
		}

		if err := sessionStore.DeleteSession(ctx, input.SessionID, user.UserID); err != nil {
			return nil, huma.Error404NotFound("ไม่พบบทสนทนานี้ หรือถูกลบไปแล้ว")
		}

		out := &AIDeleteSessionOutput{}
		out.Body.Success = true
		return out, nil
	})

	// GET /api/ai/summary
	huma.Register(api, huma.Operation{
		OperationID: "getAISummary",
		Method:      http.MethodGet,
		Path:        "/api/ai/summary",
		Summary:     "Get cached AI monthly summary and KPI insights for dashboard",
		Tags:        []string{"AI"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Scope        string `query:"scope" doc:"Scope: 'all' or 'department'"`
		DepartmentID string `query:"departmentId" doc:"Optional target department ID"`
		Month        int    `query:"month" doc:"Billing month (1-12)"`
		Year         int    `query:"year" doc:"Billing year (BE or CE)"`
	}) (*AISummaryOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งาน AI สรุปภาพรวม")
		}

		targetScope, err := applySummaryScope(ctx, pool, user, input.Scope, input.DepartmentID)
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		res, err := summaryService.GetMonthlySummary(ctx, targetScope, input.Month, input.Year, false, "cache")
		if err != nil {
			return nil, huma.Error500InternalServerError("ไม่สามารถโหลดข้อมูลสรุป AI ได้: " + err.Error())
		}

		out := &AISummaryOutput{}
		out.Body.Enabled = summaryService.IsConfigured()
		out.Body.MonthlySummary = *res
		return out, nil
	})

	// POST /api/ai/summary/refresh
	huma.Register(api, huma.Operation{
		OperationID: "refreshAISummary",
		Method:      http.MethodPost,
		Path:        "/api/ai/summary/refresh",
		Summary:     "Generate or regenerate AI monthly summary and insights",
		Tags:        []string{"AI"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AIRefreshSummaryInput) (*AISummaryOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งาน AI สรุปภาพรวม")
		}

		targetScope, err := applySummaryScope(ctx, pool, user, input.Body.Scope, input.Body.DepartmentID)
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		res, err := summaryService.GetMonthlySummary(ctx, targetScope, input.Body.Month, input.Body.Year, true, "live")
		if err != nil {
			return nil, mapAIError("ไม่สามารถสร้างสรุปด้วย AI ได้", summaryService.Model(), err)
		}

		out := &AISummaryOutput{}
		out.Body.Enabled = summaryService.IsConfigured()
		out.Body.MonthlySummary = *res
		return out, nil
	})

	// POST /api/ai/bills/{billId}/explain
	huma.Register(api, huma.Operation{
		OperationID: "explainBillAnomaly",
		Method:      http.MethodPost,
		Path:        "/api/ai/bills/{billId}/explain",
		Summary:     "Explain detected bill anomalies in plain Thai using statistical metrics and AI",
		Tags:        []string{"AI", "Audits"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AIExplainBillInput) (*AIExplainBillOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งานการวิเคราะห์บิลด้วย AI")
		}

		scope := resolveAIUserScope(ctx, pool, user)
		res, err := summaryService.ExplainAnomaly(ctx, scope, input.BillID, input.Body.Force)
		if err != nil {
			return nil, mapAIError("ไม่สามารถวิเคราะห์ความผิดปกติด้วย AI ได้", summaryService.Model(), err)
		}

		return &AIExplainBillOutput{Body: *res}, nil
	})

	// POST /api/ai/search
	huma.Register(api, huma.Operation{
		OperationID: "postAISearch",
		Method:      http.MethodPost,
		Path:        "/api/ai/search",
		Summary:     "Hybrid semantic and Thai natural-language search across bills and departments",
		Tags:        []string{"AI", "Search"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AISearchInput) (*AISearchOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งานการค้นหาด้วย AI")
		}

		scope := resolveAIUserScope(ctx, pool, user)
		res, err := searchService.Search(ctx, scope, input.Body)
		if err != nil {
			return nil, mapAIError("ไม่สามารถค้นหาข้อมูลด้วย AI ได้", ai.DefaultEmbeddingModel, err)
		}
		return &AISearchOutput{Body: *res}, nil
	})

	// POST /api/ai/embeddings/sync
	huma.Register(api, huma.Operation{
		OperationID: "syncAIEmbeddings",
		Method:      http.MethodPost,
		Path:        "/api/ai/embeddings/sync",
		Summary:     "Sync semantic embeddings for departments and utility bills (admin/central staff only)",
		Tags:        []string{"AI", "Search"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AISyncEmbeddingsInput) (*AISyncEmbeddingsOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งาน")
		}
		if _, err := auth.RequireRoles(ctx, "admin", "auditor", "strategy_finance", "central_staff"); err != nil {
			return nil, huma.Error403Forbidden("เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่ส่วนกลางเท่านั้นที่สามารถซิงก์ดัชนีค้นหา AI ได้")
		}

		res, err := searchService.SyncAll(ctx, input.Body.Force)
		if err != nil {
			return nil, mapAIError("ไม่สามารถซิงก์ดัชนีค้นหา AI ได้", ai.DefaultEmbeddingModel, err)
		}
		return &AISyncEmbeddingsOutput{Body: *res}, nil
	})

	// POST /api/ai/bills/categorize
	huma.Register(api, huma.Operation{
		OperationID: "categorizeBillWithAI",
		Method:      http.MethodPost,
		Path:        "/api/ai/bills/categorize",
		Summary:     "Recommend utility type, GL account code, and DB-grounded budget code for a bill",
		Tags:        []string{"AI", "Bills"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AICategorizeBillInput) (*AICategorizeBillOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งานการแนะนำหมวดหมู่ AI")
		}
		if _, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "user", "strategy_finance", "auditor"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		scope := resolveAIUserScope(ctx, pool, user)
		res, err := categorizerService.CategorizeBill(ctx, scope, input.Body)
		if err != nil {
			return nil, mapAIError("ไม่สามารถแนะนำหมวดหมู่บิลด้วย AI ได้", categorizerService.Model(), err)
		}
		return &AICategorizeBillOutput{Body: *res}, nil
	})

	// POST /api/ai/bills/extract-document
	huma.Register(api, huma.Operation{
		OperationID:     "extractBillDocumentWithAI",
		Method:          http.MethodPost,
		Path:            "/api/ai/bills/extract-document",
		Summary:         "Extract utility invoice fields using Gemini multimodal vision OCR",
		Tags:            []string{"AI", "Bills"},
		MaxBodyBytes:    16 << 20,
		BodyReadTimeout: 30 * time.Second,
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AIExtractDocumentInput) (*AIExtractDocumentOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งานการอ่านเอกสารด้วย AI")
		}
		if _, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "user", "strategy_finance", "auditor"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		formData := input.RawBody.Data()
		if formData == nil || !formData.File.IsSet || formData.File.File == nil {
			return nil, huma.Error400BadRequest("กรุณาแนบไฟล์ใบแจ้งหนี้ (PDF, PNG, JPEG หรือ WebP)")
		}
		defer func() { _ = formData.File.Close() }()

		fileBytes, err := io.ReadAll(io.LimitReader(formData.File.File, ai.MaxDocumentBytes+1))
		if err != nil {
			return nil, huma.Error400BadRequest("ไม่สามารถอ่านไฟล์ที่อัปโหลดได้")
		}
		if len(fileBytes) > ai.MaxDocumentBytes {
			return nil, huma.Error413RequestEntityTooLarge(ai.ErrDocumentTooLarge.Error())
		}

		scope := resolveAIUserScope(ctx, pool, user)
		res, err := extractorService.ExtractBillDocument(
			ctx,
			scope,
			formData.DepartmentID,
			formData.File.Filename,
			formData.File.ContentType,
			fileBytes,
		)
		if err != nil {
			return nil, mapAIError("ไม่สามารถอ่านข้อมูลเอกสารด้วย AI ได้", extractorService.Model(), err)
		}
		return &AIExtractDocumentOutput{Body: *res}, nil
	})

	// GET /api/ai/forecast
	huma.Register(api, huma.Operation{
		OperationID: "getAIForecast",
		Method:      http.MethodGet,
		Path:        "/api/ai/forecast",
		Summary:     "Get utility expense time-series forecast, fiscal-year budget plan, and early alert predictions",
		Tags:        []string{"AI", "Forecast"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Scope        string `query:"scope" doc:"Scope: 'all' or 'department'"`
		DepartmentID string `query:"departmentId" doc:"Optional target department ID"`
		Horizon      int    `query:"horizon" doc:"Forecast horizon in months (1-12, default 6)"`
		FiscalYear   int    `query:"fiscalYear" doc:"Optional target fiscal year (BE or CE, 0 = auto)"`
	}) (*AIForecastOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งานการพยากรณ์ค่าสาธารณูปโภค")
		}

		targetScope, err := applySummaryScope(ctx, pool, user, input.Scope, input.DepartmentID)
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		res, err := forecastService.GetForecast(ctx, targetScope, input.Horizon, input.FiscalYear)
		if err != nil {
			return nil, huma.Error500InternalServerError("ไม่สามารถคำนวณข้อมูลพยากรณ์ได้: " + err.Error())
		}
		return &AIForecastOutput{Body: *res}, nil
	})

	// POST /api/ai/forecast/insights
	huma.Register(api, huma.Operation{
		OperationID: "generateAIForecastInsights",
		Method:      http.MethodPost,
		Path:        "/api/ai/forecast/insights",
		Summary:     "Generate cached AI strategic budget planning and preventive alert recommendations",
		Tags:        []string{"AI", "Forecast"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *AIForecastInsightsInput) (*AIForecastOutput, error) {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			return nil, huma.Error401Unauthorized("กรุณาเข้าสู่ระบบก่อนใช้งานคำแนะนำวางแผนงบประมาณ AI")
		}

		targetScope, err := applySummaryScope(ctx, pool, user, input.Body.Scope, input.Body.DepartmentID)
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		res, err := forecastService.GenerateForecastInsights(ctx, targetScope, input.Body.Horizon, input.Body.FiscalYear, input.Body.Force)
		if err != nil {
			return nil, mapAIError("ไม่สามารถสร้างคำแนะนำพยากรณ์ด้วย AI ได้", forecastService.Model(), err)
		}
		return &AIForecastOutput{Body: *res}, nil
	})
}

func mapAIError(prefix, model string, err error) error {
	switch {
	case errors.Is(err, ai.ErrInvalidInput), errors.Is(err, ai.ErrInvalidDocument):
		return huma.Error400BadRequest(err.Error())
	case errors.Is(err, ai.ErrDocumentTooLarge):
		return huma.Error413RequestEntityTooLarge(err.Error())
	case errors.Is(err, ai.ErrAIConfigMissing):
		return huma.Error503ServiceUnavailable(err.Error())
	case errors.Is(err, ai.ErrUnauthorizedScope):
		return huma.Error403Forbidden(err.Error())
	case errors.Is(err, ai.ErrBillNotFound):
		return huma.Error404NotFound(err.Error())
	}

	log.Printf("[AI Handler] %s (model=%s): %v", prefix, model, err)

	var apiErr *ai.APIError
	if errors.As(err, &apiErr) {
		switch {
		case apiErr.Code == http.StatusTooManyRequests || apiErr.Status == "RESOURCE_EXHAUSTED":
			return huma.Error429TooManyRequests(
				fmt.Sprintf("โควตาการใช้งาน Gemini AI (%s) เต็มชั่วคราว กรุณารอสักครู่ หรือเปลี่ยน GEMINI_MODEL ใน backend/.env (เช่น gemini-3-flash-preview)", model),
			)
		case apiErr.Code == http.StatusServiceUnavailable || apiErr.Status == "UNAVAILABLE":
			return huma.Error503ServiceUnavailable(
				fmt.Sprintf("บริการ Gemini AI (%s) มีผู้ใช้งานหนาแน่นชั่วคราว กรุณาลองใหม่อีกครั้ง", model),
			)
		case apiErr.Code == http.StatusNotFound || apiErr.Status == "NOT_FOUND":
			return huma.Error503ServiceUnavailable(
				fmt.Sprintf("ไม่พบรุ่นโมเดล Gemini AI '%s' กรุณาตรวจสอบ GEMINI_MODEL ใน backend/.env", model),
			)
		}
	}

	if errors.Is(err, context.DeadlineExceeded) {
		return huma.Error504GatewayTimeout("การประมวลผล AI ใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง")
	}

	return huma.Error500InternalServerError(prefix + ": " + err.Error())
}

