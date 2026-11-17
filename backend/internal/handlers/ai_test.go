package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/handlers"
)

func TestAIRoutesRegistrationAndAuth(t *testing.T) {
	_, api := humatest.New(t)
	cfg := &config.Config{
		GeminiAPIKey: "test-key",
		GeminiModel:  "gemini-3.5-flash",
	}
	handlers.RegisterAIRoutes(api, nil, cfg)

	// Unauthenticated request must hit the registered route and return 401 (never 404)
	unauthResp := api.Get("/api/ai/status")
	if unauthResp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated /api/ai/status, got %d (%s)", unauthResp.Code, unauthResp.Body.String())
	}

	// Authenticated admin request returns configured status
	ctx := context.WithValue(context.Background(), auth.UserContextKey, &auth.Claims{
		UserID: "u-admin",
		Role:   "admin",
	})
	authResp := api.GetCtx(ctx, "/api/ai/status")
	if authResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for authenticated /api/ai/status, got %d (%s)", authResp.Code, authResp.Body.String())
	}

	var body struct {
		Enabled bool   `json:"enabled"`
		Model   string `json:"model"`
		IsAdmin bool   `json:"isAdmin"`
	}
	if err := json.Unmarshal(authResp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.Enabled || body.Model != "gemini-3.5-flash" || !body.IsAdmin {
		t.Fatalf("unexpected /api/ai/status payload: %+v", body)
	}

	// Phase 2 summary endpoint enforces auth and RBAC
	if unauthSum := api.Get("/api/ai/summary"); unauthSum.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated /api/ai/summary, got %d", unauthSum.Code)
	}

	deptCtx := context.WithValue(context.Background(), auth.UserContextKey, &auth.Claims{
		UserID:       "u-dept",
		Role:         "user",
		DepartmentID: "dept-101",
	})
	// Non-admin asking for "all" or another department is rejected with 403
	if forbidden := api.GetCtx(deptCtx, "/api/ai/summary?scope=all"); forbidden.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when non-admin requests scope=all, got %d (%s)", forbidden.Code, forbidden.Body.String())
	}
	if forbiddenOther := api.GetCtx(deptCtx, "/api/ai/summary?scope=department&departmentId=dept-999"); forbiddenOther.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when non-admin requests another department, got %d", forbiddenOther.Code)
	}
	// Valid department request succeeds with HasSummary=false (non-blocking)
	deptSummary := api.GetCtx(deptCtx, "/api/ai/summary?scope=department&departmentId=dept-101")
	if deptSummary.Code != http.StatusOK {
		t.Fatalf("expected 200 for own department /api/ai/summary, got %d (%s)", deptSummary.Code, deptSummary.Body.String())
	}

	// Refresh without API key returns 503
	_, noKeyAPI := humatest.New(t)
	handlers.RegisterAIRoutes(noKeyAPI, nil, &config.Config{})
	noKeyRefresh := noKeyAPI.PostCtx(ctx, "/api/ai/summary/refresh", map[string]any{"scope": "all"})
	if noKeyRefresh.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for /api/ai/summary/refresh without key, got %d (%s)", noKeyRefresh.Code, noKeyRefresh.Body.String())
	}

	// Unauthenticated explain returns 401; authenticated without pool returns 404
	if unauthExplain := api.Post("/api/ai/bills/bill-1/explain", map[string]any{}); unauthExplain.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated explain, got %d", unauthExplain.Code)
	}
	missingExplain := api.PostCtx(ctx, "/api/ai/bills/bill-1/explain", map[string]any{})
	if missingExplain.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when pool nil/bill missing, got %d (%s)", missingExplain.Code, missingExplain.Body.String())
	}
}

func TestAIRefreshSummaryUpstreamErrorMapping(t *testing.T) {
	adminCtx := context.WithValue(context.Background(), auth.UserContextKey, &auth.Claims{
		UserID: "u-admin",
		Role:   "admin",
	})

	cases := []struct {
		name           string
		upstreamStatus int
		upstreamBody   string
		wantHTTP       int
		wantSubstring  string
	}{
		{
			name:           "429 RESOURCE_EXHAUSTED maps to 429 Thai message",
			upstreamStatus: http.StatusTooManyRequests,
			upstreamBody:   `{"error":{"code":429,"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED"}}`,
			wantHTTP:       http.StatusTooManyRequests,
			wantSubstring:  "โควตาการใช้งาน Gemini AI",
		},
		{
			name:           "503 UNAVAILABLE maps to 503 Thai message",
			upstreamStatus: http.StatusServiceUnavailable,
			upstreamBody:   `{"error":{"code":503,"message":"High demand","status":"UNAVAILABLE"}}`,
			wantHTTP:       http.StatusServiceUnavailable,
			wantSubstring:  "มีผู้ใช้งานหนาแน่นชั่วคราว",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.upstreamStatus)
				_, _ = w.Write([]byte(tc.upstreamBody))
			}))
			defer srv.Close()

			_, api := humatest.New(t)
			client := ai.NewClient("test-key", "gemini-3.5-flash").WithBaseURL(srv.URL)
			summarySvc := ai.NewSummaryService(client, nil, nil, nil)
			handlers.RegisterAIRoutes(api, nil, &config.Config{
				GeminiAPIKey: "test-key",
				GeminiModel:  "gemini-3.5-flash",
			}, summarySvc)

			resp := api.PostCtx(adminCtx, "/api/ai/summary/refresh", map[string]any{"scope": "all"})
			if resp.Code != tc.wantHTTP {
				t.Fatalf("expected HTTP %d, got %d (%s)", tc.wantHTTP, resp.Code, resp.Body.String())
			}
			if !strings.Contains(resp.Body.String(), tc.wantSubstring) {
				t.Fatalf("expected response detail to contain %q, got %s", tc.wantSubstring, resp.Body.String())
			}
		})
	}
}

