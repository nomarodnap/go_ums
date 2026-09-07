package service

import (
	"time"
)

type AuditFlags struct {
	IsLateReceive             bool
	IsLatePayment             bool
	IsOverdueMoreThan2Months  bool
	IsDisbursementOver2Months bool
	IsWrongMonth              bool
	IsPhoneOverLimit          bool
	IsPhoneUsageOverLimit     bool
	IsWrongBudget             bool
	IsDuplicate               bool
	IsAnomalyExpense          bool
}

type BillAuditInput struct {
	UtilityType             string
	BillingMonth            int
	BillingYear             int
	InvoiceAmount           float64
	InvoiceDate             *time.Time
	ReceivedDate            *time.Time
	SentToDisbursingDate    *time.Time
	PaymentDate             *time.Time
	PaymentStatus           string
	PhoneReimbursementLimit *int
	HistoricalAvgAmount     float64
	HasDuplicateBill        bool
}

// EvaluateBillAudits evaluates all 10 audit rules for a utility bill
func EvaluateBillAudits(input BillAuditInput) AuditFlags {
	flags := AuditFlags{}
	now := time.Now()

	// 1. Late Receive: Received date > 30 days after invoice date
	if input.InvoiceDate != nil && input.ReceivedDate != nil {
		if input.ReceivedDate.Sub(*input.InvoiceDate) > (30 * 24 * time.Hour) {
			flags.IsLateReceive = true
		}
	}

	// 2. Late Payment: Payment date > 30 days after received date
	if input.ReceivedDate != nil && input.PaymentDate != nil {
		if input.PaymentDate.Sub(*input.ReceivedDate) > (30 * 24 * time.Hour) {
			flags.IsLatePayment = true
		}
	}

	// 3. Overdue > 2 Months: Unpaid and invoice date > 60 days ago
	if input.PaymentStatus != "PAID" && input.InvoiceDate != nil {
		if now.Sub(*input.InvoiceDate) > (60 * 24 * time.Hour) {
			flags.IsOverdueMoreThan2Months = true
		}
	}

	// 4. Disbursement Over 2 Months: Time between sent to disbursing and actual payment > 60 days
	if input.SentToDisbursingDate != nil && input.PaymentDate != nil {
		if input.PaymentDate.Sub(*input.SentToDisbursingDate) > (60 * 24 * time.Hour) {
			flags.IsDisbursementOver2Months = true
		}
	}

	// 5. Wrong Month: Invoice Date month does not match the stated billing month
	if input.InvoiceDate != nil {
		invMonth := int(input.InvoiceDate.Month())
		if invMonth != input.BillingMonth {
			flags.IsWrongMonth = true
		}
	}

	// 6. Phone Over Limit: Phone bill exceeds designated reimbursement limit
	if input.UtilityType == "ค่าโทรศัพท์" && input.PhoneReimbursementLimit != nil && *input.PhoneReimbursementLimit > 0 {
		if input.InvoiceAmount > float64(*input.PhoneReimbursementLimit) {
			flags.IsPhoneOverLimit = true
		}
	}

	// 7. Duplicate Bill
	if input.HasDuplicateBill {
		flags.IsDuplicate = true
	}

	// 8. Expense Anomaly: Amount deviates > 20% compared to historical average (if history exists)
	if input.HistoricalAvgAmount > 0 {
		diff := input.InvoiceAmount - input.HistoricalAvgAmount
		if diff < 0 {
			diff = -diff
		}
		pct := diff / input.HistoricalAvgAmount
		if pct > 0.20 {
			flags.IsAnomalyExpense = true
		}
	}

	return flags
}
