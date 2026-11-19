package ai

import (
	"context"
	"fmt"
	"strings"
	"time"
)

const maxToolLoopSteps = 5
const maxHistoryMessages = 12

// ChatAttachment represents an attached document or image (PDF, PNG, JPEG, WebP) in base64 format.
type ChatAttachment struct {
	Name        string `json:"name"`
	ContentType string `json:"contentType"`
	Data        string `json:"data"` // base64
}

// ChatMessage represents a single turn in the frontend/API chat history.
type ChatMessage struct {
	Role       string          `json:"role"` // "user" or "assistant"
	Content    string          `json:"content"`
	Attachment *ChatAttachment `json:"attachment,omitempty"`
}

// ChatResult is the structured answer returned to the HTTP handler.
type ChatResult struct {
	Reply     string   `json:"reply"`
	ToolsUsed []string `json:"toolsUsed"`
	Model     string   `json:"model"`
}

// ToolRunner abstracts tool execution for easy unit testing.
type ToolRunner interface {
	Declarations() []FunctionDeclaration
	Execute(ctx context.Context, scope UserScope, name string, args map[string]any) (map[string]any, error)
}

// ChatService orchestrates Gemini conversations and safe database tool calls.
type ChatService struct {
	client *Client
	tools  ToolRunner
	now    func() time.Time
}

func NewChatService(client *Client, tools ToolRunner) *ChatService {
	return &ChatService{
		client: client,
		tools:  tools,
		now:    time.Now,
	}
}

func (s *ChatService) IsConfigured() bool {
	return s != nil && s.client != nil && s.client.IsConfigured()
}

func (s *ChatService) Model() string {
	if s == nil || s.client == nil {
		return "gemini-3.5-flash-lite"
	}
	return s.client.Model()
}

