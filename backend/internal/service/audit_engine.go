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

type StatisticalAnomalyResult struct {
	IsAnomaly           bool    `json:"isAnomaly"`
	Method              string  `json:"method"` // ZSCORE_IQR, ZSCORE, IQR, FLAT_30_PCT, FALLBACK_30_PCT, NONE
	SampleCount         int     `json:"sampleCount"`
	CurrentAmount       float64 `json:"currentAmount"`
	Mean                float64 `json:"mean"`
	StdDev              float64 `json:"stdDev"`
	Median              float64 `json:"median"`
	Q1                  float64 `json:"q1"`
	Q3                  float64 `json:"q3"`
	IQR                 float64 `json:"iqr"`
	LowerFence          float64 `json:"lowerFence"`
	UpperFence          float64 `json:"upperFence"`
	ZScore              float64 `json:"zScore"`
	PctDiffFromBaseline float64 `json:"pctDiffFromBaseline"`
}

type BillHistoricalSample struct {
	BillID        string  `json:"billId"`
	BillCode      *string `json:"billCode,omitempty"`
	BillingMonth  int     `json:"billingMonth"`
	BillingYear   int     `json:"billingYear"`
	ServiceNumber *string `json:"serviceNumber,omitempty"`
	Amount        float64 `json:"amount"`
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
	HistoricalAmounts       []float64
	HasDuplicateBill        bool
}

func percentileSorted(sorted []float64, p float64) float64 {
	n := len(sorted)
	if n == 0 {
		return 0
	}
	if n == 1 {
		return sorted[0]
	}
	pos := p * float64(n-1)
	lo := int(math.Floor(pos))
	hi := int(math.Ceil(pos))
	if lo == hi {
		return sorted[lo]
	}
	frac := pos - float64(lo)
	return sorted[lo] + frac*(sorted[hi]-sorted[lo])
}

// DetectStatisticalAnomaly evaluates whether current expense is anomalous against historical bills.
// Hybrid strategy:
// - When >= 4 valid historical periods exist: uses sample Z-score (|z| >= 2.0) and IQR fences ([Q1 - 1.5*IQR, Q3 + 1.5*IQR]),
//   guarded by practical deviation (>= 15% from median/mean AND >= 50 THB) or >30% when variance is flat.
// - When 1-3 valid historical periods exist: falls back to >30% deviation from the historical mean.
func DetectStatisticalAnomaly(current float64, history []float64) StatisticalAnomalyResult {
	res := StatisticalAnomalyResult{
		Method:        "NONE",
		CurrentAmount: current,
	}
	if current <= 0 || math.IsNaN(current) || math.IsInf(current, 0) {
		return res
	}

	valid := make([]float64, 0, len(history))
	for _, v := range history {
		if v > 0 && !math.IsNaN(v) && !math.IsInf(v, 0) {
			valid = append(valid, v)
		}
	}
	n := len(valid)
	res.SampleCount = n
	if n == 0 {
		return res
	}

	var sum float64
	for _, v := range valid {
		sum += v
	}
	mean := sum / float64(n)
	res.Mean = math.Round(mean*100) / 100

	sorted := append([]float64(nil), valid...)
	sort.Float64s(sorted)
	median := percentileSorted(sorted, 0.50)
	q1 := percentileSorted(sorted, 0.25)
	q3 := percentileSorted(sorted, 0.75)
	iqr := q3 - q1

	res.Median = math.Round(median*100) / 100
	res.Q1 = math.Round(q1*100) / 100
	res.Q3 = math.Round(q3*100) / 100
	res.IQR = math.Round(iqr*100) / 100
	res.LowerFence = math.Round(math.Max(0, q1-1.5*iqr)*100) / 100
	res.UpperFence = math.Round((q3+1.5*iqr)*100) / 100

	var stdDev float64
	if n >= 2 {
		var sqSum float64
		for _, v := range valid {
			d := v - mean
			sqSum += d * d
		}
		stdDev = math.Sqrt(sqSum / float64(n-1))
		res.StdDev = math.Round(stdDev*100) / 100
		if stdDev > 1e-6 {
			res.ZScore = math.Round(((current-mean)/stdDev)*100) / 100
		}
	}

	baseline := median
	if baseline <= 0 {
		baseline = mean
	}
	absDiff := math.Abs(current - baseline)
	var pctFromBaseline float64
	if baseline > 0 {
		pctFromBaseline = (current - baseline) / baseline
		res.PctDiffFromBaseline = math.Round(pctFromBaseline*1000) / 10 // percentage points e.g. 32.5
	}

	// Sparse history fallback (< 4 prior periods): compare vs historical mean with >30% rule
	if n < 4 {
		pctFromMean := math.Abs(current-mean) / mean
		if mean > 0 {
			res.PctDiffFromBaseline = math.Round(((current-mean)/mean)*1000) / 10
		}
		if pctFromMean > 0.30 {
			res.IsAnomaly = true
			res.Method = "FALLBACK_30_PCT"
		}
		return res
	}

	// Statistical model (n >= 4): require practical significance guard to avoid tiny-variance false positives
	pctAbs := math.Abs(pctFromBaseline)
	if stdDev <= 1e-6 && iqr <= 1e-6 {
		if mean > 0 && math.Abs(current-mean)/mean > 0.30 {
			res.IsAnomaly = true
			res.Method = "FLAT_30_PCT"
		}
		return res
	}

	if absDiff < 50.0 || pctAbs < 0.15 {
		return res
	}

	rawZ := 0.0
	if stdDev > 1e-6 {
		rawZ = math.Abs((current - mean) / stdDev)
	}
	zHit := stdDev > 1e-6 && rawZ >= 2.0
	iqrHit := iqr > 1e-6 && (current > q3+1.5*iqr || current < q1-1.5*iqr)

	switch {
	case zHit && iqrHit:
		res.IsAnomaly = true
		res.Method = "ZSCORE_IQR"
	case zHit:
		res.IsAnomaly = true
		res.Method = "ZSCORE"
	case iqrHit:
		res.IsAnomaly = true
		res.Method = "IQR"
	}

	return res
}

