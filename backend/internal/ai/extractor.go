package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const MaxDocumentBytes = 15 << 20 // 15 MB

var (
	ErrInvalidDocument  = errors.New("ไฟล์เอกสารไม่ถูกต้องหรือชนิดไฟล์ไม่ได้รับอนุญาต (รองรับเฉพาะ PDF, PNG, JPEG, WebP)")
	ErrDocumentTooLarge = errors.New("ไฟล์เอกสารมีขนาดเกิน 15 MB")
)

type ExtractDocumentResult struct {
	UtilityType          string   `json:"utilityType"`
	AccountCode          string   `json:"accountCode"`
	Provider             string   `json:"provider,omitempty"`
	ServiceNumber        string   `json:"serviceNumber,omitempty"`
	MatchedServiceNumber string   `json:"matchedServiceNumber,omitempty"`
	InvoiceNumber        string   `json:"invoiceNumber,omitempty"`
	InvoiceDate          string   `json:"invoiceDate,omitempty"`    // YYYY-MM-DD (Gregorian CE)
	InvoiceDateRaw       string   `json:"invoiceDateRaw,omitempty"` // Original OCR date text
	BillingMonth         int      `json:"billingMonth,omitempty"`
	BillingYearCE        int      `json:"billingYearCE,omitempty"`
	BillingYearBE        int      `json:"billingYearBE,omitempty"`
	BillingMonthStr      string   `json:"billingMonthStr,omitempty"` // YYYY-MM (Gregorian CE for MonthPickerBE)
	UsageAmount          *float64 `json:"usageAmount,omitempty"`
	InvoiceAmount        *float64 `json:"invoiceAmount,omitempty"`
	BudgetCode           string   `json:"budgetCode,omitempty"`
	BudgetCodeName       string   `json:"budgetCodeName,omitempty"`
	BudgetFiscalYear     int      `json:"budgetFiscalYear,omitempty"`
	Confidence           float64  `json:"confidence"`
	Notes                string   `json:"notes,omitempty"`
	Warnings             []string `json:"warnings"`
	Model                string   `json:"model"`
}

type ExtractorService struct {
	client *Client
	pool   *pgxpool.Pool
	now    func() time.Time
}

func NewExtractorService(client *Client, pool *pgxpool.Pool) *ExtractorService {
	return &ExtractorService{
		client: client,
		pool:   pool,
		now:    time.Now,
	}
}

func (s *ExtractorService) IsConfigured() bool {
	return s != nil && s.client != nil && s.client.IsConfigured()
}

func (s *ExtractorService) Model() string {
	if s == nil || s.client == nil {
		return "gemini-3.5-flash"
	}
	return s.client.Model()
}

func detectAllowedDocumentMIME(filename, declaredType string, data []byte) (string, error) {
	if len(data) == 0 {
		return "", fmt.Errorf("%w: ไม่พบข้อมูลไฟล์เอกสาร", ErrInvalidDocument)
	}
	if len(data) > MaxDocumentBytes {
		return "", ErrDocumentTooLarge
	}

	if bytes.HasPrefix(data, []byte("%PDF")) {
		return "application/pdf", nil
	}

	sniffed := strings.ToLower(strings.TrimSpace(strings.Split(http.DetectContentType(data), ";")[0]))
	switch sniffed {
	case "application/pdf", "image/png", "image/jpeg", "image/webp":
		return sniffed, nil
	}

	// WEBP check for older RIFF detection edge cases
	if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "image/webp", nil
	}

	// Only honor declared MIME if content wasn't clearly identified as incompatible executable/text
	decl := strings.ToLower(strings.TrimSpace(strings.Split(declaredType, ";")[0]))
	ext := strings.ToLower(filepath.Ext(filename))
	if sniffed == "application/octet-stream" {
		switch decl {
		case "application/pdf", "image/png", "image/jpeg", "image/webp":
			return decl, nil
		}
		switch ext {
		case ".pdf":
			return "application/pdf", nil
		case ".png":
			return "image/png", nil
		case ".jpg", ".jpeg":
			return "image/jpeg", nil
		case ".webp":
			return "image/webp", nil
		}
	}

	return "", fmt.Errorf("%w (ตรวจพบ: %s)", ErrInvalidDocument, sniffed)
}

