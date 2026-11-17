package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type memoryCacheStore struct {
	data map[string][]byte
}

func newMemoryCacheStore() *memoryCacheStore {
	return &memoryCacheStore{data: map[string][]byte{}}
}

func (m *memoryCacheStore) Get(_ context.Context, key string) ([]byte, error) {
	v, ok := m.data[key]
	if !ok {
		return nil, fmt.Errorf("cache miss")
	}
	return v, nil
}

func (m *memoryCacheStore) Set(_ context.Context, key string, val []byte, _ time.Duration) error {
	m.data[key] = append([]byte(nil), val...)
	return nil
}

func TestBuildSummaryCacheKeyLengthLimit(t *testing.T) {
	cases := []struct {
		name string
		dept string
	}{
		{"all scope", ""},
		{"short dept id", "dept-01"},
		{"very long dept id", strings.Repeat("department-identifier-", 6)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key := BuildSummaryCacheKey(UserScope{IsAdmin: tc.dept == "", DepartmentID: tc.dept}, 11, 2026)
			if len(key) > 64 {
				t.Fatalf("cache key exceeds system_settings VARCHAR(64): len=%d (%s)", len(key), key)
			}
			if !strings.HasPrefix(key, "ai_sum:") {
				t.Fatalf("expected ai_sum prefix, got %s", key)
			}
		})
	}
}

func TestSummaryServiceCachingAndGeminiJSONSynthesis(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		var req GenerateContentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode gemini request: %v", err)
		}
		if req.GenerationConfig == nil || req.GenerationConfig.ResponseMIMEType != "application/json" {
			t.Fatalf("expected application/json responseMimeType, got %+v", req.GenerationConfig)
		}
		if req.GenerationConfig.MaxOutputTokens < 4096 {
			t.Fatalf("expected MaxOutputTokens >= 4096 for thinking headroom, got %d", req.GenerationConfig.MaxOutputTokens)
		}

		resp := GenerateContentResponse{
			Candidates: []Candidate{
				{
					FinishReason: "STOP",
					Content: Content{
						Role: "model",
						Parts: []Part{
							{Text: `{"internal":"reasoning"}`, Thought: true},
							{
								Text: "```json\n" + `{
									"headline": "เดือนพฤศจิกายน 2569 ภาพรวมปกติ",
									"keyPoints": ["ยอดเบิกจ่าย 120,000.00 บาท", "พบความคลาดเคลื่อน 2 รายการ"],
									"recommendations": ["เร่งตรวจสอบบิลค้างเกิน 2 เดือน"]
								}` + "\n```",
							},
						},
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-key", "gemini-3.5-flash").WithBaseURL(server.URL)
	store := newMemoryCacheStore()
	svc := NewSummaryService(client, nil, nil, store)
	fixedNow := time.Date(2026, 11, 11, 9, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return fixedNow }

	scope := UserScope{UserID: "u1", Role: "admin", IsAdmin: true}

	// 1. Cold read without force returns HasSummary: false without calling Gemini
	cold, err := svc.GetMonthlySummary(context.Background(), scope, 11, 2026, false, "cache")
	if err != nil {
		t.Fatalf("cold GetMonthlySummary failed: %v", err)
	}
	if cold.HasSummary {
		t.Fatalf("expected HasSummary=false on cold miss, got true")
	}
	if callCount != 0 {
		t.Fatalf("expected 0 Gemini calls on cold GET, got %d", callCount)
	}

	// 2. Refresh (force=true) invokes Gemini once and persists to cache
	fresh, err := svc.GetMonthlySummary(context.Background(), scope, 11, 2026, true, "live")
	if err != nil {
		t.Fatalf("force GetMonthlySummary failed: %v", err)
	}
	if !fresh.HasSummary || fresh.Cached || fresh.Source != "live" {
		t.Fatalf("unexpected fresh result: %+v", fresh)
	}
	if fresh.Headline != "เดือนพฤศจิกายน 2569 ภาพรวมปกติ" || len(fresh.KeyPoints) != 2 || len(fresh.Recommendations) != 1 {
		t.Fatalf("unexpected summary payload: %+v", fresh)
	}
	if callCount != 1 {
		t.Fatalf("expected 1 Gemini call, got %d", callCount)
	}
	if !svc.IsSummaryFresh(context.Background(), scope, 11, 2026) {
		t.Fatal("expected IsSummaryFresh to report true after generation")
	}

	// 3. Subsequent read without force hits cache (still 1 Gemini call total)
	cached, err := svc.GetMonthlySummary(context.Background(), scope, 11, 2026, false, "cache")
	if err != nil {
		t.Fatalf("cached GetMonthlySummary failed: %v", err)
	}
	if !cached.HasSummary || !cached.Cached {
		t.Fatalf("expected cached hit, got %+v", cached)
	}
	if callCount != 1 {
		t.Fatalf("expected Gemini not to be called on cache hit, got %d calls", callCount)
	}
}

func TestSummaryServiceMissingKeyError(t *testing.T) {
	svc := NewSummaryService(NewClient("", "gemini-3.5-flash"), nil, nil, newMemoryCacheStore())
	_, err := svc.GetMonthlySummary(context.Background(), UserScope{IsAdmin: true}, 11, 2026, true, "live")
	if !errors.Is(err, ErrAIConfigMissing) {
		t.Fatalf("expected ErrAIConfigMissing, got %v", err)
	}
}

func TestClientStructuredAPIErrorAndMaxTokensTruncation(t *testing.T) {
	t.Run("returns typed APIError on 429 quota exceeded", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":{"code":429,"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED"}}`))
		}))
		defer srv.Close()

		svc := NewSummaryService(NewClient("k", "gemini-3.5-flash").WithBaseURL(srv.URL), nil, nil, newMemoryCacheStore())
		_, err := svc.GetMonthlySummary(context.Background(), UserScope{IsAdmin: true}, 11, 2026, true, "live")
		var apiErr *APIError
		if !errors.As(err, &apiErr) {
			t.Fatalf("expected *APIError via errors.As, got %T: %v", err, err)
		}
		if apiErr.Code != 429 || apiErr.Status != "RESOURCE_EXHAUSTED" {
			t.Fatalf("unexpected APIError fields: %+v", apiErr)
		}
	})

	t.Run("reports MAX_TOKENS truncation clearly", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			resp := GenerateContentResponse{
				Candidates: []Candidate{{
					FinishReason: "MAX_TOKENS",
					Content: Content{
						Role:  "model",
						Parts: []Part{{Text: `{"headline":"truncated`}},
					},
				}},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
		}))
		defer srv.Close()

		svc := NewSummaryService(NewClient("k", "gemini-3.5-flash").WithBaseURL(srv.URL), nil, nil, newMemoryCacheStore())
		_, err := svc.GetMonthlySummary(context.Background(), UserScope{IsAdmin: true}, 11, 2026, true, "live")
		if err == nil || !strings.Contains(err.Error(), "truncated") {
			t.Fatalf("expected truncated error diagnostics, got %v", err)
		}
	})
}

