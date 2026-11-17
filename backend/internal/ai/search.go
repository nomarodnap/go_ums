package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidInput = errors.New("ข้อมูลคำขอไม่ถูกต้อง")
)

const (
	defaultSearchLimit  = 15
	maxSearchLimit      = 50
	maxInlineEmbedItems = 40
	embedConcurrency    = 8
)

type SearchRequest struct {
	Query      string `json:"query"`
	EntityType string `json:"entityType,omitempty"` // "all", "bills", "departments"
	Limit      int    `json:"limit,omitempty"`
}

type BillSearchHit struct {
	ID             string   `json:"id"`
	BillCode       string   `json:"billCode,omitempty"`
	DepartmentID   string   `json:"departmentId"`
	DepartmentName string   `json:"departmentName"`
	Province       string   `json:"province,omitempty"`
	Region         string   `json:"region,omitempty"`
	UtilityType    string   `json:"utilityType"`
	BillingMonth   int      `json:"billingMonth"`
	BillingYearCE  int      `json:"billingYearCE"`
	BillingYearBE  int      `json:"billingYearBE"`
	ServiceNumber  string   `json:"serviceNumber,omitempty"`
	InvoiceNumber  string   `json:"invoiceNumber,omitempty"`
	InvoiceAmount  float64  `json:"invoiceAmount"`
	PaymentStatus  string   `json:"paymentStatus"`
	InvoiceStatus  string   `json:"invoiceStatus"`
	HasAnomaly     bool     `json:"hasAnomaly"`
	Score          float64  `json:"score"`
	SemanticScore  float64  `json:"semanticScore"`
	KeywordScore   float64  `json:"keywordScore"`
	MatchReasons   []string `json:"matchReasons"`
}

type DepartmentSearchHit struct {
	ID            string   `json:"id"`
	FullName      string   `json:"fullName"`
	ShortName     string   `json:"shortName,omitempty"`
	Province      string   `json:"province,omitempty"`
	Region        string   `json:"region,omitempty"`
	Type          string   `json:"type,omitempty"`
	CostCenter    string   `json:"costCenterCode,omitempty"`
	Score         float64  `json:"score"`
	SemanticScore float64  `json:"semanticScore"`
	KeywordScore  float64  `json:"keywordScore"`
	MatchReasons  []string `json:"matchReasons"`
}

type SearchResponse struct {
	Query        string                `json:"query"`
	Mode         string                `json:"mode"` // "hybrid" or "keyword_fallback"
	Warning      string                `json:"warning,omitempty"`
	Model        string                `json:"model"`
	Bills        []BillSearchHit       `json:"bills"`
	Departments  []DepartmentSearchHit `json:"departments"`
	IndexedCount int                   `json:"indexedCount"`
	TotalScanned int                   `json:"totalScanned"`
	TookMs       int64                 `json:"tookMs"`
}

type SyncEmbeddingsResult struct {
	IndexedBills       int    `json:"indexedBills"`
	IndexedDepartments int    `json:"indexedDepartments"`
	SkippedUnchanged   int    `json:"skippedUnchanged"`
	Failed             int    `json:"failed"`
	Model              string `json:"model"`
	DurationMs         int64  `json:"durationMs"`
}

type BillIndexRecord struct {
	ID             string
	BillCode       string
	DepartmentID   string
	DepositUnitID  string
	DepartmentName string
	ShortName      string
	Province       string
	Location       string
	UtilityType    string
	BillingMonth   int
	BillingYearCE  int
	Provider       string
	ServiceNumber  string
	InvoiceNumber  string
	InvoiceAmount  float64
	PaidAmount     float64
	PaymentStatus  string
	InvoiceStatus  string
	BudgetCode     string
	HasAnomaly     bool
}

type DeptIndexRecord struct {
	ID                string
	FullName          string
	ShortName         string
	Division          string
	Province          string
	Location          string
	Type              string
	CostCenterCode    string
	ResponsiblePerson string
}

type SearchIntent struct {
	UtilityType   string
	PaymentStatus string
	InvoiceStatus string
	HasAnomaly    bool
	Region        string
	Month         int
	YearCE        int
	NumericTokens []string
	RawTokens     []string
}

type SearchService struct {
	client      *Client
	pool        *pgxpool.Pool
	schemaMu    sync.Mutex
	schemaReady bool
	now         func() time.Time
}

func NewSearchService(client *Client, pool *pgxpool.Pool) *SearchService {
	return &SearchService{
		client: client,
		pool:   pool,
		now:    time.Now,
	}
}

func (s *SearchService) ensureSchema(ctx context.Context) error {
	if s == nil || s.pool == nil {
		return nil
	}
	s.schemaMu.Lock()
	defer s.schemaMu.Unlock()
	if s.schemaReady {
		return nil
	}
	ddlCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	_, err := s.pool.Exec(ddlCtx, `
		CREATE TABLE IF NOT EXISTS ai_embeddings (
			id TEXT PRIMARY KEY,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			department_id TEXT,
			search_text TEXT NOT NULL,
			content_hash TEXT NOT NULL,
			embedding DOUBLE PRECISION[] NOT NULL,
			model TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (entity_type, entity_id)
		);
		CREATE INDEX IF NOT EXISTS ai_embeddings_entity_idx ON ai_embeddings (entity_type, entity_id);
		CREATE INDEX IF NOT EXISTS ai_embeddings_dept_idx ON ai_embeddings (department_id);
	`)
	if err == nil {
		s.schemaReady = true
	}
	return err
}

