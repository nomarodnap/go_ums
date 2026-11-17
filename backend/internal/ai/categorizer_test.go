package ai

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAccountCodeForUtility(t *testing.T) {
	cases := map[string]string{
		"ค่าไฟฟ้า":             "5104020101",
		"ค่าประปา&น้ำบาดาล":    "5104020103",
		"ค่าโทรศัพท์":          "5104020105",
		"ค่าสื่อสาร&โทรคมนาคม": "5104020106",
		"ค่าบริการไปรษณีย์":    "5104020107",
		"ไม่ทราบ":              "",
	}
	for util, want := range cases {
		if got := AccountCodeForUtility(util); got != want {
			t.Fatalf("AccountCodeForUtility(%q) = %q, want %q", util, got, want)
		}
	}
}

func TestGroundBudgetCodeFiscalRules(t *testing.T) {
	active := []BudgetCodeItem{
		{Code: "REVOLVING-70", Name: "เงินทุนหมุนเวียน", FiscalYearBE: 2570, IsActive: true},
		{Code: "07005302001002000000", Name: "งบดำเนินงาน 2569", FiscalYearBE: 2569, IsActive: true},
	}

	// Oct 2026 belongs to FY 2570 (exact match, zero warnings)
	sel, warns := GroundBudgetCode("REVOLVING-70", active, 10, 2026)
	if sel == nil || sel.Code != "REVOLVING-70" || len(warns) != 0 {
		t.Fatalf("expected exact FY2570 budget without warnings, got sel=%+v warns=%v", sel, warns)
	}

	// Hallucinated budget code falls back deterministically to matching FY active code with warning
	sel2, warns2 := GroundBudgetCode("HALLUCINATED-9999", active, 5, 2026)
	if sel2 == nil || sel2.Code != "07005302001002000000" || len(warns2) == 0 {
		t.Fatalf("expected grounded fallback to FY2569 with warning, got sel=%+v warns=%v", sel2, warns2)
	}

	// Aug 2026 (FY2569) using FY2570 budget gets Aug-Sep carryover note
	sel3, warns3 := GroundBudgetCode("REVOLVING-70", active, 8, 2026)
	if sel3 == nil || len(warns3) == 0 {
		t.Fatalf("expected carryover notice for Aug FY mismatch, got sel=%+v warns=%v", sel3, warns3)
	}
}

func TestCategorizeBillScopeAndMockGemini(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(GenerateContentResponse{
			Candidates: []Candidate{{
				FinishReason: "STOP",
				Content: Content{
					Role: "model",
					Parts: []Part{{
						Text: `{"utilityType":"ค่าไฟฟ้า","budgetCode":"","confidence":0.96,"reasoning":"ผู้ให้บริการ กฟภ. เป็นค่าไฟฟ้า"}`,
					}},
				},
			}},
		})
	}))
	defer srv.Close()

	client := NewClient("test-key", "gemini-3-flash-preview").WithBaseURL(srv.URL)
	svc := NewCategorizerService(client, nil)
	svc.now = func() time.Time { return time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC) }

	// Non-admin targeting another department must be rejected
	_, err := svc.CategorizeBill(context.Background(), UserScope{
		UserID: "u1", Role: "user", IsAdmin: false, DepartmentID: "dept-1",
	}, CategorizeBillRequest{DepartmentID: "dept-999"})
	if !errors.Is(err, ErrUnauthorizedScope) {
		t.Fatalf("expected ErrUnauthorizedScope, got %v", err)
	}

	// Valid request returns canonical utilityType + deterministic GL accountCode
	res, err := svc.CategorizeBill(context.Background(), UserScope{
		UserID: "u1", Role: "user", IsAdmin: false, DepartmentID: "dept-1",
	}, CategorizeBillRequest{
		Provider:     "กฟภ.",
		BillingMonth: 11,
		BillingYear:  2026,
	})
	if err != nil {
		t.Fatalf("CategorizeBill failed: %v", err)
	}
	if res.UtilityType != "ค่าไฟฟ้า" || res.AccountCode != "5104020101" {
		t.Fatalf("unexpected categorization output: %+v", res)
	}
}

