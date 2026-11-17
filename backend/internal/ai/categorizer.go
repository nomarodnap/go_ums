package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CategorizeBillRequest struct {
	DepartmentID       string  `json:"departmentId,omitempty"`
	Description        string  `json:"description,omitempty"`
	Provider           string  `json:"provider,omitempty"`
	ServiceNumber      string  `json:"serviceNumber,omitempty"`
	InvoiceNumber      string  `json:"invoiceNumber,omitempty"`
	BillingMonth       int     `json:"billingMonth,omitempty"`
	BillingYear        int     `json:"billingYear,omitempty"` // CE or BE
	Amount             float64 `json:"amount,omitempty"`
	CurrentUtilityType string  `json:"currentUtilityType,omitempty"`
	CurrentBudgetCode  string  `json:"currentBudgetCode,omitempty"`
}

type CategorizeBillResult struct {
	UtilityType          string   `json:"utilityType"`
	AccountCode          string   `json:"accountCode"`
	BudgetCode           string   `json:"budgetCode"`
	BudgetCodeName       string   `json:"budgetCodeName,omitempty"`
	BudgetFiscalYear     int      `json:"budgetFiscalYear,omitempty"`
	MatchedServiceNumber string   `json:"matchedServiceNumber,omitempty"`
	Provider             string   `json:"provider,omitempty"`
	Confidence           float64  `json:"confidence"`
	Reasoning            string   `json:"reasoning"`
	Warnings             []string `json:"warnings"`
	Model                string   `json:"model"`
}

type DeptServiceItem struct {
	ServiceNumber string `json:"serviceNumber"`
	UtilityType   string `json:"utilityType"`
	Provider      string `json:"provider"`
	LocationType  string `json:"locationType,omitempty"`
}

type BudgetCodeItem struct {
	Code         string `json:"code"`
	Name         string `json:"name"`
	FiscalYearBE int    `json:"fiscalYear"`
	Description  string `json:"description,omitempty"`
	IsActive     bool   `json:"isActive"`
}

type CategorizerService struct {
	client *Client
	pool   *pgxpool.Pool
	now    func() time.Time
}

func NewCategorizerService(client *Client, pool *pgxpool.Pool) *CategorizerService {
	return &CategorizerService{
		client: client,
		pool:   pool,
		now:    time.Now,
	}
}

func (s *CategorizerService) IsConfigured() bool {
	return s != nil && s.client != nil && s.client.IsConfigured()
}

func (s *CategorizerService) Model() string {
	if s == nil || s.client == nil {
		return "gemini-3.5-flash"
	}
	return s.client.Model()
}

// AccountCodeForUtility maps the 5 UMS utility types deterministically to GFMIS/DOF GL account codes.
func AccountCodeForUtility(utilityType string) string {
	switch utilityType {
	case "ค่าไฟฟ้า":
		return "5104020101"
	case "ค่าประปา&น้ำบาดาล":
		return "5104020103"
	case "ค่าโทรศัพท์":
		return "5104020105"
	case "ค่าสื่อสาร&โทรคมนาคม":
		return "5104020106"
	case "ค่าบริการไปรษณีย์":
		return "5104020107"
	default:
		return ""
	}
}

func isCanonicalUtilityType(u string) bool {
	return AccountCodeForUtility(u) != ""
}

func resolveDeptIDForWriteAction(scope UserScope, requestedDeptID string) (string, error) {
	reqDept := strings.TrimSpace(requestedDeptID)
	if !scope.IsAdmin {
		if scope.DepartmentID == "" {
			return "", ErrUnauthorizedScope
		}
		if reqDept != "" && reqDept != scope.DepartmentID {
			return "", ErrUnauthorizedScope
		}
		return scope.DepartmentID, nil
	}
	if reqDept != "" {
		return reqDept, nil
	}
	return scope.DepartmentID, nil
}