// Thailand 77-province -> region lookup so queries like "ภาคใต้" or "อีสาน" match provincial departments accurately.
var provinceRegions = map[string]string{
	// ภาคใต้
	"กระบี่": "ภาคใต้", "ชุมพร": "ภาคใต้", "ตรัง": "ภาคใต้", "นครศรีธรรมราช": "ภาคใต้",
	"นราธิวาส": "ภาคใต้", "ปัตตานี": "ภาคใต้", "พังงา": "ภาคใต้", "พัทลุง": "ภาคใต้",
	"ภูเก็ต": "ภาคใต้", "ยะลา": "ภาคใต้", "ระนอง": "ภาคใต้", "สงขลา": "ภาคใต้",
	"สตูล": "ภาคใต้", "สุราษฎร์ธานี": "ภาคใต้",
	// ภาคเหนือ
	"เชียงราย": "ภาคเหนือ", "เชียงใหม่": "ภาคเหนือ", "น่าน": "ภาคเหนือ", "พะเยา": "ภาคเหนือ",
	"แพร่": "ภาคเหนือ", "แม่ฮ่องสอน": "ภาคเหนือ", "ลำปาง": "ภาคเหนือ", "ลำพูน": "ภาคเหนือ",
	"อุตรดิตถ์": "ภาคเหนือ",
	// ภาคตะวันออกเฉียงเหนือ (อีสาน)
	"กาฬสินธุ์": "ภาคตะวันออกเฉียงเหนือ", "ขอนแก่น": "ภาคตะวันออกเฉียงเหนือ", "ชัยภูมิ": "ภาคตะวันออกเฉียงเหนือ",
	"นครพนม": "ภาคตะวันออกเฉียงเหนือ", "นครราชสีมา": "ภาคตะวันออกเฉียงเหนือ", "บึงกาฬ": "ภาคตะวันออกเฉียงเหนือ",
	"บุรีรัมย์": "ภาคตะวันออกเฉียงเหนือ", "มหาสารคาม": "ภาคตะวันออกเฉียงเหนือ", "มุกดาหาร": "ภาคตะวันออกเฉียงเหนือ",
	"ยโสธร": "ภาคตะวันออกเฉียงเหนือ", "ร้อยเอ็ด": "ภาคตะวันออกเฉียงเหนือ", "เลย": "ภาคตะวันออกเฉียงเหนือ",
	"ศรีสะเกษ": "ภาคตะวันออกเฉียงเหนือ", "สกลนคร": "ภาคตะวันออกเฉียงเหนือ", "สุรินทร์": "ภาคตะวันออกเฉียงเหนือ",
	"หนองคาย": "ภาคตะวันออกเฉียงเหนือ", "หนองบัวลำภู": "ภาคตะวันออกเฉียงเหนือ", "อำนาจเจริญ": "ภาคตะวันออกเฉียงเหนือ",
	"อุดรธานี": "ภาคตะวันออกเฉียงเหนือ", "อุบลราชธานี": "ภาคตะวันออกเฉียงเหนือ",
	// ภาคตะวันออก
	"จันทบุรี": "ภาคตะวันออก", "ฉะเชิงเทรา": "ภาคตะวันออก", "ชลบุรี": "ภาคตะวันออก",
	"ตราด": "ภาคตะวันออก", "ปราจีนบุรี": "ภาคตะวันออก", "ระยอง": "ภาคตะวันออก", "สระแก้ว": "ภาคตะวันออก",
	// ภาคตะวันตก
	"กาญจนบุรี": "ภาคตะวันตก", "ตาก": "ภาคตะวันตก", "ประจวบคีรีขันธ์": "ภาคตะวันตก",
	"เพชรบุรี": "ภาคตะวันตก", "ราชบุรี": "ภาคตะวันตก",
	// ภาคกลาง
	"กรุงเทพมหานคร": "ภาคกลาง", "กทม": "ภาคกลาง", "กำแพงเพชร": "ภาคกลาง", "ชัยนาท": "ภาคกลาง",
	"นครนายก": "ภาคกลาง", "นครปฐม": "ภาคกลาง", "นครสวรรค์": "ภาคกลาง", "นนทบุรี": "ภาคกลาง",
	"ปทุมธานี": "ภาคกลาง", "พระนครศรีอยุธยา": "ภาคกลาง", "อยุธยา": "ภาคกลาง", "พิจิตร": "ภาคกลาง",
	"พิษณุโลก": "ภาคกลาง", "เพชรบูรณ์": "ภาคกลาง", "ลพบุรี": "ภาคกลาง", "สมุทรปราการ": "ภาคกลาง",
	"สมุทรสงคราม": "ภาคกลาง", "สมุทรสาคร": "ภาคกลาง", "สิงห์บุรี": "ภาคกลาง", "สุโขทัย": "ภาคกลาง",
	"สุพรรณบุรี": "ภาคกลาง", "สระบุรี": "ภาคกลาง", "อ่างทอง": "ภาคกลาง", "อุทัยธานี": "ภาคกลาง",
}

func InferProvinceAndRegion(province, location, deptName string) (resolvedProvince string, region string) {
	candidates := []string{strings.TrimSpace(province), strings.TrimSpace(location), strings.TrimSpace(deptName)}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		for prov, reg := range provinceRegions {
			if strings.Contains(c, prov) {
				if resolvedProvince == "" {
					resolvedProvince = prov
				}
				return resolvedProvince, reg
			}
		}
	}
	return strings.TrimSpace(province), ""
}

func regionAliases(region string) string {
	switch region {
	case "ภาคตะวันออกเฉียงเหนือ":
		return "ภาคตะวันออกเฉียงเหนือ ภาคอีสาน อีสาน"
	case "ภาคใต้":
		return "ภาคใต้ อันดามัน อ่าวไทย ชายแดนใต้"
	default:
		return region
	}
}

