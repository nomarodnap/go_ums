package service_test

import (
	"testing"
	"time"

	"github.com/dof/ums-backend/internal/service"
)

func TestGenerateBillPrefix(t *testing.T) {
	// Cost center: 2500300055 -> last 3 digits: 055
	// Year 2024 -> Thai Year 2567 -> 67
	// Month: 1 -> 01
	// Utility type: ค่าไฟฟ้า -> 1
	// Expected: 055-6701-1-
	prefix := service.GenerateBillPrefix("2500300055", 2024, 1, "ค่าไฟฟ้า")
	expected := "055-6701-1-"
	if prefix != expected {
		t.Errorf("Expected prefix %s, got %s", expected, prefix)
	}

	// Sequence generation
	nextCode := service.GenerateNextBillCode(prefix, "055-6701-1-04")
	expectedCode := "055-6701-1-05"
	if nextCode != expectedCode {
		t.Errorf("Expected next code %s, got %s", expectedCode, nextCode)
	}
}

func TestEvaluateBillAudits(t *testing.T) {
	invDate := time.Now().Add(-70 * 24 * time.Hour) // 70 days ago
	limit := 1000

	flags := service.EvaluateBillAudits(service.BillAuditInput{
		UtilityType:             "ค่าโทรศัพท์",
		BillingMonth:            1,
		BillingYear:             2024,
		InvoiceAmount:           1500.0,
		InvoiceDate:             &invDate,
		PaymentStatus:           "PENDING",
		PhoneReimbursementLimit: &limit,
	})

	if !flags.IsOverdueMoreThan2Months {
		t.Error("Expected IsOverdueMoreThan2Months to be true")
	}

	if !flags.IsPhoneOverLimit {
		t.Error("Expected IsPhoneOverLimit to be true for 1500 > 1000")
	}
}

func TestDetectStatisticalAnomaly(t *testing.T) {
	t.Run("sparse history falls back to >30% rule", func(t *testing.T) {
		normal := service.DetectStatisticalAnomaly(1250, []float64{1000, 1020})
		if normal.IsAnomaly {
			t.Fatalf("expected normal <30%% to not flag, got %+v", normal)
		}

		spike := service.DetectStatisticalAnomaly(1450, []float64{1000, 1020})
		if !spike.IsAnomaly || spike.Method != "FALLBACK_30_PCT" {
			t.Fatalf("expected FALLBACK_30_PCT spike anomaly, got %+v", spike)
		}
	})

	t.Run("z-score and IQR catch statistical spike below 30% when tightly clustered", func(t *testing.T) {
		// Mean ~ 1005, StdDev ~ 12.9, current = 1250 (+24.4%, +245 THB, Z ~ +19)
		res := service.DetectStatisticalAnomaly(1250, []float64{1000, 1020, 990, 1010})
		if !res.IsAnomaly || res.Method != "ZSCORE_IQR" {
			t.Fatalf("expected ZSCORE_IQR anomaly, got %+v", res)
		}
		if res.SampleCount != 4 || res.ZScore < 2.0 {
			t.Fatalf("unexpected statistical metrics: %+v", res)
		}
	})

	t.Run("practical significance guard suppresses tiny-variance false positives", func(t *testing.T) {
		// Tightly stable water bill ~100-102, 108 has high z-score but <15% and <50 THB diff
		res := service.DetectStatisticalAnomaly(108, []float64{100, 101, 100, 102})
		if res.IsAnomaly {
			t.Fatalf("expected practical guard to ignore small delta, got %+v", res)
		}
	})

	t.Run("flat zero-variance history uses 30% tolerance", func(t *testing.T) {
		ok := service.DetectStatisticalAnomaly(550, []float64{500, 500, 500, 500})
		if ok.IsAnomaly {
			t.Fatalf("expected +10%% flat bill not to flag, got %+v", ok)
		}

		flagged := service.DetectStatisticalAnomaly(750, []float64{500, 500, 500, 500})
		if !flagged.IsAnomaly || flagged.Method != "FLAT_30_PCT" {
			t.Fatalf("expected FLAT_30_PCT flag for 750 vs 500, got %+v", flagged)
		}
	})

	t.Run("avoids MoM false positive when prior month dipped abnormally", func(t *testing.T) {
		// Old 1-month MoM compared 5000 against prev 1200 -> false positive.
		// Statistical median (5000) & IQR show 5000 is completely normal.
		res := service.DetectStatisticalAnomaly(5000, []float64{1200, 5050, 4950, 5100, 5000})
		if res.IsAnomaly {
			t.Fatalf("expected normal bill 5000 not to flag despite one low month in history, got %+v", res)
		}
	})

	t.Run("EvaluateBillAudits honors HistoricalAmounts", func(t *testing.T) {
		invDate := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
		recDate := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
		flags := service.EvaluateBillAudits(service.BillAuditInput{
			UtilityType:       "ค่าไฟฟ้า",
			BillingMonth:      5,
			BillingYear:       2026,
			InvoiceAmount:     3200,
			InvoiceDate:       &invDate,
			ReceivedDate:      &recDate,
			PaymentStatus:     "PAID",
			HistoricalAmounts: []float64{2000, 2050, 1980, 2020, 2010},
		})
		if !flags.IsAnomalyExpense {
			t.Fatal("expected EvaluateBillAudits to flag statistical anomaly")
		}
	})
}
