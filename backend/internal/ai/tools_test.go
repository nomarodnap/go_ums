package ai

import (
	"context"
	"testing"
)

func TestToolDeclarations(t *testing.T) {
	executor := NewToolExecutor(nil)
	decls := executor.Declarations()

	expectedTools := map[string]bool{
		"get_utility_summary":          false,
		"get_pending_bills":            false,
		"get_anomalies":                false,
		"get_monthly_trend":            false,
		"get_unrecorded_services":      false,
		"get_budget_overview":          false,
		"get_utility_forecast":         false,
		"search_bills_and_departments": false,
	}

	if len(decls) != len(expectedTools) {
		t.Fatalf("expected %d tool declarations, got %d", len(expectedTools), len(decls))
	}

	for _, decl := range decls {
		if _, exists := expectedTools[decl.Name]; !exists {
			t.Errorf("unexpected tool declared: %s", decl.Name)
		}
		expectedTools[decl.Name] = true

		if decl.Description == "" {
			t.Errorf("tool %s missing description", decl.Name)
		}
		if decl.Parameters == nil {
			t.Errorf("tool %s missing parameters schema", decl.Name)
		}
	}

	for name, found := range expectedTools {
		if !found {
			t.Errorf("tool %s was not found in declarations", name)
		}
	}
}

func TestToolExecutorNilPool(t *testing.T) {
	executor := NewToolExecutor(nil)
	scope := UserScope{
		UserID:  "test-user",
		IsAdmin: true,
	}

	res, err := executor.Execute(context.Background(), scope, "get_utility_forecast", map[string]any{
		"months_ahead": 3,
	})
	if err != nil {
		t.Fatalf("expected nil error when pool is nil, got: %v", err)
	}
	if errMsg, ok := res["error"].(string); !ok || errMsg == "" {
		t.Fatalf("expected error message in result, got: %v", res)
	}
}

func TestToolExecutorUnknownTool(t *testing.T) {
	executor := NewToolExecutor(nil)
	scope := UserScope{
		UserID:  "test-user",
		IsAdmin: true,
	}

	res, err := executor.Execute(context.Background(), scope, "non_existent_tool", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if errMsg, ok := res["error"].(string); !ok || errMsg == "" {
		t.Fatalf("expected error for nil pool or unknown tool, got: %v", res)
	}
}