func BuildBillSearchText(b BillIndexRecord) string {
	prov, reg := InferProvinceAndRegion(b.Province, b.Location, b.DepartmentName)
	yearBE := b.BillingYearCE + 543
	mName := ""
	if b.BillingMonth >= 1 && b.BillingMonth <= 12 {
		mName = thaiMonthNames[b.BillingMonth]
	}

	payText := "ยังไม่ได้เบิกจ่าย ยังไม่ได้จ่าย ค้างชำระ ค้างจ่าย รอเบิกจ่าย PENDING"
	if strings.EqualFold(b.PaymentStatus, "PAID") {
		payText = "เบิกจ่ายแล้ว จ่ายแล้ว ชำระแล้ว PAID"
	}

	invText := "ได้รับใบแจ้งหนี้แล้ว RECEIVED"
	if strings.EqualFold(b.InvoiceStatus, "NOT_RECEIVED") {
		invText = "ยังไม่ได้รับใบแจ้งหนี้ ค้างรับบิล NOT_RECEIVED"
	}

	anomalyText := ""
	if b.HasAnomaly {
		anomalyText = "พบความผิดปกติ ความคลาดเคลื่อน ตรวจสอบ anomaly"
	}

	amt := b.InvoiceAmount
	if amt <= 0 {
		amt = b.PaidAmount
	}

	utilAlias := b.UtilityType
	switch b.UtilityType {
	case "ค่าไฟฟ้า":
		utilAlias += " ค่าไฟ ไฟฟ้า กฟภ กฟน"
	case "ค่าประปา&น้ำบาดาล":
		utilAlias += " ค่าน้ำ ประปา น้ำบาดาล กปภ กปน"
	case "ค่าโทรศัพท์":
		utilAlias += " โทรศัพท์ ค่าโทร"
	case "ค่าสื่อสาร&โทรคมนาคม":
		utilAlias += " อินเทอร์เน็ต ค่าเน็ต สื่อสาร โทรคมนาคม"
	case "ค่าบริการไปรษณีย์":
		utilAlias += " ไปรษณีย์ พัสดุ"
	}

	parts := []string{
		fmt.Sprintf("บิลค่าสาธารณูปโภค %s", b.BillCode),
		fmt.Sprintf("ประเภท: %s", utilAlias),
		fmt.Sprintf("หน่วยงาน: %s (%s)", b.DepartmentName, b.ShortName),
		fmt.Sprintf("จังหวัด: %s %s %s", prov, regionAliases(reg), b.Location),
		fmt.Sprintf("รอบบิล: เดือน%s %d %d-%02d พ.ศ.%d ค.ศ.%d", mName, yearBE, yearBE, b.BillingMonth, yearBE, b.BillingYearCE),
		fmt.Sprintf("สถานะการเบิกจ่าย: %s", payText),
		fmt.Sprintf("สถานะใบแจ้งหนี้: %s", invText),
		fmt.Sprintf("ผู้ให้บริการ: %s หมายเลข: %s เลขที่ใบแจ้งหนี้: %s รหัสงบประมาณ: %s ยอดเงิน: %.2f บาท",
			b.Provider, b.ServiceNumber, b.InvoiceNumber, b.BudgetCode, amt),
	}
	if anomalyText != "" {
		parts = append(parts, anomalyText)
	}
	return strings.TrimSpace(strings.Join(parts, " | "))
}

func BuildDepartmentSearchText(d DeptIndexRecord) string {
	prov, reg := InferProvinceAndRegion(d.Province, d.Location, d.FullName)
	typeLabel := d.Type
	switch d.Type {
	case "central":
		typeLabel = "ส่วนกลาง central"
	case "regional_central":
		typeLabel = "ส่วนภูมิภาคประจำส่วนกลาง regional_central"
	case "regional":
		typeLabel = "ส่วนภูมิภาค regional ต่างจังหวัด"
	}
	parts := []string{
		fmt.Sprintf("หน่วยงาน: %s (%s)", d.FullName, d.ShortName),
		fmt.Sprintf("กอง/กลุ่ม: %s ประเภท: %s รหัสศูนย์ต้นทุน: %s", d.Division, typeLabel, d.CostCenterCode),
		fmt.Sprintf("จังหวัด: %s %s ที่ตั้ง: %s", prov, regionAliases(reg), d.Location),
		fmt.Sprintf("ผู้รับผิดชอบ: %s", d.ResponsiblePerson),
	}
	return strings.TrimSpace(strings.Join(parts, " | "))
}

func contentHash(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

func formatPGFloat8Array(vec []float64) string {
	if len(vec) == 0 {
		return "{}"
	}
	var sb strings.Builder
	sb.Grow(len(vec)*12 + 2)
	sb.WriteByte('{')
	for i, v := range vec {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(strconv.FormatFloat(v, 'f', 6, 64))
	}
	sb.WriteByte('}')
	return sb.String()
}

func parsePGFloat8Array(raw string) []float64 {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "{")
	trimmed = strings.TrimSuffix(trimmed, "}")
	trimmed = strings.TrimSpace(trimmed)
	if trimmed == "" {
		return nil
	}
	parts := strings.Split(trimmed, ",")
	out := make([]float64, 0, len(parts))
	for _, p := range parts {
		if v, err := strconv.ParseFloat(strings.TrimSpace(p), 64); err == nil && !math.IsNaN(v) && !math.IsInf(v, 0) {
			out = append(out, v)
		}
	}
	return out
}

func CosineSimilarity(a, b []float64) float64 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA <= 0 || normB <= 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

var numTokenRe = regexp.MustCompile(`[A-Za-z0-9\-/]{2,}`)

