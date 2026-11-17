package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	defaultGeminiBaseURL  = "https://generativelanguage.googleapis.com/v1beta"
	DefaultEmbeddingModel = "gemini-embedding-001"
	DefaultEmbeddingDim   = 768
)

// Client calls the Google Gemini REST API using standard net/http without external SDK dependencies.
type Client struct {
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new Gemini REST API client.
func NewClient(apiKey, model string) *Client {
	if model == "" {
		model = "gemini-3.5-flash"
	}
	return &Client{
		apiKey:  strings.TrimSpace(apiKey),
		model:   strings.TrimSpace(model),
		baseURL: defaultGeminiBaseURL,
		httpClient: &http.Client{
			Timeout: 80 * time.Second,
		},
	}
}

// WithBaseURL overrides the Gemini API base URL (useful for testing).
func (c *Client) WithBaseURL(baseURL string) *Client {
	c.baseURL = strings.TrimRight(baseURL, "/")
	return c
}

// IsConfigured reports whether an API key has been provided.
func (c *Client) IsConfigured() bool {
	return c != nil && c.apiKey != ""
}

// Model returns the configured Gemini model name.
func (c *Client) Model() string {
	if c == nil || c.model == "" {
		return "gemini-3.5-flash"
	}
	return c.model
}

type Content struct {
	Role  string `json:"role,omitempty"`
	Parts []Part `json:"parts"`
}

type Blob struct {
	MIMEType string `json:"mimeType"`
	Data     string `json:"data"`
}

type Part struct {
	Text             string            `json:"text,omitempty"`
	InlineData       *Blob             `json:"inlineData,omitempty"`
	Thought          bool              `json:"thought,omitempty"`
	ThoughtSignature string            `json:"thoughtSignature,omitempty"`
	FunctionCall     *FunctionCall     `json:"functionCall,omitempty"`
	FunctionResponse *FunctionResponse `json:"functionResponse,omitempty"`
}

type FunctionCall struct {
	ID   string         `json:"id,omitempty"`
	Name string         `json:"name"`
	Args map[string]any `json:"args,omitempty"`
}

type FunctionResponse struct {
	ID       string         `json:"id,omitempty"`
	Name     string         `json:"name"`
	Response map[string]any `json:"response"`
}

type Tool struct {
	FunctionDeclarations []FunctionDeclaration `json:"functionDeclarations"`
}

type FunctionDeclaration struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  *SchemaObject  `json:"parameters,omitempty"`
}

type SchemaObject struct {
	Type        string                   `json:"type"`
	Description string                   `json:"description,omitempty"`
	Properties  map[string]SchemaProperty `json:"properties,omitempty"`
	Required    []string                 `json:"required,omitempty"`
}

type SchemaProperty struct {
	Type        string   `json:"type"`
	Description string   `json:"description,omitempty"`
	Enum        []string `json:"enum,omitempty"`
}

type GenerationConfig struct {
	Temperature      *float64 `json:"temperature,omitempty"`
	MaxOutputTokens  int      `json:"maxOutputTokens,omitempty"`
	ResponseMIMEType string   `json:"responseMimeType,omitempty"`
}

type GenerateContentRequest struct {
	SystemInstruction *Content          `json:"systemInstruction,omitempty"`
	Contents          []Content         `json:"contents"`
	Tools             []Tool            `json:"tools,omitempty"`
	GenerationConfig  *GenerationConfig `json:"generationConfig,omitempty"`
}

type GenerateContentResponse struct {
	Candidates []Candidate `json:"candidates"`
	Error      *APIError   `json:"error,omitempty"`
}

type Candidate struct {
	Content      Content `json:"content"`
	FinishReason string  `json:"finishReason"`
}

type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Status  string `json:"status"`
}

func (e *APIError) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("gemini api error (%d %s): %s", e.Code, e.Status, e.Message)
}

// GenerateContent sends a generateContent request to the configured Gemini model.
func (c *Client) GenerateContent(ctx context.Context, req GenerateContentRequest) (*GenerateContentResponse, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("GEMINI_API_KEY is not configured")
	}

	payload, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal gemini request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/models/%s:generateContent", c.baseURL, c.model)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create gemini request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call gemini api: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read gemini response: %w", err)
	}

	var parsed GenerateContentResponse
	if jsonErr := json.Unmarshal(body, &parsed); jsonErr != nil {
		if resp.StatusCode >= 400 {
			return nil, &APIError{
				Code:    resp.StatusCode,
				Status:  http.StatusText(resp.StatusCode),
				Message: strings.TrimSpace(string(body)),
			}
		}
		return nil, fmt.Errorf("decode gemini response: %w", jsonErr)
	}

	if parsed.Error != nil {
		if parsed.Error.Code == 0 {
			parsed.Error.Code = resp.StatusCode
		}
		return nil, parsed.Error
	}
	if resp.StatusCode >= 400 {
		return nil, &APIError{
			Code:    resp.StatusCode,
			Status:  http.StatusText(resp.StatusCode),
			Message: strings.TrimSpace(string(body)),
		}
	}

	return &parsed, nil
}

type EmbedContentRequest struct {
	Model                string  `json:"model,omitempty"`
	Content              Content `json:"content"`
	TaskType             string  `json:"taskType,omitempty"`
	OutputDimensionality int     `json:"outputDimensionality,omitempty"`
}

type ContentEmbedding struct {
	Values []float64 `json:"values"`
}

type EmbedContentResponse struct {
	Embedding *ContentEmbedding `json:"embedding,omitempty"`
	Error     *APIError         `json:"error,omitempty"`
}

// EmbedContent requests a 768-dimensional semantic embedding vector from Gemini.
func (c *Client) EmbedContent(ctx context.Context, text string, taskType string) ([]float64, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("GEMINI_API_KEY is not configured")
	}
	cleaned := strings.TrimSpace(text)
	if cleaned == "" {
		return nil, fmt.Errorf("embedding text is empty")
	}

	reqPayload := EmbedContentRequest{
		Model:                "models/" + DefaultEmbeddingModel,
		Content:              Content{Parts: []Part{{Text: cleaned}}},
		TaskType:             taskType,
		OutputDimensionality: DefaultEmbeddingDim,
	}

	payload, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, fmt.Errorf("marshal embedding request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/models/%s:embedContent", c.baseURL, DefaultEmbeddingModel)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create embedding request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call gemini embedding api: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read gemini embedding response: %w", err)
	}

	var parsed EmbedContentResponse
	if jsonErr := json.Unmarshal(body, &parsed); jsonErr != nil {
		if resp.StatusCode >= 400 {
			return nil, &APIError{
				Code:    resp.StatusCode,
				Status:  http.StatusText(resp.StatusCode),
				Message: strings.TrimSpace(string(body)),
			}
		}
		return nil, fmt.Errorf("decode gemini embedding response: %w", jsonErr)
	}

	if parsed.Error != nil {
		if parsed.Error.Code == 0 {
			parsed.Error.Code = resp.StatusCode
		}
		return nil, parsed.Error
	}
	if resp.StatusCode >= 400 {
		return nil, &APIError{
			Code:    resp.StatusCode,
			Status:  http.StatusText(resp.StatusCode),
			Message: strings.TrimSpace(string(body)),
		}
	}
	if parsed.Embedding == nil || len(parsed.Embedding.Values) == 0 {
		return nil, fmt.Errorf("gemini embedding response contained empty values")
	}

	return parsed.Embedding.Values, nil
}

