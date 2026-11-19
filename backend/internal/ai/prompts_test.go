package ai

import (
	"strings"
	"testing"
	"time"
)

func TestBuildSystemPromptContainsOffTopicGuardrails(t *testing.T) {
	now := time.Date(2026, time.November, 13, 13, 0, 0, 0, time.UTC)
	scope := UserScope{
		UserID:         "user-1",
		Role:           "user",
		IsAdmin:        false,
		DepartmentID:   "dept-1",
		DepartmentName: "ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร",
		Channel:        "line",
	}

	prompt := BuildSystemPrompt(now, scope)

	expectedPhrases := []string{
		"Strict Topic Guardrails",
		"ห้าม AI ชวนคุย หรือตั้งคำถามนอกเรื่องกับผู้ใช้เด็ดขาด",
		"ระบบรายงานค่าสาธารณูปโภค กรมประมง (UMS)",
		"ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร",
		"ข้อกำหนดพิเศษสำหรับช่องทาง LINE Official Account",
		"ควบคุมเนื้อหาอย่างเคร่งครัด ห้ามตอบหรือสนทนานอกเรื่องระบบ UMS",
	}

	for _, phrase := range expectedPhrases {
		if !strings.Contains(prompt, phrase) {
			t.Errorf("BuildSystemPrompt missing expected phrase: %q", phrase)
		}
	}
}

func TestBuildSystemPromptNongTharaPersona(t *testing.T) {
	now := time.Date(2026, time.November, 17, 12, 0, 0, 0, time.UTC)
	scope := UserScope{
		UserID:         "admin-1",
		Role:           "admin",
		IsAdmin:        true,
		DepartmentID:   "d-it",
		DepartmentName: "ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร",
		Channel:        "web_all",
	}

	prompt := BuildSystemPrompt(now, scope)

	expectedPhrases := []string{
		"น้องธาร่า",
		"เป็นคนเรียบร้อย",
		"ตั้งใจ",
		"ห้ามใช้คำว่า \"ครับ\"",
		"ค่ะ",
		"นะคะ",
		"โครงสร้างระบบ UMS และวงจรชีวิตของบิล",
		"กลไกการแจ้งเตือนของระบบ UMS",
		"เกณฑ์การตรวจสอบความผิดปกติ 10 ข้อ",
		"แนวทางการแก้ไขและปลดสถานะผิดปกติ",
		"is_late_receive",
		"is_anomaly_expense",
		"Web Notification Bell",
		"LINE Official Account",
		"คู่มือโครงสร้างเมนู หน้าจอ และฟังก์ชันทั้งหมดของระบบ UMS",
		"/dashboard",
		"/overview",
		"/all-ai",
		"/service-tracking",
		"/bills",
		"/services",
		"/bill-tracking",
		"/reports",
		"/line-chat",
		"/departments",
		"/settings",
		"/audits",
		"/budgets",
		"ห้ามตอบหรือพูดภาษาอังกฤษแทรกโดยเด็ดขาด 100%",
		"ระบบจะแปลงข้อความคำตอบเป็นเสียงพูดภาษาไทย",
	}

	for _, phrase := range expectedPhrases {
		if !strings.Contains(prompt, phrase) {
			t.Errorf("BuildSystemPrompt for web_all missing expected phrase: %q", phrase)
		}
	}
}

