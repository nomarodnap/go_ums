package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNormalizeThaiInvoiceDate(t *testing.T) {
	cases := []struct {
		raw      string
		want     string
		wantWarn bool
	}{
		{"2026-10-15", "2026-10-15", false},
		{"2569-10-15", "2026-10-15", false},
		{"15/10/2569", "2026-10-15", false},
		{"15-10-69", "2026-10-15", false},
		{"15 ต.ค. 2569", "2026-10-15", false},
		{"๑๕ ตุลาคม ๒๕๖๙", "2026-10-15", false},
		{"31/02/2569", "", true},
		{"invalid-date", "", true},
	}
	for _, tc := range cases {
		got, warn := NormalizeThaiInvoiceDate(tc.raw)
		if got != tc.want {
			t.Fatalf("NormalizeThaiInvoiceDate(%q) = %q, want %q (warn=%q)", tc.raw, got, tc.want, warn)
		}
		if tc.wantWarn && warn == "" {
			t.Fatalf("expected warning for %q", tc.raw)
		}
		if !tc.wantWarn && warn != "" {
			t.Fatalf("unexpected warning for %q: %s", tc.raw, warn)
		}
	}
}

func TestDetectAllowedDocumentMIME(t *testing.T) {
	pngMagic := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0}
	if mime, err := detectAllowedDocumentMIME("inv.png", "", pngMagic); err != nil || mime != "image/png" {
		t.Fatalf("expected image/png, got mime=%q err=%v", mime, err)
	}

	pdfMagic := []byte("%PDF-1.4\n%...")
	if mime, err := detectAllowedDocumentMIME("inv.pdf", "", pdfMagic); err != nil || mime != "application/pdf" {
		t.Fatalf("expected application/pdf, got mime=%q err=%v", mime, err)
	}

	if _, err := detectAllowedDocumentMIME("note.txt", "text/plain", []byte("plain text invoice")); !errors.Is(err, ErrInvalidDocument) {
		t.Fatalf("expected ErrInvalidDocument for text file, got %v", err)
	}

	oversized := bytes.Repeat([]byte{0x89}, MaxDocumentBytes+1)
	if _, err := detectAllowedDocumentMIME("huge.png", "image/png", oversized); !errors.Is(err, ErrDocumentTooLarge) {
		t.Fatalf("expected ErrDocumentTooLarge, got %v", err)
	}
}

func TestExtractBillDocumentMultimodalRequestAndBEConversion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req GenerateContentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode multimodal request: %v", err)
		}
		if req.GenerationConfig == nil || req.GenerationConfig.MaxOutputTokens < 4096 {
			t.Fatalf("expected MaxOutputTokens >= 4096, got %+v", req.GenerationConfig)
		}
		if len(req.Contents) == 0 || len(req.Contents[0].Parts) < 2 || req.Contents[0].Parts[0].InlineData == nil {
			t.Fatalf("expected inlineData part in first user content")
		}
		if req.Contents[0].Parts[0].InlineData.MIMEType != "image/png" {
			t.Fatalf("expected image/png inlineData, got %s", req.Contents[0].Parts[0].InlineData.MIMEType)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(GenerateContentResponse{
			Candidates: []Candidate{{
				FinishReason: "STOP",
				Content: Content{
					Role: "model",
					Parts: []Part{{
						Text: `{
							"utilityType": "ค่าไฟฟ้า",
							"provider": "กฟภ.",
							"serviceNumber": "020012345678",
							"invoiceNumber": "INV-2569-10-099",
							"invoiceDate": "15 ต.ค. 2569",
							"billingMonth": 10,
							"billingYear": 2569,
							"usageAmount": 412.5,
							"invoiceAmount": 1980.25,
							"confidence": 0.94,
							"notes": "ค่าไฟฟ้าประจำเดือนตุลาคม 2569"
						}`,
					}},
				},
			}},
		})
	}))
	defer srv.Close()

	client := NewClient("test-key", "gemini-3-flash-preview").WithBaseURL(srv.URL)
	svc := NewExtractorService(client, nil)
	pngMagic := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0}

	// Cross-department access blocked for non-admin
	_, err := svc.ExtractBillDocument(context.Background(), UserScope{
		UserID: "u1", Role: "user", IsAdmin: false, DepartmentID: "dept-1",
	}, "dept-2", "inv.png", "image/png", pngMagic)
	if !errors.Is(err, ErrUnauthorizedScope) {
		t.Fatalf("expected ErrUnauthorizedScope, got %v", err)
	}

	res, err := svc.ExtractBillDocument(context.Background(), UserScope{
		UserID: "u1", Role: "user", IsAdmin: false, DepartmentID: "dept-1",
	}, "dept-1", "inv.png", "image/png", pngMagic)
	if err != nil {
		t.Fatalf("ExtractBillDocument failed: %v", err)
	}
	if res.UtilityType != "ค่าไฟฟ้า" || res.AccountCode != "5104020101" {
		t.Fatalf("unexpected utility/account code: %+v", res)
	}
	if res.InvoiceDate != "2026-10-15" || res.BillingMonthStr != "2026-10" || res.BillingYearBE != 2569 {
		t.Fatalf("expected BE->CE conversion 2026-10-15 & 2026-10, got date=%q monthStr=%q yearBE=%d",
			res.InvoiceDate, res.BillingMonthStr, res.BillingYearBE)
	}
	if res.InvoiceAmount == nil || *res.InvoiceAmount != 1980.25 || !strings.Contains(res.InvoiceNumber, "INV-2569") {
		t.Fatalf("unexpected extracted amounts/invoice: %+v", res)
	}
}

