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