func splitServiceNumberTokens(raw *string) []string {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil
	}
	parts := strings.Split(*raw, ",")
	tokens := make([]string, 0, len(parts))
	for _, s := range parts {
		if t := strings.TrimSpace(s); t != "" {
			tokens = append(tokens, t)
		}
	}
	return tokens
}

func hasOverlappingServiceToken(candidate *string, targetTokens []string) bool {
	if len(targetTokens) == 0 {
		return true
	}
	candTokens := splitServiceNumberTokens(candidate)
	for _, ct := range candTokens {
		for _, tt := range targetTokens {
			if strings.EqualFold(ct, tt) {
				return true
			}
		}
	}
	return false
}

// ComputeBillStatisticalAnomaly fetches up to 12 prior historical bills for the same department,
// utility type, and overlapping service number and computes Z-score/IQR/fallback anomaly statistics.
func ComputeBillStatisticalAnomaly(ctx context.Context, pool *pgxpool.Pool, billID string) (StatisticalAnomalyResult, []BillHistoricalSample, error) {
	var (
		deptID        string
		utilType      string
		billingMonth  int
		billingYear   int
		serviceNumber *string
		invoiceAmount *float64
		paidAmount    *float64
	)
	err := pool.QueryRow(ctx, `
		SELECT department_id, utility_type, billing_month, billing_year, service_number, invoice_amount, paid_amount
		FROM utility_bills
		WHERE id = $1
	`, billID).Scan(&deptID, &utilType, &billingMonth, &billingYear, &serviceNumber, &invoiceAmount, &paidAmount)
	if err != nil {
		return StatisticalAnomalyResult{Method: "NONE"}, nil, err
	}

	currentAmt := 0.0
	if invoiceAmount != nil && *invoiceAmount > 0 {
		currentAmt = *invoiceAmount
	} else if paidAmount != nil && *paidAmount > 0 {
		currentAmt = *paidAmount
	}

	return computeStatisticalAnomalyForBill(ctx, pool, billID, deptID, utilType, billingMonth, billingYear, serviceNumber, currentAmt)
}

