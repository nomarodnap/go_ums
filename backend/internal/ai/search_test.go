package ai

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestClientEmbedContentAndPGArrayRoundTrip(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "gemini-embedding-001:embedContent") {
			t.Fatalf("unexpected embed path: %s", r.URL.Path)
		}
		var req EmbedContentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode embed request: %v", err)
		}
		if req.OutputDimensionality != DefaultEmbeddingDim || req.TaskType != "RETRIEVAL_QUERY" {
			t.Fatalf("unexpected embed params: %+v", req)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(EmbedContentResponse{
			Embedding: &ContentEmbedding{
				Values: []float64{0.25, -0.5, 0.75},
			},
		})
	}))
	defer srv.Close()

	client := NewClient("test-key", "gemini-3-flash-preview").WithBaseURL(srv.URL)
	vec, err := client.EmbedContent(context.Background(), "บิลค่าไฟภาคใต้", "RETRIEVAL_QUERY")
	if err != nil {
		t.Fatalf("EmbedContent failed: %v", err)
	}
	if len(vec) != 3 || math.Abs(vec[1]+0.5) > 1e-6 {
		t.Fatalf("unexpected embedding values: %v", vec)
	}

	encoded := formatPGFloat8Array(vec)
	decoded := parsePGFloat8Array(encoded)
	if len(decoded) != 3 || math.Abs(decoded[2]-0.75) > 1e-6 {
		t.Fatalf("PG array round-trip mismatch: encoded=%s decoded=%v", encoded, decoded)
	}
}

func TestCosineSimilarityAndThaiRegionInference(t *testing.T) {
	if got := CosineSimilarity([]float64{1, 0}, []float64{1, 0}); math.Abs(got-1.0) > 1e-9 {
		t.Fatalf("expected cosine 1.0, got %v", got)
	}
	if got := CosineSimilarity([]float64{1, 0}, []float64{0, 1}); math.Abs(got) > 1e-9 {
		t.Fatalf("expected cosine 0.0, got %v", got)
	}
	if got := CosineSimilarity([]float64{1, 0}, []float64{1}); got != 0 {
		t.Fatalf("expected 0 on length mismatch, got %v", got)
	}

	prov, reg := InferProvinceAndRegion("", "อ.เมืองสงขลา", "สำนักงานประมงจังหวัดสงขลา")
	if prov != "สงขลา" || reg != "ภาคใต้" {
		t.Fatalf("expected Songkhla / South, got prov=%q reg=%q", prov, reg)
	}

	prov2, reg2 := InferProvinceAndRegion("ขอนแก่น", "", "ศพจ.ขอนแก่น")
	if prov2 != "ขอนแก่น" || reg2 != "ภาคตะวันออกเฉียงเหนือ" {
		t.Fatalf("expected Khon Kaen / Northeast, got prov=%q reg=%q", prov2, reg2)
	}
}

func TestHybridSearchRankingSouthernPendingElectricity(t *testing.T) {
	bills := []BillIndexRecord{
		{
			ID:             "bill-south-elec-pending",
			BillCode:       "001-6910-1-01",
			DepartmentID:   "d-songkhla",
			DepartmentName: "สำนักงานประมงจังหวัดสงขลา",
			Province:       "สงขลา",
			UtilityType:    "ค่าไฟฟ้า",
			BillingMonth:   10,
			BillingYearCE:  2026,
			PaymentStatus:  "PENDING",
			InvoiceStatus:  "RECEIVED",
			InvoiceAmount:  12450.0,
		},
		{
			ID:             "bill-south-elec-paid",
			BillCode:       "001-6909-1-01",
			DepartmentID:   "d-phuket",
			DepartmentName: "สำนักงานประมงจังหวัดภูเก็ต",
			Province:       "ภูเก็ต",
			UtilityType:    "ค่าไฟฟ้า",
			BillingMonth:   9,
			BillingYearCE:  2026,
			PaymentStatus:  "PAID",
			InvoiceStatus:  "RECEIVED",
			PaidAmount:     8900.0,
		},
		{
			ID:             "bill-north-water-pending",
			BillCode:       "002-6910-3-01",
			DepartmentID:   "d-chiangmai",
			DepartmentName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่",
			Province:       "เชียงใหม่",
			UtilityType:    "ค่าประปา&น้ำบาดาล",
			BillingMonth:   10,
			BillingYearCE:  2026,
			PaymentStatus:  "PENDING",
			InvoiceStatus:  "RECEIVED",
			InvoiceAmount:  3200.0,
		},
	}

	depts := []DeptIndexRecord{
		{ID: "d-songkhla", FullName: "สำนักงานประมงจังหวัดสงขลา", Province: "สงขลา", Type: "regional"},
		{ID: "d-chiangmai", FullName: "ศูนย์วิจัยประมงน้ำจืดเชียงใหม่", Province: "เชียงใหม่", Type: "regional"},
	}

	query := "บิลค่าไฟที่ยังไม่ได้จ่ายของสำนักงานประมงภาคใต้"

	// 1. Test hybrid mode with mock embeddings
	qVec := []float64{1, 0, 0}
	vecs := map[string]storedEmbedding{
		"bill:bill-south-elec-pending":  {Vector: []float64{0.95, 0.2, 0}},
		"bill:bill-south-elec-paid":     {Vector: []float64{0.75, 0.4, 0}},
		"bill:bill-north-water-pending": {Vector: []float64{0.2, 0.9, 0}},
		"department:d-songkhla":         {Vector: []float64{0.9, 0.2, 0}},
	}

	billHits, deptHits := rankSearchCandidates(query, qVec, true, bills, depts, vecs, 10)
	if len(billHits) == 0 || billHits[0].ID != "bill-south-elec-pending" {
		t.Fatalf("expected bill-south-elec-pending ranked #1 in hybrid mode, got %+v", billHits)
	}
	if len(deptHits) == 0 || deptHits[0].ID != "d-songkhla" {
		t.Fatalf("expected Songkhla ranked #1 department, got %+v", deptHits)
	}

	// 2. Test pure keyword/intent fallback mode without vectors
	fbBills, fbDepts := rankSearchCandidates(query, nil, false, bills, depts, nil, 10)
	if len(fbBills) == 0 || fbBills[0].ID != "bill-south-elec-pending" {
		t.Fatalf("expected bill-south-elec-pending ranked #1 in keyword fallback, got %+v", fbBills)
	}
	if len(fbDepts) == 0 || fbDepts[0].ID != "d-songkhla" {
		t.Fatalf("expected Songkhla ranked #1 department in keyword fallback, got %+v", fbDepts)
	}
}

func TestSearchBlankQueryRejected(t *testing.T) {
	svc := NewSearchService(nil, nil)
	_, err := svc.Search(context.Background(), UserScope{IsAdmin: true}, SearchRequest{Query: "   "})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for empty query, got %v", err)
	}
}

