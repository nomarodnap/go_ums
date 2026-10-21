package handlers_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
)

func TestHumaAPIHealth(t *testing.T) {
	_, api := humatest.New(t)

	huma.Register(api, huma.Operation{
		OperationID: "get-health-test",
		Method:      http.MethodGet,
		Path:        "/test-health",
		Summary:     "Test health check",
	}, func(ctx context.Context, input *struct{}) (*struct {
		Body struct {
			Status string `json:"status"`
		}
	}, error) {
		resp := &struct {
			Body struct {
				Status string `json:"status"`
			}
		}{}
		resp.Body.Status = "ok"
		return resp, nil
	})

	resp := api.Get("/test-health")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	if !strings.Contains(resp.Body.String(), `"status":"ok"`) {
		t.Errorf("expected status ok in body, got: %s", resp.Body.String())
	}
}