func (s *ExtractorService) ExtractBillDocument(
	ctx context.Context,
	scope UserScope,
	requestedDeptID string,
	filename string,
	contentType string,
	fileBytes []byte,
) (*ExtractDocumentResult, error) {
	deptID, err := resolveDeptIDForWriteAction(scope, requestedDeptID)
	if err != nil {
		return nil, err
	}
	mimeType, err := detectAllowedDocumentMIME(filename, contentType, fileBytes)
	if err != nil {
		return nil, err
	}
	if !s.IsConfigured() {
		return nil, ErrAIConfigMissing
	}

	var (
		deptName    string
		services    []DeptServiceItem
		budgetCodes []BudgetCodeItem
	)
	if s.pool != nil {
		deptName, services, budgetCodes = loadCategorizationContext(ctx, s.pool, deptID)
	}

	ctxPayload, _ := json.Marshal(map[string]any{
		"departmentName":     deptName,
		"registeredServices": services,
		"activeBudgetCodes":  budgetCodes,
		"validUtilityTypes": []string{
			"ค่าไฟฟ้า",
			"ค่าประปา&น้ำบาดาล",
			"ค่าโทรศัพท์",
			"ค่าสื่อสาร&โทรคมนาคม",
			"ค่าบริการไปรษณีย์",
		},
	})

	sysPrompt := `คุณคือระบบอ่านเอกสารใบแจ้งหนี้ค่าสาธารณูปโภคไทยอัจฉริยะ (Multimodal OCR) สำหรับกรมประมง (UMS)
จงอ่านภาพหรือ PDF ใบแจ้งหนี้ที่แนบมา แล้วสกัดข้อมูลสำคัญออกมาเป็น JSON เท่านั้น:
{
  "utilityType": "ต้องเลือก 1 ใน 5 ค่า: ค่าไฟฟ้า | ค่าประปา&น้ำบาดาล | ค่าโทรศัพท์ | ค่าสื่อสาร&โทรคมนาคม | ค่าบริการไปรษณีย์",
  "provider": "ชื่อผู้ให้บริการ เช่น กฟภ., กฟน., กปภ., กปน., NT, AIS, True, ไปรษณีย์ไทย",
  "serviceNumber": "หมายเลขผู้ใช้ไฟฟ้า / เลขที่ผู้ใช้น้ำ / หมายเลขโทรศัพท์ / รหัสลูกค้าหรือวงจร ที่ปรากฏบนบิล",
  "invoiceNumber": "เลขที่ใบแจ้งหนี้ / Invoice No.",
  "invoiceDate": "วันที่ออกใบแจ้งหนี้ในรูปแบบ YYYY-MM-DD (ค.ศ.) หรือข้อความวันที่ตามบิลหากไม่แน่ใจ",
  "billingMonth": 10,
  "billingYear": 2569,
  "usageAmount": 1250.5,
  "invoiceAmount": 4520.75,
  "suggestedBudgetCode": "รหัสงบประมาณจาก activeBudgetCodes ที่เหมาะกับรอบบิล",
  "confidence": 0.92,
  "notes": "สรุปสิ่งที่อ่านได้สั้นๆ เช่น ชื่อสถานที่หรือเลขอ้างอิงเพิ่มเติม"
}
ข้อควรระวัง:
- หากวันที่ในใบแจ้งหนี้เป็น พ.ศ. เช่น 15/10/2569 หรือ 15 ต.ค. 69 ให้แปลงเป็น ค.ศ. YYYY-MM-DD (เช่น 2026-10-15) หรือส่งข้อความดิบมาให้ระบบแปลงต่อ
- usageAmount และ invoiceAmount ต้องเป็นตัวเลขทศนิยมเท่านั้น (ห้ามใส่เครื่องหมายจุลภาคหรือคำว่า บาท/หน่วย); หากไม่มีข้อมูลให้ใส่ null
- ห้ามเดาตัวเลขที่อ่านไม่ได้ ให้ใส่ค่าว่างหรือ null แทน`

	aiCtx, cancel := context.WithTimeout(ctx, 55*time.Second)
	defer cancel()

	temp := 0.1
	encoded := base64.StdEncoding.EncodeToString(fileBytes)
	resp, err := s.client.GenerateContent(aiCtx, GenerateContentRequest{
		SystemInstruction: &Content{Parts: []Part{{Text: sysPrompt}}},
		Contents: []Content{{
			Role: "user",
			Parts: []Part{
				{
					InlineData: &Blob{
						MIMEType: mimeType,
						Data:     encoded,
					},
				},
				{
					Text: fmt.Sprintf("บริบทของหน่วยงานในฐานข้อมูล (%s):\n%s\nกรุณาอ่านข้อมูลจากเอกสารใบแจ้งหนี้ที่แนบมานี้", filename, string(ctxPayload)),
				},
			},
		}},
		GenerationConfig: &GenerationConfig{
			Temperature:      &temp,
			MaxOutputTokens:  4096,
			ResponseMIMEType: "application/json",
		},
	})
	if err != nil {
		return nil, err
	}

	type rawOCRPayload struct {
		UtilityType         string   `json:"utilityType"`
		Provider            string   `json:"provider"`
		ServiceNumber       string   `json:"serviceNumber"`
		InvoiceNumber       string   `json:"invoiceNumber"`
		InvoiceDate         string   `json:"invoiceDate"`
		BillingMonth        int      `json:"billingMonth"`
		BillingYear         int      `json:"billingYear"`
		UsageAmount         *float64 `json:"usageAmount"`
		InvoiceAmount       *float64 `json:"invoiceAmount"`
		SuggestedBudgetCode string   `json:"suggestedBudgetCode"`
		Confidence          float64  `json:"confidence"`
		Notes               string   `json:"notes"`
	}

	parsed, err := decodeGeminiCandidate[rawOCRPayload](resp)
	if err != nil {
		return nil, fmt.Errorf("ไม่สามารถอ่านข้อมูลจากเอกสารด้วย AI: %w", err)
	}

	var warnings []string

	rawDate := strings.TrimSpace(parsed.InvoiceDate)
	normDate, dateWarn := NormalizeThaiInvoiceDate(rawDate)
	if dateWarn != "" {
		warnings = append(warnings, dateWarn)
	}

	billMonth := parsed.BillingMonth
	billYearCE := 0
	if parsed.BillingYear > 0 {
		billYearCE = normalizeAnyYearToCE(parsed.BillingYear)
	}
	// Fallback: derive billingMonth/Year from normalized invoiceDate if omitted on bill
	if (billMonth < 1 || billMonth > 12 || billYearCE == 0) && len(normDate) == 10 {
		if t, tErr := time.Parse("2006-01-02", normDate); tErr == nil {
			if billMonth < 1 || billMonth > 12 {
				billMonth = int(t.Month())
			}
			if billYearCE == 0 {
				billYearCE = t.Year()
			}
			warnings = append(warnings, "ไม่พบรอบบิลประจำเดือนชัดเจนในเอกสาร จึงใช้อ้างอิงตามเดือนของวันที่ใบแจ้งหนี้ กรุณาตรวจสอบอีกครั้ง")
		}
	}

	billingYearBE := 0
	billingMonthStr := ""
	if billYearCE >= 2000 && billYearCE <= 2100 && billMonth >= 1 && billMonth <= 12 {
		billingYearBE = billYearCE + 543
		billingMonthStr = fmt.Sprintf("%04d-%02d", billYearCE, billMonth)
	}

	utilType := NormalizeUtilityType(parsed.UtilityType)
	matchedSvc := MatchDepartmentService(parsed.ServiceNumber, parsed.Provider, utilType, services)

	matchedNumber := ""
	provider := strings.TrimSpace(parsed.Provider)
	if matchedSvc != nil {
		matchedNumber = matchedSvc.ServiceNumber
		if matchedSvc.Provider != "" && provider == "" {
			provider = matchedSvc.Provider
		}
		if canonical := NormalizeUtilityType(matchedSvc.UtilityType); isCanonicalUtilityType(canonical) {
			if utilType != "" && utilType != canonical {
				warnings = append(warnings, fmt.Sprintf("ปรับประเภทสาธารณูปโภคเป็น '%s' ตามทะเบียนหมายเลข %s ของหน่วยงาน", canonical, matchedNumber))
			}
			utilType = canonical
		}
	} else if strings.TrimSpace(parsed.ServiceNumber) != "" && len(services) > 0 {
		warnings = append(warnings, fmt.Sprintf(
			"ไม่พบหมายเลข '%s' ในทะเบียนเครื่องวัดของหน่วยงาน กรุณาเลือกหมายเลขผู้ใช้/เครื่องวัดด้วยตนเอง",
			strings.TrimSpace(parsed.ServiceNumber),
		))
	}

	accountCode := AccountCodeForUtility(utilType)

	var budgetCodeName string
	var budgetFY int
	var chosenBudgetCode string
	if billMonth >= 1 && billMonth <= 12 && billYearCE > 0 {
		selectedBudget, bWarns := GroundBudgetCode(parsed.SuggestedBudgetCode, budgetCodes, billMonth, billYearCE)
		warnings = append(warnings, bWarns...)
		if selectedBudget != nil {
			chosenBudgetCode = selectedBudget.Code
			budgetCodeName = selectedBudget.Name
			budgetFY = selectedBudget.FiscalYearBE
		}
	}

	var usageAmt, invAmt *float64
	if parsed.UsageAmount != nil && *parsed.UsageAmount >= 0 {
		v := *parsed.UsageAmount
		usageAmt = &v
	}
	if parsed.InvoiceAmount != nil && *parsed.InvoiceAmount > 0 {
		v := *parsed.InvoiceAmount
		invAmt = &v
	} else if parsed.InvoiceAmount != nil && *parsed.InvoiceAmount < 0 {
		warnings = append(warnings, "ยอดเงินที่อ่านได้มีค่าติดลบ กรุณาตรวจสอบจำนวนเงินอีกครั้ง")
	}

	return &ExtractDocumentResult{
		UtilityType:          utilType,
		AccountCode:          accountCode,
		Provider:             provider,
		ServiceNumber:        strings.TrimSpace(parsed.ServiceNumber),
		MatchedServiceNumber: matchedNumber,
		InvoiceNumber:        strings.TrimSpace(parsed.InvoiceNumber),
		InvoiceDate:          normDate,
		InvoiceDateRaw:       rawDate,
		BillingMonth:         billMonth,
		BillingYearCE:        billYearCE,
		BillingYearBE:        billingYearBE,
		BillingMonthStr:      billingMonthStr,
		UsageAmount:          usageAmt,
		InvoiceAmount:        invAmt,
		BudgetCode:           chosenBudgetCode,
		BudgetCodeName:       budgetCodeName,
		BudgetFiscalYear:     budgetFY,
		Confidence:           clampConfidence(parsed.Confidence),
		Notes:                strings.TrimSpace(parsed.Notes),
		Warnings:             uniqueStrings(warnings),
		Model:                s.Model(),
	}, nil
}