func ParseSearchIntent(query string) SearchIntent {
	q := strings.ToLower(strings.TrimSpace(query))
	intent := SearchIntent{}

	switch {
	case strings.Contains(q, "ไฟ"):
		intent.UtilityType = "ค่าไฟฟ้า"
	case strings.Contains(q, "ประปา") || strings.Contains(q, "น้ำ"):
		intent.UtilityType = "ค่าประปา&น้ำบาดาล"
	case strings.Contains(q, "โทรศัพท์"):
		intent.UtilityType = "ค่าโทรศัพท์"
	case strings.Contains(q, "สื่อสาร") || strings.Contains(q, "โทรคมนาคม") || strings.Contains(q, "อินเทอร์เน็ต") || strings.Contains(q, "เน็ต"):
		intent.UtilityType = "ค่าสื่อสาร&โทรคมนาคม"
	case strings.Contains(q, "ไปรษณีย์") || strings.Contains(q, "พัสดุ"):
		intent.UtilityType = "ค่าบริการไปรษณีย์"
	}

	switch {
	case strings.Contains(q, "ยังไม่ได้รับ") || strings.Contains(q, "ยังไม่รับบิล"):
		intent.InvoiceStatus = "NOT_RECEIVED"
	case strings.Contains(q, "ยังไม่ได้จ่าย") || strings.Contains(q, "ยังไม่จ่าย") ||
		strings.Contains(q, "ค้างชำระ") || strings.Contains(q, "ค้างจ่าย") ||
		strings.Contains(q, "รอเบิก") || strings.Contains(q, "ยังไม่เบิก") ||
		strings.Contains(q, "pending"):
		intent.PaymentStatus = "PENDING"
	case strings.Contains(q, "จ่ายแล้ว") || strings.Contains(q, "เบิกจ่ายแล้ว") ||
		strings.Contains(q, "ชำระแล้ว") || strings.Contains(q, "paid"):
		intent.PaymentStatus = "PAID"
	}

	if strings.Contains(q, "ผิดปกติ") || strings.Contains(q, "คลาดเคลื่อน") || strings.Contains(q, "anomaly") || strings.Contains(q, "ซ้ำ") {
		intent.HasAnomaly = true
	}

	switch {
	case strings.Contains(q, "ภาคใต้"):
		intent.Region = "ภาคใต้"
	case strings.Contains(q, "ภาคเหนือ"):
		intent.Region = "ภาคเหนือ"
	case strings.Contains(q, "ตะวันออกเฉียงเหนือ") || strings.Contains(q, "อีสาน"):
		intent.Region = "ภาคตะวันออกเฉียงเหนือ"
	case strings.Contains(q, "ภาคตะวันออก"):
		intent.Region = "ภาคตะวันออก"
	case strings.Contains(q, "ภาคตะวันตก"):
		intent.Region = "ภาคตะวันตก"
	case strings.Contains(q, "ภาคกลาง") || strings.Contains(q, "ส่วนกลาง"):
		intent.Region = "ภาคกลาง"
	}

	for m := 1; m <= 12; m++ {
		if strings.Contains(q, thaiMonthNames[m]) {
			intent.Month = m
			break
		}
	}

	for _, tok := range numTokenRe.FindAllString(q, -1) {
		if n, err := strconv.Atoi(tok); err == nil {
			if n >= 2560 && n <= 2599 {
				intent.YearCE = n - 543
				continue
			}
			if n >= 2015 && n <= 2050 {
				intent.YearCE = n
				continue
			}
		}
		intent.NumericTokens = append(intent.NumericTokens, tok)
	}

	// Whitespace tokens excluding filler
	for _, part := range strings.Fields(q) {
		if len([]rune(part)) >= 2 {
			intent.RawTokens = append(intent.RawTokens, part)
		}
	}

	return intent
}

// UpsertBillEmbedding generates (if changed) and stores the semantic embedding vector for one utility bill.
func (s *SearchService) UpsertBillEmbedding(ctx context.Context, billID string) error {
	if s == nil || s.pool == nil || s.client == nil || !s.client.IsConfigured() || strings.TrimSpace(billID) == "" {
		return nil
	}
	if err := s.ensureSchema(ctx); err != nil {
		return err
	}

	records, err := s.loadBillRecords(ctx, UserScope{IsAdmin: true}, billID)
	if err != nil || len(records) == 0 {
		return err
	}
	rec := records[0]
	searchText := BuildBillSearchText(rec)
	hash := contentHash(searchText)

	var existingHash string
	err = s.pool.QueryRow(ctx, `SELECT content_hash FROM ai_embeddings WHERE entity_type = 'bill' AND entity_id = $1`, rec.ID).Scan(&existingHash)
	if err == nil && existingHash == hash {
		return nil
	}

	vec, err := s.client.EmbedContent(ctx, searchText, "RETRIEVAL_DOCUMENT")
	if err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx, `
		INSERT INTO ai_embeddings (id, entity_type, entity_id, department_id, search_text, content_hash, embedding, model, updated_at)
		VALUES ($1, 'bill', $2, $3, $4, $5, $6::double precision[], $7, NOW())
		ON CONFLICT (entity_type, entity_id) DO UPDATE SET
			department_id = EXCLUDED.department_id,
			search_text = EXCLUDED.search_text,
			content_hash = EXCLUDED.content_hash,
			embedding = EXCLUDED.embedding,
			model = EXCLUDED.model,
			updated_at = NOW()
	`, uuid.New().String(), rec.ID, rec.DepartmentID, searchText, hash, formatPGFloat8Array(vec), DefaultEmbeddingModel)
	return err
}