func TestPhase3AIRoutesSearchCategorizeAndExtractMultipart(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ai.GenerateContentResponse{
			Candidates: []ai.Candidate{{
				FinishReason: "STOP",
				Content: ai.Content{
					Role: "model",
					Parts: []ai.Part{{
						Text: `{
							"utilityType": "ค่าประปา&น้ำบาดาล",
							"provider": "กปภ.",
							"serviceNumber": "W-9988",
							"invoiceNumber": "INV-W-01",
							"invoiceDate": "20/10/2569",
							"billingMonth": 10,
							"billingYear": 2569,
							"usageAmount": 45,
							"invoiceAmount": 650.50,
							"budgetCode": "BG-1",
							"confidence": 0.91,
							"reasoning": "ผู้ให้บริการ กปภ. เป็นค่าน้ำประปา"
						}`,
					}},
				},
			}},
		})
	}))
	defer srv.Close()

	_, api := humatest.New(t)
	client := ai.NewClient("test-key", "gemini-3-flash-preview").WithBaseURL(srv.URL)
	handlers.RegisterAIRoutesWithServices(api, nil, &config.Config{
		GeminiAPIKey: "test-key",
		GeminiModel:  "gemini-3-flash-preview",
	}, handlers.AIRouteDeps{
		Categorizer: ai.NewCategorizerService(client, nil),
		Extractor:   ai.NewExtractorService(client, nil),
	})

	deptCtx := context.WithValue(context.Background(), auth.UserContextKey, &auth.Claims{
		UserID: "u-dept", Role: "user", DepartmentID: "dept-1",
	})
	adminCtx := context.WithValue(context.Background(), auth.UserContextKey, &auth.Claims{
		UserID: "u-admin", Role: "admin",
	})

	// 1. Search RBAC & validation
	if r := api.Post("/api/ai/search", map[string]any{"query": "ค่าไฟ"}); r.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated search, got %d", r.Code)
	}
	if r := api.PostCtx(deptCtx, "/api/ai/search", map[string]any{"query": "   "}); r.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty search query, got %d (%s)", r.Code, r.Body.String())
	}
	if r := api.PostCtx(deptCtx, "/api/ai/search", map[string]any{"query": "บิลค่าไฟภาคใต้"}); r.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid search, got %d (%s)", r.Code, r.Body.String())
	}

	// 2. Embeddings Sync RBAC (user gets 403)
	if r := api.PostCtx(deptCtx, "/api/ai/embeddings/sync", map[string]any{}); r.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when non-admin calls sync, got %d", r.Code)
	}

	// 3. Auto-Categorize RBAC & output
	if r := api.PostCtx(deptCtx, "/api/ai/bills/categorize", map[string]any{"departmentId": "dept-other", "provider": "กปภ."}); r.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for cross-dept categorize, got %d", r.Code)
	}
	catResp := api.PostCtx(deptCtx, "/api/ai/bills/categorize", map[string]any{"departmentId": "dept-1", "provider": "กปภ."})
	if catResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for categorize, got %d (%s)", catResp.Code, catResp.Body.String())
	}
	if !strings.Contains(catResp.Body.String(), `"accountCode":"5104020103"`) {
		t.Fatalf("expected deterministic GL code 5104020103, got %s", catResp.Body.String())
	}

	// 4. Multipart OCR Document Extract (400 for bad mime, 200 for valid PNG)
	makeMultipart := func(filename string, content []byte) (*bytes.Buffer, string) {
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		_ = w.WriteField("departmentId", "dept-1")
		fw, _ := w.CreateFormFile("file", filename)
		_, _ = fw.Write(content)
		_ = w.Close()
		return &buf, w.FormDataContentType()
	}

	badBuf, badCT := makeMultipart("notes.txt", []byte("not an invoice"))
	badReq, _ := http.NewRequestWithContext(adminCtx, http.MethodPost, "/api/ai/bills/extract-document", badBuf)
	badReq.Header.Set("Content-Type", badCT)
	badRec := httptest.NewRecorder()
	api.Adapter().ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for disallowed .txt upload, got %d (%s)", badRec.Code, badRec.Body.String())
	}

	pngMagic := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0}
	okBuf, okCT := makeMultipart("water-bill.png", pngMagic)
	okReq, _ := http.NewRequestWithContext(deptCtx, http.MethodPost, "/api/ai/bills/extract-document", okBuf)
	okReq.Header.Set("Content-Type", okCT)
	okRec := httptest.NewRecorder()
	api.Adapter().ServeHTTP(okRec, okReq)
	if okRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid PNG OCR upload, got %d (%s)", okRec.Code, okRec.Body.String())
	}
	if !strings.Contains(okRec.Body.String(), `"invoiceDate":"2026-10-20"`) || !strings.Contains(okRec.Body.String(), `"billingMonthStr":"2026-10"`) {
		t.Fatalf("expected normalized BE->CE fields in response, got %s", okRec.Body.String())
	}
}