func thaiDigitsToASCII(s string) string {
	replacer := strings.NewReplacer(
		"๐", "0", "๑", "1", "๒", "2", "๓", "3", "๔", "4",
		"๕", "5", "๖", "6", "๗", "7", "๘", "8", "๙", "9",
	)
	return replacer.Replace(s)
}

func normalizeAnyYearToCE(y int) int {
	switch {
	case y >= 2400 && y <= 2700:
		return y - 543
	case y >= 55 && y <= 99:
		// 2-digit Buddhist Era year e.g. 69 -> 2569 BE -> 2026 CE
		return 1957 + y
	case y >= 0 && y < 55:
		return 2000 + y
	default:
		return y
	}
}

var thaiMonthTokenMap = map[string]int{
	"มกราคม": 1, "ม.ค.": 1, "ม.ค": 1, "มค": 1,
	"กุมภาพันธ์": 2, "ก.พ.": 2, "ก.พ": 2, "กพ": 2,
	"มีนาคม": 3, "มี.ค.": 3, "มี.ค": 3, "มีค": 3,
	"เมษายน": 4, "เม.ย.": 4, "เม.ย": 4, "เมย": 4,
	"พฤษภาคม": 5, "พ.ค.": 5, "พ.ค": 5, "พค": 5,
	"มิถุนายน": 6, "มิ.ย.": 6, "มิ.ย": 6, "มิย": 6,
	"กรกฎาคม": 7, "ก.ค.": 7, "ก.ค": 7, "กค": 7,
	"สิงหาคม": 8, "ส.ค.": 8, "ส.ค": 8, "สค": 8,
	"กันยายน": 9, "ก.ย.": 9, "ก.ย": 9, "กย": 9,
	"ตุลาคม": 10, "ต.ค.": 10, "ต.ค": 10, "ตค": 10,
	"พฤศจิกายน": 11, "พ.ย.": 11, "พ.ย": 11, "พย": 11,
	"ธันวาคม": 12, "ธ.ค.": 12, "ธ.ค": 12, "ธค": 12,
}