// CategorizeBill recommends/verifies utilityType, deterministic accountCode, and DB-grounded budgetCode.
func (s *CategorizerService) CategorizeBill(ctx context.Context, scope UserScope, req CategorizeBillRequest) (*CategorizeBillResult, error) {
	deptID, err := resolveDeptIDForWriteAction(scope, req.DepartmentID)
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

	now := s.now()
	billMonth := req.BillingMonth
	if billMonth < 1 || billMonth > 12 {
		billMonth = int(now.Month())
	}
	billYearCE := NormalizeBillingYearCE(req.BillingYear, now)
	matchedSvc := MatchDepartmentService(req.ServiceNumber, req.Provider, req.CurrentUtilityType, services)

	type aiCategorizePayload struct {
		UtilityType string  `json:"utilityType"`
		BudgetCode  string  `json:"budgetCode"`
		Confidence  float64 `json:"confidence"`
		Reasoning   string  `json:"reasoning"`
	}

	contextObj := map[string]any{
		"departmentName":    deptName,
		"input":             req,
		"resolvedMonth":     billMonth,
		"resolvedYearCE":    billYearCE,
		"resolvedYearBE":    billYearCE + 543,
		"fiscalYearBE":      BillFiscalYearBE(billMonth, billYearCE),
		"matchedService":    matchedSvc,
		"registeredService": services,
		"activeBudgetCodes": budgetCodes,
		"validUtilityTypes": []string{
			"ค่าไฟฟ้า",
			"ค่าประปา&น้ำบาดาล",
			"ค่าโทรศัพท์",
			"ค่าสื่อสาร&โทรคมนาคม",
			"ค่าบริการไปรษณีย์",
		},
	}
	ctxJSON, _ := json.Marshal(contextObj)

	sysPrompt := `คุณคือผู้เชี่ยวชาญการจัดหมวดหมู่บัญชีและงบประมาณ ค่าสาธารณูปโภค กรมประมง (UMS)
จงตรวจสอบข้อมูลบิลที่ได้รับ เทียบกับรหัสเครื่องวัดของหน่วยงานและรหัสงบประมาณที่เปิดใช้งานในฐานข้อมูล แล้วตอบเป็น JSON เท่านั้น:
{
  "utilityType": "ต้องเป็น 1 ใน 5 ค่าเท่านั้น: ค่าไฟฟ้า | ค่าประปา&น้ำบาดาล | ค่าโทรศัพท์ | ค่าสื่อสาร&โทรคมนาคม | ค่าบริการไปรษณีย์",
  "budgetCode": "ต้องเลือกรหัส code จาก activeBudgetCodes ในฐานข้อมูลเท่านั้น (เช่น รหัสของปีงบประมาณที่สอดคล้องกับรอบบิล)",
  "confidence": 0.95,
  "reasoning": "คำอธิบายสั้นๆ ภาษาไทย 1-2 ประโยคว่าทำไมจึงแนะนำหมวดหมู่และรหัสงบประมาณนี้"
}
หลักปีงบประมาณไทย: ต.ค. - ก.ย. (เช่น เดือน 10/2569 อยู่ในปีงบประมาณ พ.ศ. 2570; เดือน 8-9 สามารถใช้งบปีถัดไปเบิกเหลื่อมปีได้)
ห้ามสร้าง budgetCode ที่ไม่มีใน activeBudgetCodes`

	aiCtx, cancel := context.WithTimeout(ctx, 35*time.Second)
	defer cancel()

	temp := 0.1
	resp, err := s.client.GenerateContent(aiCtx, GenerateContentRequest{
		SystemInstruction: &Content{Parts: []Part{{Text: sysPrompt}}},
		Contents: []Content{{
			Role:  "user",
			Parts: []Part{{Text: "ข้อมูลสำหรับจัดหมวดหมู่:\n" + string(ctxJSON)}},
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

	parsed, err := decodeGeminiCandidate[aiCategorizePayload](resp)
	if err != nil {
		return nil, fmt.Errorf("ไม่สามารถอ่านผลจัดหมวดหมู่จาก AI: %w", err)
	}

	utilType := NormalizeUtilityType(parsed.UtilityType)
	if !isCanonicalUtilityType(utilType) && matchedSvc != nil {
		utilType = NormalizeUtilityType(matchedSvc.UtilityType)
	}
	if !isCanonicalUtilityType(utilType) && req.CurrentUtilityType != "" {
		utilType = NormalizeUtilityType(req.CurrentUtilityType)
	}

	var warnings []string
	if matchedSvc != nil && utilType != "" && matchedSvc.UtilityType != utilType {
		warnings = append(warnings, fmt.Sprintf(
			"หมายเลขเครื่องวัด %s ลงทะเบียนในระบบเป็นประเภท '%s' ซึ่งต่างจากที่วิเคราะห์ได้ ('%s')",
			matchedSvc.ServiceNumber, matchedSvc.UtilityType, utilType,
		))
	}

	selectedBudget, budgetWarnings := GroundBudgetCode(parsed.BudgetCode, budgetCodes, billMonth, billYearCE)
	warnings = append(warnings, budgetWarnings...)

	out := &CategorizeBillResult{
		UtilityType: utilType,
		AccountCode: AccountCodeForUtility(utilType),
		Confidence:  clampConfidence(parsed.Confidence),
		Reasoning:   strings.TrimSpace(parsed.Reasoning),
		Warnings:    uniqueStrings(warnings),
		Model:       s.Model(),
	}
	if matchedSvc != nil {
		out.MatchedServiceNumber = matchedSvc.ServiceNumber
		out.Provider = matchedSvc.Provider
	} else if req.Provider != "" {
		out.Provider = strings.TrimSpace(req.Provider)
	}
	if selectedBudget != nil {
		out.BudgetCode = selectedBudget.Code
		out.BudgetCodeName = selectedBudget.Name
		out.BudgetFiscalYear = selectedBudget.FiscalYearBE
	}
	if out.Warnings == nil {
		out.Warnings = []string{}
	}
	return out, nil
}

func BillFiscalYearBE(billingMonth, billingYearCE int) int {
	yearBE := billingYearCE
	if yearBE < 2400 {
		yearBE += 543
	}
	if billingMonth >= 10 {
		return yearBE + 1
	}
	return yearBE
}

func GroundBudgetCode(suggestedCode string, activeCodes []BudgetCodeItem, billingMonth, billingYearCE int) (*BudgetCodeItem, []string) {
	if len(activeCodes) == 0 {
		return nil, []string{"ไม่พบรหัสงบประมาณที่เปิดใช้งาน (active) ในฐานข้อมูล กรุณาตั้งค่ารหัสงบประมาณก่อนเบิกจ่าย"}
	}

	targetFY := BillFiscalYearBE(billingMonth, billingYearCE)
	cleanSuggested := strings.TrimSpace(suggestedCode)
	var warnings []string
	var chosen *BudgetCodeItem

	if cleanSuggested != "" {
		for i := range activeCodes {
			if strings.EqualFold(strings.TrimSpace(activeCodes[i].Code), cleanSuggested) {
				chosen = &activeCodes[i]
				break
			}
		}
		if chosen == nil {
			// Also check partial prefix containment before falling back
			for i := range activeCodes {
				c := strings.TrimSpace(activeCodes[i].Code)
				if c != "" && (strings.Contains(c, cleanSuggested) || strings.Contains(cleanSuggested, c)) {
					chosen = &activeCodes[i]
					break
				}
			}
		}
		if chosen == nil {
			warnings = append(warnings, fmt.Sprintf("AI แนะนำรหัส '%s' แต่ไม่พบในรหัสงบประมาณที่เปิดใช้งาน ระบบจึงเลือกรหัสที่สอดคล้องจากฐานข้อมูลให้แทน", cleanSuggested))
		}
	}

	if chosen == nil {
		// Exact fiscal year match first
		for i := range activeCodes {
			if activeCodes[i].FiscalYearBE == targetFY {
				chosen = &activeCodes[i]
				break
			}
		}
		// Aug/Sep carryover rule matching audit_engine.go: month 8 or 9 can use next fiscal year
		if chosen == nil && (billingMonth == 8 || billingMonth == 9) {
			for i := range activeCodes {
				if activeCodes[i].FiscalYearBE == targetFY+1 {
					chosen = &activeCodes[i]
					break
				}
			}
		}
		// Latest active budget code fallback
		if chosen == nil {
			bestIdx := 0
			for i := range activeCodes {
				if activeCodes[i].FiscalYearBE > activeCodes[bestIdx].FiscalYearBE {
					bestIdx = i
				}
			}
			chosen = &activeCodes[bestIdx]
		}
	}

	// Check fiscal year consistency per audit_engine.go rules
	if chosen != nil && chosen.FiscalYearBE != targetFY {
		if chosen.FiscalYearBE == targetFY+1 && (billingMonth == 8 || billingMonth == 9) {
			warnings = append(warnings, fmt.Sprintf(
				"รอบบิลเดือน %s พ.ศ. %d (ปีงบฯ %d) ใช้รหัสงบประมาณปี พ.ศ. %d ในกรณีเบิกจ่ายคาบเกี่ยวปีงบประมาณ (ระบบอนุญาตเฉพาะ ส.ค.–ก.ย.)",
				thaiMonthNames[billingMonth], billingYearCE+543, targetFY, chosen.FiscalYearBE,
			))
		} else {
			warnings = append(warnings, fmt.Sprintf(
				"รหัสงบประมาณ '%s' เป็นของปีงบประมาณ พ.ศ. %d ซึ่งต่างจากปีงบประมาณของรอบบิล (พ.ศ. %d) อาจติดเงื่อนไขเบิกจ่ายผิดเดือน/ผิดงบประมาณ",
				chosen.Code, chosen.FiscalYearBE, targetFY,
			))
		}
	}

	return chosen, warnings
}

func MatchDepartmentService(rawServiceNum, rawProvider, rawUtilityType string, services []DeptServiceItem) *DeptServiceItem {
	if len(services) == 0 {
		return nil
	}
	cleanNum := normalizeTokenStrict(rawServiceNum)
	normUtil := NormalizeUtilityType(rawUtilityType)

	if cleanNum != "" {
		// 1. Exact string match
		for i := range services {
			if strings.EqualFold(strings.TrimSpace(services[i].ServiceNumber), strings.TrimSpace(rawServiceNum)) {
				return &services[i]
			}
		}
		// 2. Normalized alphanumeric match (ignoring hyphens/spaces)
		for i := range services {
			if normalizeTokenStrict(services[i].ServiceNumber) == cleanNum {
				return &services[i]
			}
		}
		// 3. Containment match for long service numbers (>= 5 chars)
		if len(cleanNum) >= 5 {
			for i := range services {
				cand := normalizeTokenStrict(services[i].ServiceNumber)
				if cand != "" && (strings.Contains(cand, cleanNum) || strings.Contains(cleanNum, cand)) {
					return &services[i]
				}
			}
		}
	}

	// 4. Unique service fallback when department only has 1 active service for the provider+utilityType
	if normUtil != "" {
		var matches []*DeptServiceItem
		for i := range services {
			if NormalizeUtilityType(services[i].UtilityType) == normUtil {
				if rawProvider == "" || strings.Contains(strings.ToLower(services[i].Provider), strings.ToLower(strings.TrimSpace(rawProvider))) {
					matches = append(matches, &services[i])
				}
			}
		}
		if len(matches) == 1 && rawServiceNum == "" {
			return matches[0]
		}
	}

	return nil
}

func normalizeTokenStrict(s string) string {
	var sb strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= '0' && r <= '9') || (r >= 'a' && r <= 'z') {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func clampConfidence(c float64) float64 {
	if c <= 0 {
		return 0.75
	}
	if c > 1 {
		if c <= 100 {
			c = c / 100.0
		} else {
			c = 1
		}
	}
	return c
}

func loadCategorizationContext(ctx context.Context, pool *pgxpool.Pool, deptID string) (string, []DeptServiceItem, []BudgetCodeItem) {
	var deptName string
	if deptID != "" {
		_ = pool.QueryRow(ctx, `SELECT full_name FROM departments WHERE id = $1`, deptID).Scan(&deptName)
	}

	var services []DeptServiceItem
	if deptID != "" {
		sRows, err := pool.Query(ctx, `
			SELECT service_number, utility_type, provider, COALESCE(location_type, '')
			FROM department_services
			WHERE department_id = $1 AND COALESCE(is_active, true) = true
			ORDER BY utility_type ASC, service_number ASC
		`, deptID)
		if err == nil {
			defer sRows.Close()
			for sRows.Next() {
				var it DeptServiceItem
				if sRows.Scan(&it.ServiceNumber, &it.UtilityType, &it.Provider, &it.LocationType) == nil {
					services = append(services, it)
				}
			}
		}
	}

	var budgetCodes []BudgetCodeItem
	bRows, err := pool.Query(ctx, `
		SELECT code, name, fiscal_year, COALESCE(description, ''), is_active
		FROM budget_codes
		WHERE is_active = true
		ORDER BY fiscal_year DESC, code ASC
	`)
	if err == nil {
		defer bRows.Close()
		for bRows.Next() {
			var bc BudgetCodeItem
			if bRows.Scan(&bc.Code, &bc.Name, &bc.FiscalYearBE, &bc.Description, &bc.IsActive) == nil {
				if bc.FiscalYearBE < 2400 {
					bc.FiscalYearBE += 543
				}
				budgetCodes = append(budgetCodes, bc)
			}
		}
	}

	return deptName, services, budgetCodes
}