// Chat executes a multi-turn Gemini conversation with automatic Safe Tool Calling.
func (s *ChatService) Chat(ctx context.Context, scope UserScope, history []ChatMessage) (*ChatResult, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ Backend (.env)")
	}
	if len(history) == 0 {
		return nil, fmt.Errorf("กรุณาระบุข้อความคำถาม")
	}

	// Finish cleanly before server WriteTimeout / Next.js proxyTimeout (90s)
	ctx, cancel := context.WithTimeout(ctx, 75*time.Second)
	defer cancel()

	// Keep the most recent turns to control token usage and latency,
	// while summarizing older turns so conversational context is not forgotten.
	var contextSummary string
	trimmed := history
	if len(trimmed) > maxHistoryMessages {
		older := trimmed[:len(trimmed)-maxHistoryMessages]
		trimmed = trimmed[len(trimmed)-maxHistoryMessages:]
		contextSummary = summarizeOlderTurns(older)
	}

	contents := make([]Content, 0, len(trimmed))
	for _, msg := range trimmed {
		text := strings.TrimSpace(msg.Content)
		hasAttachment := msg.Attachment != nil && strings.TrimSpace(msg.Attachment.Data) != ""
		if text == "" && !hasAttachment {
			continue
		}
		role := "user"
		if msg.Role == "assistant" || msg.Role == "model" {
			role = "model"
		}

		parts := make([]Part, 0, 2)
		if hasAttachment {
			mime := strings.TrimSpace(msg.Attachment.ContentType)
			b64Data := strings.TrimSpace(msg.Attachment.Data)
			if idx := strings.Index(b64Data, ";base64,"); idx != -1 {
				if mime == "" {
					mime = strings.TrimPrefix(b64Data[:idx], "data:")
				}
				b64Data = b64Data[idx+8:]
			}
			if mime == "" {
				mime = "application/pdf"
			}
			parts = append(parts, Part{
				InlineData: &Blob{
					MIMEType: mime,
					Data:     b64Data,
				},
			})
		}

		if text != "" {
			parts = append(parts, Part{Text: text})
		} else if len(parts) > 0 {
			parts = append(parts, Part{Text: "ช่วยตรวจสอบและอ่านข้อมูลจากไฟล์เอกสารหรือรูปภาพนี้ให้หน่อยค่ะ"})
		}

		contents = append(contents, Content{
			Role:  role,
			Parts: parts,
		})
	}
	if len(contents) == 0 {
		return nil, fmt.Errorf("กรุณาระบุข้อความคำถามหรือแนบไฟล์เอกสาร")
	}

	sysPrompt := BuildSystemPrompt(s.now(), scope, contextSummary)
	var tools []Tool
	if s.tools != nil {
		decls := s.tools.Declarations()
		if len(decls) > 0 {
			tools = []Tool{{FunctionDeclarations: decls}}
		}
	}

	temp := 0.2
	genCfg := &GenerationConfig{
		Temperature:     &temp,
		MaxOutputTokens: 2048,
	}

	var toolsUsed []string
	seenTools := map[string]bool{}

	for step := 0; step < maxToolLoopSteps; step++ {
		resp, err := s.client.GenerateContent(ctx, GenerateContentRequest{
			SystemInstruction: &Content{
				Parts: []Part{{Text: sysPrompt}},
			},
			Contents:         contents,
			Tools:            tools,
			GenerationConfig: genCfg,
		})
		if err != nil {
			return nil, err
		}
		if len(resp.Candidates) == 0 {
			return nil, fmt.Errorf("AI ไม่สามารถสร้างคำตอบได้ในขณะนี้")
		}

		candContent := resp.Candidates[0].Content
		if candContent.Role == "" {
			candContent.Role = "model"
		}

		var fnCalls []*FunctionCall
		var textParts []string
		for _, p := range candContent.Parts {
			if p.FunctionCall != nil {
				fnCalls = append(fnCalls, p.FunctionCall)
			} else if !p.Thought && strings.TrimSpace(p.Text) != "" {
				textParts = append(textParts, p.Text)
			}
		}

		if len(fnCalls) == 0 {
			reply := strings.TrimSpace(strings.Join(textParts, "\n"))
			if reply == "" {
				reply = "ขออภัย ระบบไม่สามารถประมวลผลคำตอบได้ กรุณาลองถามใหม่อีกครั้ง"
			}
			return &ChatResult{
				Reply:     reply,
				ToolsUsed: toolsUsed,
				Model:     s.client.Model(),
			}, nil
		}

		// Preserve model's functionCall turn (including any thoughtSignature)
		contents = append(contents, candContent)

		// Execute requested tools locally under strict UserScope
		var fnRespParts []Part
		for _, call := range fnCalls {
			if !seenTools[call.Name] {
				seenTools[call.Name] = true
				toolsUsed = append(toolsUsed, call.Name)
			}

			var out map[string]any
			if s.tools != nil {
				res, execErr := s.tools.Execute(ctx, scope, call.Name, call.Args)
				if execErr != nil {
					out = map[string]any{"error": execErr.Error()}
				} else {
					out = res
				}
			} else {
				out = map[string]any{"error": "tool executor unavailable"}
			}

			fnRespParts = append(fnRespParts, Part{
				FunctionResponse: &FunctionResponse{
					ID:       call.ID,
					Name:     call.Name,
					Response: out,
				},
			})
		}

		contents = append(contents, Content{
			Role:  "user",
			Parts: fnRespParts,
		})
	}

	// Final synthesis call without tools if maxToolLoopSteps was reached
	resp, err := s.client.GenerateContent(ctx, GenerateContentRequest{
		SystemInstruction: &Content{
			Parts: []Part{{Text: sysPrompt}},
		},
		Contents:         contents,
		GenerationConfig: genCfg,
	})
	if err != nil {
		return nil, err
	}

	var finalParts []string
	if len(resp.Candidates) > 0 {
		for _, p := range resp.Candidates[0].Content.Parts {
			if !p.Thought && strings.TrimSpace(p.Text) != "" {
				finalParts = append(finalParts, p.Text)
			}
		}
	}
	reply := strings.TrimSpace(strings.Join(finalParts, "\n"))
	if reply == "" {
		reply = "ขออภัย ข้อมูลที่ดึงมีหลายขั้นตอนเกินกำหนด กรุณาถามให้เจาะจงขึ้นเล็กน้อยค่ะ"
	}

	return &ChatResult{
		Reply:     reply,
		ToolsUsed: toolsUsed,
		Model:     s.client.Model(),
	}, nil
}

func summarizeOlderTurns(older []ChatMessage) string {
	if len(older) == 0 {
		return ""
	}
	var sb strings.Builder
	sb.WriteString("สาระสำคัญจากการสนทนาช่วงก่อนหน้า:\n")
	for i, m := range older {
		text := strings.TrimSpace(m.Content)
		if text == "" {
			continue
		}
		// Truncate overly long turns in summary
		runes := []rune(text)
		if len(runes) > 120 {
			text = string(runes[:120]) + "..."
		}
		roleLabel := "ผู้ใช้"
		if m.Role == "assistant" || m.Role == "model" {
			roleLabel = "น้องธาร่า"
		}
		sb.WriteString(fmt.Sprintf("- %s: %s\n", roleLabel, text))
		if i >= 8 {
			sb.WriteString("- ... (มีบทสนทนาก่อนหน้าเพิ่มเติม)\n")
			break
		}
	}
	return sb.String()
}

