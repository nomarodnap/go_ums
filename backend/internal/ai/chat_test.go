package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type stubToolRunner struct {
	executed []string
	lastArgs map[string]any
}

func (s *stubToolRunner) Declarations() []FunctionDeclaration {
	return []FunctionDeclaration{
		{
			Name:        "get_utility_summary",
			Description: "Get summary",
			Parameters: &SchemaObject{
				Type: "OBJECT",
				Properties: map[string]SchemaProperty{
					"month": {Type: "INTEGER"},
				},
			},
		},
	}
}

func (s *stubToolRunner) Execute(_ context.Context, scope UserScope, name string, args map[string]any) (map[string]any, error) {
	s.executed = append(s.executed, name)
	s.lastArgs = args
	return map[string]any{
		"scope":         scope.DepartmentName,
		"totalBills":    12,
		"paidAmount":    45230.50,
		"pendingAmount": 12000.00,
	}, nil
}

func TestYearAndUtilityNormalization(t *testing.T) {
	fixedNow := time.Date(2026, time.November, 11, 13, 0, 0, 0, time.UTC)

	if got := NormalizeBillingYearCE(2569, fixedNow); got != 2026 {
		t.Fatalf("expected 2569 BE -> 2026 CE, got %d", got)
	}
	if got := NormalizeBillingYearCE(2025, fixedNow); got != 2025 {
		t.Fatalf("expected 2025 CE -> 2025 CE, got %d", got)
	}
	if got := NormalizeBillingYearCE(0, fixedNow); got != 2026 {
		t.Fatalf("expected 0 -> 2026 CE, got %d", got)
	}

	// Nov 2026 falls in Thai fiscal year 2570
	if got := NormalizeFiscalYearBE(0, fixedNow); got != 2570 {
		t.Fatalf("expected Nov 2026 -> fiscal year 2570 BE, got %d", got)
	}
	if got := NormalizeFiscalYearBE(2026, fixedNow); got != 2569 {
		t.Fatalf("expected 2026 CE -> 2569 BE, got %d", got)
	}
	if got := NormalizeFiscalYearBE(2569, fixedNow); got != 2569 {
		t.Fatalf("expected 2569 BE -> 2569 BE, got %d", got)
	}

	if got := NormalizeUtilityType("ค่าไฟ"); got != "ค่าไฟฟ้า" {
		t.Fatalf("expected ค่าไฟฟ้า, got %s", got)
	}
	if got := NormalizeUtilityType("น้ำประปา"); got != "ค่าประปา&น้ำบาดาล" {
		t.Fatalf("expected ค่าประปา&น้ำบาดาล, got %s", got)
	}
}