func computeStatisticalAnomalyForBill(
	ctx context.Context,
	pool *pgxpool.Pool,
	billID, deptID, utilType string,
	billingMonth, billingYear int,
	serviceNumber *string,
	currentBillAmount float64,
) (StatisticalAnomalyResult, []BillHistoricalSample, error) {
	if pool == nil || currentBillAmount <= 0 || billingMonth <= 0 || billingYear <= 0 {
		return StatisticalAnomalyResult{Method: "NONE", CurrentAmount: currentBillAmount}, nil, nil
	}

	yearCE := billingYear
	if yearCE > 2400 {
		yearCE -= 543
	}
	currentYM := yearCE*12 + billingMonth

	rows, err := pool.Query(ctx, `
		SELECT id, bill_code, billing_month, billing_year, service_number, invoice_amount, paid_amount
		FROM utility_bills
		WHERE department_id = $1
		  AND utility_type = $2
		  AND id <> $3
		  AND (CASE WHEN billing_year > 2400 THEN billing_year - 543 ELSE billing_year END) * 12 + billing_month < $4
		ORDER BY (CASE WHEN billing_year > 2400 THEN billing_year - 543 ELSE billing_year END) DESC,
		         billing_month DESC,
		         created_at DESC
		LIMIT 36
	`, deptID, utilType, billID, currentYM)
	if err != nil {
		return StatisticalAnomalyResult{Method: "NONE", CurrentAmount: currentBillAmount}, nil, err
	}
	defer rows.Close()

	targetTokens := splitServiceNumberTokens(serviceNumber)
	samples := make([]BillHistoricalSample, 0, 12)
	historyAmounts := make([]float64, 0, 12)

	for rows.Next() {
		var (
			id, billCode, srvNum *string
			m, y                 int
			invAmt, pAmt         *float64
		)
		if scanErr := rows.Scan(&id, &billCode, &m, &y, &srvNum, &invAmt, &pAmt); scanErr != nil {
			continue
		}
		if len(targetTokens) > 0 && !hasOverlappingServiceToken(srvNum, targetTokens) {
			continue
		}
		amt := 0.0
		if invAmt != nil && *invAmt > 0 {
			amt = *invAmt
		} else if pAmt != nil && *pAmt > 0 {
			amt = *pAmt
		}
		if amt <= 0 {
			continue
		}

		sampleID := ""
		if id != nil {
			sampleID = *id
		}
		samples = append(samples, BillHistoricalSample{
			BillID:        sampleID,
			BillCode:      billCode,
			BillingMonth:  m,
			BillingYear:   y,
			ServiceNumber: srvNum,
			Amount:        amt,
		})
		historyAmounts = append(historyAmounts, amt)
		if len(historyAmounts) >= 12 {
			break
		}
	}

	res := DetectStatisticalAnomaly(currentBillAmount, historyAmounts)
	return res, samples, nil
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

	// 8. Expense Anomaly: Hybrid Statistical Z-score/IQR when history >= 4, else fallback > 30%
	if len(input.HistoricalAmounts) > 0 {
		if stat := DetectStatisticalAnomaly(input.InvoiceAmount, input.HistoricalAmounts); stat.IsAnomaly {
			flags.IsAnomalyExpense = true
		}
	} else if input.HistoricalAvgAmount > 0 {
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

	// 8. ค่าใช้จ่ายสูง/ต่ำผิดปกติ (Hybrid: ใช้ Z-score / IQR เมื่อมีย้อนหลัง >= 4 รอบบิล และ fallback > 30% เมื่อข้อมูลน้อย)
	currentBillAmount := 0.0
	if b.invoiceAmount != nil && *b.invoiceAmount > 0 {
		currentBillAmount = *b.invoiceAmount
	} else if b.paidAmount != nil && *b.paidAmount > 0 {
		currentBillAmount = *b.paidAmount
	}

	if currentBillAmount > 0 && b.billingMonth > 0 && b.billingYear > 0 {
		if stat, _, statErr := computeStatisticalAnomalyForBill(
			ctx, pool, b.id, b.departmentID, b.utilityType,
			b.billingMonth, b.billingYear, b.serviceNumber, currentBillAmount,
		); statErr == nil && stat.IsAnomaly {
			isAnomalyExpense = true
		}
	}

	// Check if audit record already exists
	var existingAuditID string
	var isManualAnomaly bool
	var manualAnomalyReason *string
	var existingStatus string

	err = pool.QueryRow(ctx, `
		SELECT id, is_manual_anomaly, manual_anomaly_reason, status
		FROM audits
		WHERE utility_bill_id = $1
		LIMIT 1
	`, b.id).Scan(&existingAuditID, &isManualAnomaly, &manualAnomalyReason, &existingStatus)
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
			targetStatus := "PENDING_CORRECTION"
			if existingStatus == "PENDING_RECHECK" {
				targetStatus = "PENDING_RECHECK"
			}
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
					status = $11,
					updated_at = NOW()
				WHERE id = $12
			`, isLateReceive, isLatePayment, isOverdueMoreThan2Months, isDisbursementOver2Months,
				isWrongMonth, isPhoneOverLimit, isPhoneUsageOverLimit, isWrongBudget,
				isDuplicate, isAnomalyExpense, targetStatus, existingAuditID)
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
