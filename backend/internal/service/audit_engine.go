package service

import (
	"context"
	"encoding/json"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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

// EvaluateBillAudits evaluates all 10 audit rules for a utility bill in memory
func EvaluateBillAudits(input BillAuditInput) AuditFlags {
	flags := AuditFlags{}
	now := time.Now()

	// 1. Late Receive: Received date > 30 days after invoice date
	if input.InvoiceDate != nil && input.ReceivedDate != nil {
		if input.ReceivedDate.Sub(*input.InvoiceDate) > (30 * 24 * time.Hour) {
			flags.IsLateReceive = true
		}
	}

	// 2. Late Payment: Payment date > 15 days after received date
	if input.ReceivedDate != nil && input.PaymentDate != nil {
		if input.PaymentDate.Sub(*input.ReceivedDate) > (15 * 24 * time.Hour) {
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

	// 8. Expense Anomaly: Amount deviates > 30% compared to historical average (if history exists)
	if input.HistoricalAvgAmount > 0 {
		diff := input.InvoiceAmount - input.HistoricalAvgAmount
		if diff < 0 {
			diff = -diff
		}
		pct := diff / input.HistoricalAvgAmount
		if pct > 0.30 {
			flags.IsAnomalyExpense = true
		}
	}

	return flags
}

// RunAuditChecks performs the comprehensive 7-point audit checks matching next_ums prototype
func RunAuditChecks(ctx context.Context, pool *pgxpool.Pool, billID string, currentUserID string, checkOthers bool) error {
	type billAuditData struct {
		id                   string
		departmentID         string
		utilityType          string
		billingMonth         int
		billingYear          int
		provider             *string
		serviceNumber        *string
		serviceBreakdown     *string
		invoiceNumber        *string
		invoiceDate          *time.Time
		invoiceStatus        string
		invoiceAmount        *float64
		paidAmount           *float64
		paymentStatus        string
		paymentDate          *time.Time
		receivedDate         *time.Time
		sentToDisbursingDate *time.Time
		budgetCode           *string
		createdAt            time.Time
	}

	var b billAuditData
	err := pool.QueryRow(ctx, `
		SELECT id, department_id, utility_type, billing_month, billing_year,
		       provider, service_number, service_breakdown, invoice_number,
		       invoice_date, invoice_status, invoice_amount, paid_amount,
		       payment_status, payment_date, received_date, sent_to_disbursing_date,
		       budget_code, created_at
		FROM utility_bills
		WHERE id = $1
	`, billID).Scan(
		&b.id, &b.departmentID, &b.utilityType, &b.billingMonth, &b.billingYear,
		&b.provider, &b.serviceNumber, &b.serviceBreakdown, &b.invoiceNumber,
		&b.invoiceDate, &b.invoiceStatus, &b.invoiceAmount, &b.paidAmount,
		&b.paymentStatus, &b.paymentDate, &b.receivedDate, &b.sentToDisbursingDate,
		&b.budgetCode, &b.createdAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return err
	}

	// Initialize flags
	var (
		isLateReceive             bool
		isLatePayment             bool
		isOverdueMoreThan2Months  bool
		isDisbursementOver2Months bool
		isWrongMonth              bool
		isPhoneOverLimit          bool
		isPhoneUsageOverLimit     bool
		isWrongBudget             bool
		isDuplicate               bool
		isAnomalyExpense          bool
	)

	// 1. ลงรับใบแจ้งหนี้ล่าช้า: รับใบแจ้งหนี้จากผู้ให้บริการ > 30 วัน
	if b.invoiceDate != nil && b.receivedDate != nil {
		days := int(b.receivedDate.Sub(*b.invoiceDate).Hours() / 24)
		if days > 30 {
			isLateReceive = true
		}
	}

	// 2. เบิกจ่ายล่าช้า: ชำระค่าบริการ > 15 วัน (หลังจากวันที่รับบิล)
	if b.receivedDate != nil && b.paymentDate != nil {
		days := int(b.paymentDate.Sub(*b.receivedDate).Hours() / 24)
		if days > 15 {
			isLatePayment = true
		}
	}

	// 3. มีหนี้ค้างชำระ > 2 เดือน (รวมเงื่อนไขเบิกจ่ายเกิน 2 เดือนเข้าด้วยกัน)
	// 1) หากยังไม่ได้รับใบแจ้งหนี้: ใช้รอบบิลประจำเดือน (billingYear, billingMonth) เทียบกับวันปัจจุบัน หากผลต่างเกิน 2 เดือนจะขึ้นสถานะ
	// 2) หากได้รับใบแจ้งหนี้แล้ว แต่ยังไม่ได้เบิกจ่าย: ใช้วันที่ใบแจ้งหนี้ (invoiceDate) เทียบกับวันปัจจุบัน หากเกิน 2 เดือนจะขึ้นสถานะ
	// 3) หากได้รับใบแจ้งหนี้แล้ว และเบิกจ่ายแล้ว: ใช้วันที่ใบแจ้งหนี้ (invoiceDate) เทียบกับวันที่เอกสารเบิกจ่าย (paymentDate) หากเกิน 2 เดือนจะขึ้นสถานะ
	now := time.Now()
	if b.invoiceStatus == "NOT_RECEIVED" || b.invoiceDate == nil {
		if b.billingYear > 0 && b.billingMonth > 0 {
			yearCE := b.billingYear
			if yearCE > 2400 {
				yearCE -= 543
			}
			diffInMonths := (now.Year()*12 + int(now.Month())) - (yearCE*12 + b.billingMonth)
			if diffInMonths > 2 {
				isOverdueMoreThan2Months = true
			}
		}
	} else if b.invoiceStatus == "RECEIVED" && b.invoiceDate != nil {
		invDate := *b.invoiceDate
		invPlus2Months := invDate.AddDate(0, 2, 0)

		if b.paymentStatus == "PAID" && b.paymentDate != nil {
			payDate := *b.paymentDate
			days := int(payDate.Sub(invDate).Hours() / 24)
			if payDate.After(invPlus2Months) || days > 60 {
				isOverdueMoreThan2Months = true
			}
		} else {
			days := int(now.Sub(invDate).Hours() / 24)
			if now.After(invPlus2Months) || days > 60 {
				isOverdueMoreThan2Months = true
			}
		}
	}

	// 4. นำใบแจ้งหนี้ของเดือนอื่น ที่ไม่ใช่เดือน ส.ค. – ก.ย. ของปีงบประมาณที่ผ่านมาเบิก (เบิกจ่ายผิดเดือน)
	// 1) คำนวณปีงบประมาณของรอบบิล (Bill Fiscal Year พ.ศ.)
	billYearBE := b.billingYear
	if billYearBE < 2400 {
		billYearBE += 543
	}
	billFiscalYearBE := billYearBE
	if b.billingMonth >= 10 {
		billFiscalYearBE++
	}

	// 2) หาปีงบประมาณจากรหัสงบประมาณ (Budget Code Fiscal Year พ.ศ.)
	var budgetFiscalYearBE int
	if b.budgetCode != nil && strings.TrimSpace(*b.budgetCode) != "" {
		cleanBudgetCode := strings.TrimSpace(*b.budgetCode)
		// 2.1 หาจากฐานข้อมูล budget_codes
		var dbFiscalYear int
		err := pool.QueryRow(ctx, "SELECT fiscal_year FROM budget_codes WHERE code = $1 LIMIT 1", cleanBudgetCode).Scan(&dbFiscalYear)
		if err == nil && dbFiscalYear > 0 {
			if dbFiscalYear < 2400 {
				budgetFiscalYearBE = dbFiscalYear + 543
			} else {
				budgetFiscalYearBE = dbFiscalYear
			}
		} else {
			// 2.2 สกัดจากตัวเลขใน budgetCode เช่น 2568, 2569 หรือขึ้นต้นด้วย 68, 69
			re4 := regexp.MustCompile(`(25[5-7][0-9])`)
			re2 := regexp.MustCompile(`^(6[0-9]|7[0-9])`)
			if match := re4.FindStringSubmatch(cleanBudgetCode); len(match) > 1 {
				budgetFiscalYearBE, _ = strconv.Atoi(match[1])
			} else if match := re2.FindStringSubmatch(cleanBudgetCode); len(match) > 1 {
				val2, _ := strconv.Atoi(match[1])
				budgetFiscalYearBE = 2500 + val2
			}
		}
	}

	// 2.3 ถ้าไม่มีรหัสงบประมาณ ให้ใช้วันที่เบิกจ่าย (paymentDate) หรือวันปัจจุบันเป็นเกณฑ์อ้างอิง
	if budgetFiscalYearBE == 0 {
		refDate := now
		if b.paymentDate != nil {
			refDate = *b.paymentDate
		}
		refYearBE := refDate.Year() + 543
		if int(refDate.Month()) >= 10 {
			refYearBE++
		}
		budgetFiscalYearBE = refYearBE
	}

	// 3) เปรียบเทียบปีงบประมาณของรอบบิล กับ ปีงบประมาณที่ใช้เบิกจ่าย
	if billFiscalYearBE < budgetFiscalYearBE {
		// นำบิลของปีงบประมาณก่อนหน้ามาเบิกจ่ายในปีงบประมาณนี้
		// อนุญาตเฉพาะรอบบิลเดือน สิงหาคม (เดือน 8) และ กันยายน (เดือน 9) เท่านั้น
		if b.billingMonth != 8 && b.billingMonth != 9 {
			isWrongMonth = true
		}
	} else if billFiscalYearBE > budgetFiscalYearBE {
		// นำบิลของปีงบประมาณอนาคตมาเบิกด้วยงบปีก่อนหน้า
		isWrongMonth = true
	}

	// 5 & 6. ตรวจสอบค่าโทรศัพท์: ใช้ค่าโทรศัพท์เกินเกณฑ์ และ เบิกค่าโทรศัพท์เกินเกณฑ์
	if (b.utilityType == "ค่าโทรศัพท์" || b.utilityType == "ค่าสื่อสาร&โทรคมนาคม") && b.serviceNumber != nil && strings.TrimSpace(*b.serviceNumber) != "" {
		serviceNumbers := make([]string, 0)
		for _, s := range strings.Split(*b.serviceNumber, ",") {
			trimmed := strings.TrimSpace(s)
			if trimmed != "" {
				serviceNumbers = append(serviceNumbers, trimmed)
			}
		}

		breakdownMap := make(map[string]float64)
		if b.serviceBreakdown != nil && strings.TrimSpace(*b.serviceBreakdown) != "" {
			var rawMap map[string]interface{}
			if err := json.Unmarshal([]byte(*b.serviceBreakdown), &rawMap); err == nil {
				for k, v := range rawMap {
					trimmedKey := strings.TrimSpace(k)
					switch val := v.(type) {
					case float64:
						breakdownMap[trimmedKey] = val
					case string:
						if f, err := strconv.ParseFloat(val, 64); err == nil {
							breakdownMap[trimmedKey] = f
						}
					}
				}
			}
		}

		hasBreakdown := len(breakdownMap) > 0
		maxReimbursableTotal := 0.0
		hasAnyLimitRule := false

		for _, num := range serviceNumbers {
			var phoneOwnerName *string
			var phoneReimbursementLimit *int
			err := pool.QueryRow(ctx, `
				SELECT phone_owner_name, phone_reimbursement_limit
				FROM department_services
				WHERE service_number = $1 AND department_id = $2
				LIMIT 1
			`, num, b.departmentID).Scan(&phoneOwnerName, &phoneReimbursementLimit)

			billedForNum := 0.0
			if val, ok := breakdownMap[num]; hasBreakdown && ok {
				billedForNum = val
			} else if len(serviceNumbers) == 1 {
				if b.invoiceAmount != nil && *b.invoiceAmount > 0 {
					billedForNum = *b.invoiceAmount
				} else if b.paidAmount != nil && *b.paidAmount > 0 {
					billedForNum = *b.paidAmount
				}
			}

			if err == nil && phoneOwnerName != nil && strings.TrimSpace(*phoneOwnerName) != "" &&
				phoneReimbursementLimit != nil && *phoneReimbursementLimit > 0 {
				hasAnyLimitRule = true
				limitFloat := float64(*phoneReimbursementLimit)
				// ใช้ค่าโทรศัพท์เกินเกณฑ์: ตรวจสอบจากยอดตามใบแจ้งหนี้/Breakdown เทียบกับสิทธิ
				if billedForNum > limitFloat+0.001 {
					isPhoneUsageOverLimit = true
				}

				eligible := limitFloat
				if billedForNum > 0 {
					eligible = math.Min(billedForNum, limitFloat)
				}
				maxReimbursableTotal += eligible
			} else {
				maxReimbursableTotal += billedForNum
			}
		}

		// เบิกค่าโทรศัพท์เกินเกณฑ์: ตรวจสอบเมื่อมีการระบุยอดที่เบิกจ่ายจริง (paidAmount)
		if b.paidAmount != nil && hasAnyLimitRule && *b.paidAmount > maxReimbursableTotal+0.001 {
			isPhoneOverLimit = true
		}
	}

	// 7. เบิกจ่ายซ้ำ (ตรวจจากเลขที่ใบแจ้งหนี้ที่ซ้ำกัน ในประเภทสาธารณูปโภคและหน่วยงานเดียวกัน)
	// ให้ขึ้นเฉพาะรายการของ "เดือนหลัง" (หรือรายการที่สร้างทีหลัง) เท่านั้น รายการแรกจะไม่ขึ้นซ้ำซ้อน
	if b.invoiceNumber != nil && strings.TrimSpace(*b.invoiceNumber) != "" && strings.TrimSpace(*b.invoiceNumber) != "-" {
		rows, err := pool.Query(ctx, `
			SELECT id, billing_year, billing_month, created_at
			FROM utility_bills
			WHERE invoice_number = $1 AND department_id = $2 AND utility_type = $3
		`, strings.TrimSpace(*b.invoiceNumber), b.departmentID, b.utilityType)
		if err == nil {
			type dupItem struct {
				id           string
				billingYear  int
				billingMonth int
				createdAt    time.Time
			}
			var duplicates []dupItem
			for rows.Next() {
				var d dupItem
				if err := rows.Scan(&d.id, &d.billingYear, &d.billingMonth, &d.createdAt); err == nil {
					duplicates = append(duplicates, d)
				}
			}
			rows.Close()

			if len(duplicates) > 1 {
				sort.Slice(duplicates, func(i, j int) bool {
					timeA := duplicates[i].billingYear*12 + duplicates[i].billingMonth
					timeB := duplicates[j].billingYear*12 + duplicates[j].billingMonth
					if timeA != timeB {
						return timeA < timeB
					}
					if !duplicates[i].createdAt.Equal(duplicates[j].createdAt) {
						return duplicates[i].createdAt.Before(duplicates[j].createdAt)
					}
					return duplicates[i].id < duplicates[j].id
				})

				earliestBill := duplicates[0]
				if b.id != earliestBill.id {
					isDuplicate = true
				}

				if checkOthers {
					for _, other := range duplicates {
						if other.id != b.id {
							_ = RunAuditChecks(ctx, pool, other.id, currentUserID, false)
						}
					}
				}
			}
		}
	}

	// 8. ค่าใช้จ่ายสูงผิดปกติ (> 30% เทียบกับรอบบิลเดือนก่อนหน้าของหมายเลขบริการ/หน่วยงานเดียวกัน)
	currentBillAmount := 0.0
	if b.invoiceAmount != nil && *b.invoiceAmount > 0 {
		currentBillAmount = *b.invoiceAmount
	} else if b.paidAmount != nil && *b.paidAmount > 0 {
		currentBillAmount = *b.paidAmount
	}

	if currentBillAmount > 0 && b.billingMonth > 0 && b.billingYear > 0 {
		prevMonth := b.billingMonth - 1
		prevYear := b.billingYear
		if b.billingMonth == 1 {
			prevMonth = 12
			prevYear = b.billingYear - 1
		}

		rows, err := pool.Query(ctx, `
			SELECT service_number, invoice_amount, paid_amount
			FROM utility_bills
			WHERE department_id = $1 AND utility_type = $2 AND billing_month = $3 AND billing_year = $4
		`, b.departmentID, b.utilityType, prevMonth, prevYear)
		if err == nil {
			type prevItem struct {
				serviceNumber *string
				invoiceAmount *float64
				paidAmount    *float64
			}
			var prevBills []prevItem
			for rows.Next() {
				var p prevItem
				if err := rows.Scan(&p.serviceNumber, &p.invoiceAmount, &p.paidAmount); err == nil {
					prevBills = append(prevBills, p)
				}
			}
			rows.Close()

			prevAmount := 0.0
			if b.serviceNumber != nil && strings.TrimSpace(*b.serviceNumber) != "" {
				currentNumbers := make([]string, 0)
				for _, s := range strings.Split(*b.serviceNumber, ",") {
					t := strings.TrimSpace(s)
					if t != "" {
						currentNumbers = append(currentNumbers, t)
					}
				}

				for _, pb := range prevBills {
					if pb.serviceNumber == nil {
						continue
					}
					pbNums := strings.Split(*pb.serviceNumber, ",")
					matched := false
					for _, pbn := range pbNums {
						t := strings.TrimSpace(pbn)
						for _, cn := range currentNumbers {
							if t == cn {
								matched = true
								break
							}
						}
						if matched {
							break
						}
					}
					if matched {
						if pb.invoiceAmount != nil && *pb.invoiceAmount > 0 {
							prevAmount = *pb.invoiceAmount
						} else if pb.paidAmount != nil && *pb.paidAmount > 0 {
							prevAmount = *pb.paidAmount
						}
						break
					}
				}
			} else if len(prevBills) > 0 {
				if prevBills[0].invoiceAmount != nil && *prevBills[0].invoiceAmount > 0 {
					prevAmount = *prevBills[0].invoiceAmount
				} else if prevBills[0].paidAmount != nil && *prevBills[0].paidAmount > 0 {
					prevAmount = *prevBills[0].paidAmount
				}
			}

			if prevAmount > 0 && currentBillAmount > prevAmount*1.3 {
				isAnomalyExpense = true
			}
		}
	}

	// Check if audit record already exists
	var existingAuditID string
	var isManualAnomaly bool
	var manualAnomalyReason *string

	err = pool.QueryRow(ctx, `
		SELECT id, is_manual_anomaly, manual_anomaly_reason
		FROM audits
		WHERE utility_bill_id = $1
		LIMIT 1
	`, b.id).Scan(&existingAuditID, &isManualAnomaly, &manualAnomalyReason)
	if err != nil && err != pgx.ErrNoRows {
		return err
	}

	hasIssues := isLateReceive ||
		isLatePayment ||
		isOverdueMoreThan2Months ||
		isDisbursementOver2Months ||
		isWrongMonth ||
		isPhoneOverLimit ||
		isPhoneUsageOverLimit ||
		isWrongBudget ||
		isDuplicate ||
		isAnomalyExpense ||
		isManualAnomaly

	if hasIssues {
		if existingAuditID != "" {
			_, err = pool.Exec(ctx, `
				UPDATE audits SET
					is_late_receive = $1,
					is_late_payment = $2,
					is_overdue_more_than_2_months = $3,
					is_disbursement_over_2_months = $4,
					is_wrong_month = $5,
					is_phone_over_limit = $6,
					is_phone_usage_over_limit = $7,
					is_wrong_budget = $8,
					is_duplicate = $9,
					is_anomaly_expense = $10,
					status = 'PENDING_CORRECTION',
					updated_at = NOW()
				WHERE id = $11
			`, isLateReceive, isLatePayment, isOverdueMoreThan2Months, isDisbursementOver2Months,
				isWrongMonth, isPhoneOverLimit, isPhoneUsageOverLimit, isWrongBudget,
				isDuplicate, isAnomalyExpense, existingAuditID)
		} else {
			newID := uuid.New().String()
			auditor := "SYSTEM"
			if currentUserID != "" {
				auditor = currentUserID
			}
			_, err = pool.Exec(ctx, `
				INSERT INTO audits (
					id, utility_bill_id, auditor_id,
					is_late_receive, is_late_payment, is_overdue_more_than_2_months,
					is_disbursement_over_2_months, is_wrong_month, is_phone_over_limit,
					is_phone_usage_over_limit, is_wrong_budget, is_duplicate,
					is_anomaly_expense, is_manual_anomaly, manual_anomaly_reason,
					status, created_at, updated_at
				) VALUES (
					$1, $2, $3,
					$4, $5, $6,
					$7, $8, $9,
					$10, $11, $12,
					$13, $14, $15,
					'PENDING_CORRECTION', NOW(), NOW()
				)
			`, newID, b.id, auditor,
				isLateReceive, isLatePayment, isOverdueMoreThan2Months,
				isDisbursementOver2Months, isWrongMonth, isPhoneOverLimit,
				isPhoneUsageOverLimit, isWrongBudget, isDuplicate,
				isAnomalyExpense, isManualAnomaly, manualAnomalyReason)
		}
	} else {
		if existingAuditID != "" {
			_, err = pool.Exec(ctx, `
				UPDATE audits SET
					is_late_receive = false,
					is_late_payment = false,
					is_overdue_more_than_2_months = false,
					is_disbursement_over_2_months = false,
					is_wrong_month = false,
					is_phone_over_limit = false,
					is_phone_usage_over_limit = false,
					is_wrong_budget = false,
					is_duplicate = false,
					is_anomaly_expense = false,
					status = 'CORRECTED',
					updated_at = NOW()
				WHERE id = $1
			`, existingAuditID)
		}
	}

	return err
}