func TestChatServiceToolLoopAndThoughtSignature(t *testing.T) {
	var callCount atomic.Int32
	var seenSecondRequest GenerateContentRequest

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") != "test-secret-key" {
			t.Fatalf("missing x-goog-api-key header")
		}

		var req GenerateContentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		n := callCount.Add(1)
		w.Header().Set("Content-Type", "application/json")

		if n == 1 {
			// Turn 1: model responds with thought part + functionCall carrying thoughtSignature
			resp := GenerateContentResponse{
				Candidates: []Candidate{
					{
						Content: Content{
							Role: "model",
							Parts: []Part{
								{
									Text:    "Thinking about calling summary tool...",
									Thought: true,
								},
								{
									ThoughtSignature: "sig-xyz-123",
									FunctionCall: &FunctionCall{
										ID:   "call-42",
										Name: "get_utility_summary",
										Args: map[string]any{"month": float64(11)},
									},
								},
							},
						},
					},
				},
			}
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		seenSecondRequest = req
		// Turn 2: model receives functionResponse and returns final Thai text (with a thought part to ignore)
		resp := GenerateContentResponse{
			Candidates: []Candidate{
				{
					Content: Content{
						Role: "model",
						Parts: []Part{
							{Text: "Internal reasoning...", Thought: true},
							{Text: "เดือนพฤศจิกายน 2569 เบิกจ่ายแล้ว 45,230.50 บาท จากทั้งหมด 12 รายการ"},
						},
					},
				},
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	client := NewClient("test-secret-key", "gemini-3.5-flash").WithBaseURL(srv.URL)
	runner := &stubToolRunner{}
	svc := NewChatService(client, runner)

	scope := UserScope{
		UserID:         "u-1",
		Role:           "user",
		IsAdmin:        false,
		DepartmentID:   "dept-1",
		DepartmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
	}

	res, err := svc.Chat(context.Background(), scope, []ChatMessage{
		{Role: "user", Content: "เดือนนี้ค่าไฟเท่าไหร่"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(runner.executed) != 1 || runner.executed[0] != "get_utility_summary" {
		t.Fatalf("expected get_utility_summary to execute once, got %v", runner.executed)
	}
	if len(res.ToolsUsed) != 1 || res.ToolsUsed[0] != "get_utility_summary" {
		t.Fatalf("expected toolsUsed=[get_utility_summary], got %v", res.ToolsUsed)
	}
	expectedReply := "เดือนพฤศจิกายน 2569 เบิกจ่ายแล้ว 45,230.50 บาท จากทั้งหมด 12 รายการ"
	if res.Reply != expectedReply {
		t.Fatalf("unexpected reply: %q", res.Reply)
	}

	// Verify thoughtSignature was echoed back on the model turn in turn 2
	if len(seenSecondRequest.Contents) != 3 {
		t.Fatalf("expected 3 content turns in second request, got %d", len(seenSecondRequest.Contents))
	}
	modelTurn := seenSecondRequest.Contents[1]
	if len(modelTurn.Parts) < 2 || modelTurn.Parts[1].ThoughtSignature != "sig-xyz-123" {
		t.Fatalf("expected thoughtSignature to be preserved in history, got %+v", modelTurn.Parts)
	}
	fnRespTurn := seenSecondRequest.Contents[2]
	if len(fnRespTurn.Parts) != 1 || fnRespTurn.Parts[0].FunctionResponse == nil {
		t.Fatalf("expected functionResponse in 3rd turn, got %+v", fnRespTurn.Parts)
	}
	if fnRespTurn.Parts[0].FunctionResponse.ID != "call-42" {
		t.Fatalf("expected functionResponse ID 'call-42', got %q", fnRespTurn.Parts[0].FunctionResponse.ID)
	}
}

func TestChatServiceRequiresAPIKey(t *testing.T) {
	client := NewClient("", "gemini-3.5-flash")
	svc := NewChatService(client, &stubToolRunner{})

	if svc.IsConfigured() {
		t.Fatalf("expected IsConfigured() to be false when API key is empty")
	}

	_, err := svc.Chat(context.Background(), UserScope{UserID: "u-1"}, []ChatMessage{
		{Role: "user", Content: "สวัสดี"},
	})
	if err == nil {
		t.Fatalf("expected error when GEMINI_API_KEY is missing")
	}
}

func TestSummarizeOlderTurns(t *testing.T) {
	if got := summarizeOlderTurns(nil); got != "" {
		t.Fatalf("expected empty summary for nil, got %q", got)
	}

	older := []ChatMessage{
		{Role: "user", Content: "ฉันอยากทราบค่าไฟของ ศพช.สงขลา"},
		{Role: "assistant", Content: "ค่าไฟเดือน ต.ค. 2569 ของ ศพช.สงขลา อยู่ที่ 45,230 บาทค่ะ"},
	}
	summary := summarizeOlderTurns(older)
	if !strings.Contains(summary, "ผู้ใช้: ฉันอยากทราบค่าไฟของ ศพช.สงขลา") {
		t.Errorf("expected summary to contain user turn, got %s", summary)
	}
	if !strings.Contains(summary, "น้องธาร่า: ค่าไฟเดือน ต.ค. 2569") {
		t.Errorf("expected summary to contain assistant turn with น้องธาร่า label, got %s", summary)
	}

	sysPrompt := BuildSystemPrompt(time.Now(), UserScope{IsAdmin: true}, summary)
	if !strings.Contains(sysPrompt, "Conversation Context Summary") {
		t.Errorf("expected prompt to contain Conversation Context Summary section")
	}
}