var (
	isoDateRe   = regexp.MustCompile(`^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$`)
	dmyDateRe   = regexp.MustCompile(`^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$`)
	thaiTextRe  = regexp.MustCompile(`^(\d{1,2})\s+([^\s\d]+)\s+(\d{2,4})$`)
)

// NormalizeThaiInvoiceDate normalizes Thai/CE invoice date strings into Gregorian "YYYY-MM-DD" for DatePickerBE.
func NormalizeThaiInvoiceDate(raw string) (string, string) {
	clean := strings.TrimSpace(thaiDigitsToASCII(raw))
	if clean == "" {
		return "", ""
	}
	// Strip trailing time portion if ISO timestamp e.g. 2026-10-15T00:00:00Z
	if idx := strings.IndexByte(clean, 'T'); idx > 0 {
		clean = clean[:idx]
	}

	var day, month, yearCE int
	matched := false

	if m := isoDateRe.FindStringSubmatch(clean); len(m) == 4 {
		y, _ := strconv.Atoi(m[1])
		mo, _ := strconv.Atoi(m[2])
		d, _ := strconv.Atoi(m[3])
		yearCE, month, day = normalizeAnyYearToCE(y), mo, d
		matched = true
	} else if m := dmyDateRe.FindStringSubmatch(clean); len(m) == 4 {
		d, _ := strconv.Atoi(m[1])
		mo, _ := strconv.Atoi(m[2])
		y, _ := strconv.Atoi(m[3])
		yearCE, month, day = normalizeAnyYearToCE(y), mo, d
		matched = true
	} else {
		collapsed := strings.Join(strings.Fields(clean), " ")
		if m := thaiTextRe.FindStringSubmatch(collapsed); len(m) == 4 {
			d, _ := strconv.Atoi(m[1])
			mo, ok := thaiMonthTokenMap[m[2]]
			y, _ := strconv.Atoi(m[3])
			if ok {
				yearCE, month, day = normalizeAnyYearToCE(y), mo, d
				matched = true
			}
		}
	}

	if !matched || month < 1 || month > 12 || day < 1 || day > 31 || yearCE < 2010 || yearCE > 2060 {
		return "", fmt.Sprintf("ไม่สามารถแปลงวันที่ใบแจ้งหนี้ '%s' เป็นรูปแบบ ค.ศ. ได้อัตโนมัติ กรุณาตรวจสอบและเลือกวันที่เอง", raw)
	}

	dt := time.Date(yearCE, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	if dt.Year() != yearCE || int(dt.Month()) != month || dt.Day() != day {
		return "", fmt.Sprintf("วันที่ใบแจ้งหนี้ '%s' ไม่ถูกต้องตามปฏิทิน กรุณาเลือกวันที่ใหม่", raw)
	}

	return dt.Format("2006-01-02"), ""
}