func TestPhase4ForecastRoutesAndRBAC(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ai.GenerateContentResponse{
			Candidates: []ai.Candidate{{
				FinishReason: "STOP",
				Content: ai.Content{
					Role: "model",
					Parts: []ai.Part{{
						Text: `{
							"executiveSummary": "แนวโน้มเดือนหน้าทรงตัว",
							"budgetRecommendations": ["สำรองงบไฟฟ้า 5%"],
							"preventiveActions": ["ตรวจมิเตอร์ก่อนวันที่ 25"]
						}`,
					}},
				},
			}},
		})
	}))
	defer srv.Close()

	_, api := humatest.New(t)
	client := ai.NewClient("test-key", "gemini-3-flash-preview").WithBaseURL(srv.URL)
	handlers.RegisterAIRoutesWithServices(api, nil, &config.Config{
		GeminiAPIKey: "test-key",
		GeminiModel:  "gemini-3-flash-preview",
	}, handlers.AIRouteDeps{
		Forecast: ai.NewForecastService(client, nil, nil),
	})

	// Unauthenticated must be 401
	if r := api.Get("/api/ai/forecast"); r.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated /api/ai/forecast, got %d", r.Code)
	}
	if r := api.Post("/api/ai/forecast/insights", map[string]any{}); r.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated /api/ai/forecast/insights, got %d", r.Code)
	}

	deptCtx := context.WithValue(context.Background(), auth.UserContextKey, &auth.Claims{
		UserID: "u-dept", Role: "user", DepartmentID: "dept-101",
	})
	adminCtx := context.WithValue(context.Background(), auth.UserContextKey, &auth.Claims{
		UserID: "u-admin", Role: "admin",
	})

	// Cross-department / all scope denied for non-admin
	if r := api.GetCtx(deptCtx, "/api/ai/forecast?scope=all"); r.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when non-admin requests scope=all forecast, got %d", r.Code)
	}
	if r := api.GetCtx(deptCtx, "/api/ai/forecast?scope=department&departmentId=dept-999"); r.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for cross-dept forecast, got %d", r.Code)
	}
	if r := api.PostCtx(deptCtx, "/api/ai/forecast/insights", map[string]any{"scope": "all"}); r.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin scope=all forecast insights, got %d", r.Code)
	}

	// Own department succeeds with 200 and non-null slices
	ownResp := api.GetCtx(deptCtx, "/api/ai/forecast?scope=department&departmentId=dept-101&horizon=6")
	if ownResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for own department forecast, got %d (%s)", ownResp.Code, ownResp.Body.String())
	}
	if !strings.Contains(ownResp.Body.String(), `"scope":"department"`) || !strings.Contains(ownResp.Body.String(), `"alertPredictions":[]`) {
		t.Fatalf("expected department scope & initialized slices, got %s", ownResp.Body.String())
	}

	// Admin generating AI insights returns populated insights
	insResp := api.PostCtx(adminCtx, "/api/ai/forecast/insights", map[string]any{"scope": "all", "horizon": 6})
	if insResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin forecast insights, got %d (%s)", insResp.Code, insResp.Body.String())
	}
	if !strings.Contains(insResp.Body.String(), `"hasInsights":true`) || !strings.Contains(insResp.Body.String(), "สำรองงบไฟฟ้า") {
		t.Fatalf("expected generated insights payload, got %s", insResp.Body.String())
	}

	// Missing Gemini key returns 503 for insights generation
	_, noKeyAPI := humatest.New(t)
	handlers.RegisterAIRoutes(noKeyAPI, nil, &config.Config{})
	if r := noKeyAPI.PostCtx(adminCtx, "/api/ai/forecast/insights", map[string]any{"scope": "all"}); r.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when Gemini key missing for insights, got %d (%s)", r.Code, r.Body.String())
	}
}