func (s *SearchService) DeleteBillEmbedding(ctx context.Context, billID string) error {
	if s == nil || s.pool == nil || strings.TrimSpace(billID) == "" {
		return nil
	}
	if err := s.ensureSchema(ctx); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM ai_embeddings WHERE entity_type = 'bill' AND entity_id = $1`, billID)
	return err
}

// SyncAll indexes missing or modified departments and utility bills. Admin/central only at handler layer.
func (s *SearchService) SyncAll(ctx context.Context, force bool) (*SyncEmbeddingsResult, error) {
	if s == nil || s.client == nil || !s.client.IsConfigured() {
		return nil, ErrAIConfigMissing
	}
	if s.pool == nil {
		return &SyncEmbeddingsResult{Model: DefaultEmbeddingModel}, nil
	}
	if err := s.ensureSchema(ctx); err != nil {
		return nil, err
	}

	start := time.Now()
	allScope := UserScope{IsAdmin: true}
	bills, err := s.loadBillRecords(ctx, allScope, "")
	if err != nil {
		return nil, err
	}
	depts, err := s.loadDeptRecords(ctx, allScope)
	if err != nil {
		return nil, err
	}
	existingHashes, err := s.loadExistingHashes(ctx)
	if err != nil {
		return nil, err
	}

	type embedJob struct {
		entityType string
		entityID   string
		deptID     string
		text       string
		hash       string
	}

	var jobs []embedJob
	skipped := 0

	for _, b := range bills {
		text := BuildBillSearchText(b)
		h := contentHash(text)
		key := "bill:" + b.ID
		if !force && existingHashes[key] == h {
			skipped++
			continue
		}
		jobs = append(jobs, embedJob{
			entityType: "bill",
			entityID:   b.ID,
			deptID:     b.DepartmentID,
			text:       text,
			hash:       h,
		})
	}
	for _, d := range depts {
		text := BuildDepartmentSearchText(d)
		h := contentHash(text)
		key := "department:" + d.ID
		if !force && existingHashes[key] == h {
			skipped++
			continue
		}
		jobs = append(jobs, embedJob{
			entityType: "department",
			entityID:   d.ID,
			deptID:     d.ID,
			text:       text,
			hash:       h,
		})
	}

	var indexedBills, indexedDepts, failed int
	var mu sync.Mutex
	jobCh := make(chan embedJob, len(jobs))
	for _, j := range jobs {
		jobCh <- j
	}
	close(jobCh)

	workers := embedConcurrency
	if len(jobs) < workers {
		workers = len(jobs)
	}
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobCh {
				if ctx.Err() != nil {
					mu.Lock()
					failed++
					mu.Unlock()
					continue
				}
				vec, embedErr := s.client.EmbedContent(ctx, j.text, "RETRIEVAL_DOCUMENT")
				if embedErr != nil {
					mu.Lock()
					failed++
					mu.Unlock()
					continue
				}
				_, upErr := s.pool.Exec(ctx, `
					INSERT INTO ai_embeddings (id, entity_type, entity_id, department_id, search_text, content_hash, embedding, model, updated_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7::double precision[], $8, NOW())
					ON CONFLICT (entity_type, entity_id) DO UPDATE SET
						department_id = EXCLUDED.department_id,
						search_text = EXCLUDED.search_text,
						content_hash = EXCLUDED.content_hash,
						embedding = EXCLUDED.embedding,
						model = EXCLUDED.model,
						updated_at = NOW()
				`, uuid.New().String(), j.entityType, j.entityID, j.deptID, j.text, j.hash, formatPGFloat8Array(vec), DefaultEmbeddingModel)
				mu.Lock()
				if upErr != nil {
					failed++
				} else if j.entityType == "bill" {
					indexedBills++
				} else {
					indexedDepts++
				}
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	return &SyncEmbeddingsResult{
		IndexedBills:       indexedBills,
		IndexedDepartments: indexedDepts,
		SkippedUnchanged:   skipped,
		Failed:             failed,
		Model:              DefaultEmbeddingModel,
		DurationMs:         time.Since(start).Milliseconds(),
	}, nil
}

// Search performs hybrid semantic (Gemini embeddings) + Thai intent/keyword ranking over bills and departments.
func (s *SearchService) Search(ctx context.Context, scope UserScope, req SearchRequest) (*SearchResponse, error) {
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return nil, fmt.Errorf("%w: กรุณาระบุคำค้นหา", ErrInvalidInput)
	}
	limit := req.Limit
	if limit <= 0 {
		limit = defaultSearchLimit
	}
	if limit > maxSearchLimit {
		limit = maxSearchLimit
	}
	entityFilter := strings.ToLower(strings.TrimSpace(req.EntityType))
	if entityFilter == "" {
		entityFilter = "all"
	}

	start := time.Now()
	if s.pool == nil {
		return &SearchResponse{
			Query:       query,
			Mode:        "keyword_fallback",
			Model:       DefaultEmbeddingModel,
			Bills:       []BillSearchHit{},
			Departments: []DepartmentSearchHit{},
			TookMs:      time.Since(start).Milliseconds(),
		}, nil
	}
	if err := s.ensureSchema(ctx); err != nil {
		return nil, err
	}

	var bills []BillIndexRecord
	var depts []DeptIndexRecord
	var err error
	if entityFilter == "all" || entityFilter == "bills" {
		bills, err = s.loadBillRecords(ctx, scope, "")
		if err != nil {
			return nil, fmt.Errorf("load bills for search: %w", err)
		}
	}
	if entityFilter == "all" || entityFilter == "departments" {
		depts, err = s.loadDeptRecords(ctx, scope)
		if err != nil {
			return nil, fmt.Errorf("load departments for search: %w", err)
		}
	}

	existingVecs, err := s.loadEmbeddings(ctx)
	if err != nil {
		existingVecs = map[string]storedEmbedding{}
	}

	mode := "hybrid"
	warning := ""
	var queryVec []float64

	if s.client == nil || !s.client.IsConfigured() {
		mode = "keyword_fallback"
		warning = "ใช้โหมดค้นหาตามบริบทและคำสำคัญ (ยังไม่ได้กำหนดค่า GEMINI_API_KEY)"
	} else {
		// Backfill missing/stale embeddings cleanly with bounded concurrency and timeout
		s.backfillMissingInline(ctx, bills, depts, existingVecs)

		qCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		qVec, qErr := s.client.EmbedContent(qCtx, query, "RETRIEVAL_QUERY")
		cancel()
		if qErr != nil || len(qVec) == 0 {
			mode = "keyword_fallback"
			warning = "ระบบค้นหาความหมาย AI ไม่พร้อมใช้งานชั่วคราว แสดงผลด้วยตัวกรองอัจฉริยะและคำสำคัญ"
		} else {
			queryVec = qVec
		}
	}

	billHits, deptHits := rankSearchCandidates(query, queryVec, mode == "hybrid", bills, depts, existingVecs, limit)

	indexedCount := 0
	for _, b := range bills {
		if _, ok := existingVecs["bill:"+b.ID]; ok {
			indexedCount++
		}
	}
	for _, d := range depts {
		if _, ok := existingVecs["department:"+d.ID]; ok {
			indexedCount++
		}
	}

	return &SearchResponse{
		Query:        query,
		Mode:         mode,
		Warning:      warning,
		Model:        DefaultEmbeddingModel,
		Bills:        billHits,
		Departments:  deptHits,
		IndexedCount: indexedCount,
		TotalScanned: len(bills) + len(depts),
		TookMs:       time.Since(start).Milliseconds(),
	}, nil
}

type storedEmbedding struct {
	ContentHash string
	Vector      []float64
}

func (s *SearchService) backfillMissingInline(ctx context.Context, bills []BillIndexRecord, depts []DeptIndexRecord, cache map[string]storedEmbedding) {
	if s.client == nil || !s.client.IsConfigured() {
		return
	}
	type pendingItem struct {
		entityType string
		entityID   string
		deptID     string
		text       string
		hash       string
	}
	var missing []pendingItem

	for _, b := range bills {
		text := BuildBillSearchText(b)
		h := contentHash(text)
		key := "bill:" + b.ID
		if cur, ok := cache[key]; !ok || cur.ContentHash != h || len(cur.Vector) == 0 {
			missing = append(missing, pendingItem{"bill", b.ID, b.DepartmentID, text, h})
		}
		if len(missing) >= maxInlineEmbedItems {
			break
		}
	}
	if len(missing) < maxInlineEmbedItems {
		for _, d := range depts {
			text := BuildDepartmentSearchText(d)
			h := contentHash(text)
			key := "department:" + d.ID
			if cur, ok := cache[key]; !ok || cur.ContentHash != h || len(cur.Vector) == 0 {
				missing = append(missing, pendingItem{"department", d.ID, d.ID, text, h})
			}
			if len(missing) >= maxInlineEmbedItems {
				break
			}
		}
	}
	if len(missing) == 0 {
		return
	}

	bCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	ch := make(chan pendingItem, len(missing))
	for _, m := range missing {
		ch <- m
	}
	close(ch)

	workers := embedConcurrency
	if len(missing) < workers {
		workers = len(missing)
	}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for item := range ch {
				if bCtx.Err() != nil {
					return
				}
				vec, err := s.client.EmbedContent(bCtx, item.text, "RETRIEVAL_DOCUMENT")
				if err != nil || len(vec) == 0 {
					continue
				}
				_, _ = s.pool.Exec(bCtx, `
					INSERT INTO ai_embeddings (id, entity_type, entity_id, department_id, search_text, content_hash, embedding, model, updated_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7::double precision[], $8, NOW())
					ON CONFLICT (entity_type, entity_id) DO UPDATE SET
						department_id = EXCLUDED.department_id,
						search_text = EXCLUDED.search_text,
						content_hash = EXCLUDED.content_hash,
						embedding = EXCLUDED.embedding,
						model = EXCLUDED.model,
						updated_at = NOW()
				`, uuid.New().String(), item.entityType, item.entityID, item.deptID, item.text, item.hash, formatPGFloat8Array(vec), DefaultEmbeddingModel)

				mu.Lock()
				cache[item.entityType+":"+item.entityID] = storedEmbedding{
					ContentHash: item.hash,
					Vector:      vec,
				}
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
}

// rankSearchCandidates performs hybrid scoring in pure Go so ranking and intent rules are easy to test.
func rankSearchCandidates(
	query string,
	queryVec []float64,
	useSemantic bool,
	bills []BillIndexRecord,
	depts []DeptIndexRecord,
	vecs map[string]storedEmbedding,
	limit int,
) ([]BillSearchHit, []DepartmentSearchHit) {
	intent := ParseSearchIntent(query)
	qLower := strings.ToLower(strings.TrimSpace(query))

	billHits := make([]BillSearchHit, 0, len(bills))
	for _, b := range bills {
		prov, reg := InferProvinceAndRegion(b.Province, b.Location, b.DepartmentName)
		yearBE := b.BillingYearCE + 543
		searchText := BuildBillSearchText(b)
		kwScore, reasons, mismatchedHardFacet := scoreBillKeywordsAndIntent(qLower, intent, b, prov, reg, searchText)

		semScore := 0.0
		if useSemantic {
			if stored, ok := vecs["bill:"+b.ID]; ok && len(stored.Vector) > 0 {
				rawCos := CosineSimilarity(queryVec, stored.Vector)
				// Gemini embedding cosines generally sit in ~0.40-0.88; normalize meaningfully
				norm := (rawCos - 0.35) / 0.50
				if norm < 0 {
					norm = 0
				}
				if norm > 1 {
					norm = 1
				}
				semScore = norm
			}
		}

		finalScore := kwScore
		if useSemantic && semScore > 0 {
			finalScore = 0.55*semScore + 0.45*kwScore
			if mismatchedHardFacet {
				finalScore *= 0.45
			}
			reasons = append([]string{fmt.Sprintf("ตรงตามความหมาย (%.0f%%)", semScore*100)}, reasons...)
		} else {
			if mismatchedHardFacet {
				finalScore *= 0.30
			}
		}

		if (!useSemantic || semScore == 0) && kwScore < 0.15 {
			continue
		}
		if useSemantic && finalScore < 0.18 && kwScore < 0.15 {
			continue
		}

		amt := b.InvoiceAmount
		if amt <= 0 {
			amt = b.PaidAmount
		}
		if len(reasons) == 0 {
			reasons = []string{"พบคำที่เกี่ยวข้อง"}
		}

		billHits = append(billHits, BillSearchHit{
			ID:             b.ID,
			BillCode:       b.BillCode,
			DepartmentID:   b.DepartmentID,
			DepartmentName: b.DepartmentName,
			Province:       prov,
			Region:         reg,
			UtilityType:    b.UtilityType,
			BillingMonth:   b.BillingMonth,
			BillingYearCE:  b.BillingYearCE,
			BillingYearBE:  yearBE,
			ServiceNumber:  b.ServiceNumber,
			InvoiceNumber:  b.InvoiceNumber,
			InvoiceAmount:  amt,
			PaymentStatus:  b.PaymentStatus,
			InvoiceStatus:  b.InvoiceStatus,
			HasAnomaly:     b.HasAnomaly,
			Score:          math.Round(finalScore*1000) / 1000,
			SemanticScore:  math.Round(semScore*1000) / 1000,
			KeywordScore:   math.Round(kwScore*1000) / 1000,
			MatchReasons:   reasons,
		})
	}

	sort.Slice(billHits, func(i, j int) bool {
		if math.Abs(billHits[i].Score-billHits[j].Score) > 1e-6 {
			return billHits[i].Score > billHits[j].Score
		}
		return (billHits[i].BillingYearCE*12 + billHits[i].BillingMonth) > (billHits[j].BillingYearCE*12 + billHits[j].BillingMonth)
	})
	if len(billHits) > limit {
		billHits = billHits[:limit]
	}

	deptHits := make([]DepartmentSearchHit, 0, len(depts))
	for _, d := range depts {
		prov, reg := InferProvinceAndRegion(d.Province, d.Location, d.FullName)
		searchText := BuildDepartmentSearchText(d)
		kwScore, reasons, mismatchedRegion := scoreDeptKeywordsAndIntent(qLower, intent, d, prov, reg, searchText)

		semScore := 0.0
		if useSemantic {
			if stored, ok := vecs["department:"+d.ID]; ok && len(stored.Vector) > 0 {
				rawCos := CosineSimilarity(queryVec, stored.Vector)
				norm := (rawCos - 0.35) / 0.50
				if norm < 0 {
					norm = 0
				}
				if norm > 1 {
					norm = 1
				}
				semScore = norm
			}
		}

		finalScore := kwScore
		if useSemantic && semScore > 0 {
			finalScore = 0.55*semScore + 0.45*kwScore
			if mismatchedRegion {
				finalScore *= 0.45
			}
			reasons = append([]string{fmt.Sprintf("ตรงตามความหมาย (%.0f%%)", semScore*100)}, reasons...)
		} else if mismatchedRegion {
			finalScore *= 0.30
		}

		if (!useSemantic || semScore == 0) && kwScore < 0.15 {
			continue
		}
		if useSemantic && finalScore < 0.22 && kwScore < 0.15 {
			continue
		}
		if len(reasons) == 0 {
			reasons = []string{"หน่วยงานเกี่ยวข้อง"}
		}

		deptHits = append(deptHits, DepartmentSearchHit{
			ID:            d.ID,
			FullName:      d.FullName,
			ShortName:     d.ShortName,
			Province:      prov,
			Region:        reg,
			Type:          d.Type,
			CostCenter:    d.CostCenterCode,
			Score:         math.Round(finalScore*1000) / 1000,
			SemanticScore: math.Round(semScore*1000) / 1000,
			KeywordScore:  math.Round(kwScore*1000) / 1000,
			MatchReasons:  reasons,
		})
	}

	sort.Slice(deptHits, func(i, j int) bool {
		return deptHits[i].Score > deptHits[j].Score
	})
	deptCap := limit
	if deptCap > 8 {
		deptCap = 8
	}
	if len(deptHits) > deptCap {
		deptHits = deptHits[:deptCap]
	}

	return billHits, deptHits
}

func scoreBillKeywordsAndIntent(qLower string, intent SearchIntent, b BillIndexRecord, prov, reg, searchText string) (float64, []string, bool) {
	score := 0.0
	weights := 0.0
	var reasons []string
	mismatched := false
	lowerText := strings.ToLower(searchText)

	if intent.UtilityType != "" {
		weights += 1.0
		if b.UtilityType == intent.UtilityType {
			score += 1.0
			reasons = append(reasons, b.UtilityType)
		} else {
			mismatched = true
		}
	}
	if intent.PaymentStatus != "" {
		weights += 1.0
		if strings.EqualFold(b.PaymentStatus, intent.PaymentStatus) {
			score += 1.0
			if intent.PaymentStatus == "PENDING" {
				reasons = append(reasons, "ยังไม่ได้เบิกจ่าย")
			} else {
				reasons = append(reasons, "เบิกจ่ายแล้ว")
			}
		} else {
			mismatched = true
		}
	}
	if intent.InvoiceStatus != "" {
		weights += 0.8
		if strings.EqualFold(b.InvoiceStatus, intent.InvoiceStatus) {
			score += 0.8
			reasons = append(reasons, "ยังไม่ได้รับใบแจ้งหนี้")
		} else {
			mismatched = true
		}
	}
	if intent.HasAnomaly {
		weights += 0.8
		if b.HasAnomaly {
			score += 0.8
			reasons = append(reasons, "พบความคลาดเคลื่อน")
		} else {
			mismatched = true
		}
	}
	if intent.Region != "" {
		weights += 1.0
		if reg == intent.Region {
			score += 1.0
			label := intent.Region
			if prov != "" {
				label = fmt.Sprintf("%s (%s)", intent.Region, prov)
			}
			reasons = append(reasons, label)
		} else {
			mismatched = true
		}
	}
	if intent.Month > 0 {
		weights += 0.6
		if b.BillingMonth == intent.Month {
			score += 0.6
			reasons = append(reasons, "เดือน"+thaiMonthNames[intent.Month])
		} else {
			mismatched = true
		}
	}
	if intent.YearCE > 0 {
		weights += 0.6
		if b.BillingYearCE == intent.YearCE {
			score += 0.6
			reasons = append(reasons, fmt.Sprintf("พ.ศ. %d", intent.YearCE+543))
		} else {
			mismatched = true
		}
	}

	// Exact province or department / number substring checks
	for _, numTok := range intent.NumericTokens {
		weights += 1.0
		if strings.Contains(lowerText, numTok) {
			score += 1.0
			reasons = append(reasons, "ตรงรหัส "+numTok)
		}
	}

	if prov != "" && strings.Contains(qLower, strings.ToLower(prov)) {
		weights += 1.0
		score += 1.0
		reasons = append(reasons, "จ."+prov)
	}
	if b.DepartmentName != "" && len([]rune(qLower)) >= 3 {
		for _, tok := range intent.RawTokens {
			if strings.Contains(strings.ToLower(b.DepartmentName+" "+b.ShortName+" "+b.Provider), tok) {
				weights += 0.5
				score += 0.5
			}
		}
	}

	if weights == 0 {
		// General substring / character n-gram fallback for arbitrary Thai phrases
		gramScore := thaiCharNgramOverlap(qLower, lowerText)
		if strings.Contains(lowerText, qLower) {
			gramScore = math.Max(gramScore, 0.90)
		}
		return gramScore, reasons, false
	}

	norm := score / weights
	if norm > 1 {
		norm = 1
	}
	return norm, reasons, mismatched
}

func scoreDeptKeywordsAndIntent(qLower string, intent SearchIntent, d DeptIndexRecord, prov, reg, searchText string) (float64, []string, bool) {
	score := 0.0
	weights := 0.0
	var reasons []string
	mismatched := false
	lowerText := strings.ToLower(searchText)

	if intent.Region != "" {
		weights += 1.0
		if reg == intent.Region {
			score += 1.0
			label := intent.Region
			if prov != "" {
				label = fmt.Sprintf("%s (%s)", intent.Region, prov)
			}
			reasons = append(reasons, label)
		} else {
			mismatched = true
		}
	}

	if prov != "" && strings.Contains(qLower, strings.ToLower(prov)) {
		weights += 1.0
		score += 1.0
		reasons = append(reasons, "จ."+prov)
	}

	for _, numTok := range intent.NumericTokens {
		weights += 0.9
		if strings.Contains(lowerText, numTok) {
			score += 0.9
			reasons = append(reasons, "รหัส "+numTok)
		}
	}

	for _, tok := range intent.RawTokens {
		if strings.Contains(strings.ToLower(d.FullName+" "+d.ShortName+" "+d.Division+" "+prov), tok) {
			weights += 0.6
			score += 0.6
			reasons = append(reasons, "ชื่อหน่วยงานตรงคำค้น")
		}
	}

	if weights == 0 {
		gramScore := thaiCharNgramOverlap(qLower, lowerText)
		if strings.Contains(lowerText, qLower) {
			gramScore = math.Max(gramScore, 0.90)
		}
		return gramScore, reasons, false
	}

	norm := score / weights
	if norm > 1 {
		norm = 1
	}
	return norm, uniqueStrings(reasons), mismatched
}

func thaiCharNgramOverlap(query, doc string) float64 {
	qRunes := []rune(strings.ReplaceAll(query, " ", ""))
	if len(qRunes) < 3 {
		if strings.Contains(doc, query) {
			return 0.75
		}
		return 0
	}
	docNoSpace := strings.ReplaceAll(doc, " ", "")
	hits := 0
	total := 0
	for i := 0; i <= len(qRunes)-3; i++ {
		tri := string(qRunes[i : i+3])
		total++
		if strings.Contains(docNoSpace, tri) {
			hits++
		}
	}
	if total == 0 {
		return 0
	}
	return float64(hits) / float64(total)
}

func uniqueStrings(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if !seen[s] && s != "" {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

func (s *SearchService) loadBillRecords(ctx context.Context, scope UserScope, billID string) ([]BillIndexRecord, error) {
	where := []string{"1=1"}
	var args []any
	idx := 1

	if !scope.IsAdmin {
		if scope.DepartmentID == "" {
			return nil, nil
		}
		where = append(where, fmt.Sprintf("(b.department_id = $%d OR b.deposit_unit_id = $%d)", idx, idx))
		args = append(args, scope.DepartmentID)
		idx++
	}
	if billID != "" {
		where = append(where, fmt.Sprintf("b.id = $%d", idx))
		args = append(args, billID)
		idx++
	}

	q := fmt.Sprintf(`
		SELECT
			b.id,
			COALESCE(b.bill_code, ''),
			b.department_id,
			COALESCE(b.deposit_unit_id, ''),
			COALESCE(d.full_name, 'ไม่ระบุหน่วยงาน'),
			COALESCE(d.short_name, ''),
			COALESCE(d.province, ''),
			COALESCE(d.location, ''),
			b.utility_type,
			b.billing_month,
			b.billing_year,
			COALESCE(b.provider, ''),
			COALESCE(b.service_number, ''),
			COALESCE(b.invoice_number, ''),
			COALESCE(b.invoice_amount, 0)::float8,
			COALESCE(b.paid_amount, 0)::float8,
			COALESCE(b.payment_status, 'PENDING'),
			COALESCE(b.invoice_status, 'RECEIVED'),
			COALESCE(b.budget_code, ''),
			COALESCE((
				a.is_manual_anomaly = true OR a.is_late_receive = true OR a.is_late_payment = true OR
				a.is_overdue_more_than_2_months = true OR a.is_disbursement_over_2_months = true OR
				a.is_wrong_month = true OR a.is_phone_over_limit = true OR a.is_phone_usage_over_limit = true OR
				a.is_wrong_budget = true OR a.is_duplicate = true OR a.is_anomaly_expense = true
			), false)
		FROM utility_bills b
		LEFT JOIN departments d ON b.department_id = d.id
		LEFT JOIN audits a ON b.id = a.utility_bill_id
		WHERE %s
		ORDER BY b.billing_year DESC, b.billing_month DESC, b.created_at DESC
		LIMIT 1000
	`, strings.Join(where, " AND "))

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []BillIndexRecord
	for rows.Next() {
		var r BillIndexRecord
		if scanErr := rows.Scan(
			&r.ID, &r.BillCode, &r.DepartmentID, &r.DepositUnitID,
			&r.DepartmentName, &r.ShortName, &r.Province, &r.Location,
			&r.UtilityType, &r.BillingMonth, &r.BillingYearCE,
			&r.Provider, &r.ServiceNumber, &r.InvoiceNumber,
			&r.InvoiceAmount, &r.PaidAmount, &r.PaymentStatus, &r.InvoiceStatus,
			&r.BudgetCode, &r.HasAnomaly,
		); scanErr == nil {
			if r.BillingYearCE > 2400 {
				r.BillingYearCE -= 543
			}
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *SearchService) loadDeptRecords(ctx context.Context, scope UserScope) ([]DeptIndexRecord, error) {
	where := "COALESCE(is_active, true) = true"
	var args []any
	if !scope.IsAdmin {
		if scope.DepartmentID == "" {
			return nil, nil
		}
		where += " AND id = $1"
		args = append(args, scope.DepartmentID)
	}

	q := fmt.Sprintf(`
		SELECT
			id, full_name, COALESCE(short_name, ''), COALESCE(division, ''),
			COALESCE(province, ''), COALESCE(location, ''), COALESCE(type, ''),
			COALESCE(cost_center_code, ''), COALESCE(responsible_person, '')
		FROM departments
		WHERE %s
		ORDER BY full_name ASC
		LIMIT 500
	`, where)

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DeptIndexRecord
	for rows.Next() {
		var d DeptIndexRecord
		if scanErr := rows.Scan(
			&d.ID, &d.FullName, &d.ShortName, &d.Division,
			&d.Province, &d.Location, &d.Type,
			&d.CostCenterCode, &d.ResponsiblePerson,
		); scanErr == nil {
			out = append(out, d)
		}
	}
	return out, nil
}

func (s *SearchService) loadExistingHashes(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT entity_type, entity_id, content_hash FROM ai_embeddings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var et, eid, h string
		if rows.Scan(&et, &eid, &h) == nil {
			out[et+":"+eid] = h
		}
	}
	return out, nil
}

func (s *SearchService) loadEmbeddings(ctx context.Context) (map[string]storedEmbedding, error) {
	rows, err := s.pool.Query(ctx, `SELECT entity_type, entity_id, content_hash, embedding::text FROM ai_embeddings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]storedEmbedding{}
	for rows.Next() {
		var et, eid, h, rawVec string
		if rows.Scan(&et, &eid, &h, &rawVec) == nil {
			vec := parsePGFloat8Array(rawVec)
			if len(vec) > 0 {
				out[et+":"+eid] = storedEmbedding{
					ContentHash: h,
					Vector:      vec,
				}
			}
		}
	}
	return out, nil
}
