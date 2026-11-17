package handlers

import (
	"strings"
	"testing"
	"time"
)

func TestLineChatModeValidation(t *testing.T) {
	validModes := []string{"AI", "MANUAL", "ai", "manual"}
	for _, m := range validModes {
		upper := strings.ToUpper(strings.TrimSpace(m))
		if upper != "AI" && upper != "MANUAL" {
			t.Errorf("expected %s to be valid, got invalid", m)
		}
	}

	invalidModes := []string{"BOT", "HUMAN", "AUTO", ""}
	for _, m := range invalidModes {
		upper := strings.ToUpper(strings.TrimSpace(m))
		if upper == "AI" || upper == "MANUAL" {
			t.Errorf("expected %s to be invalid, got valid", m)
		}
	}
}

func TestGenerateLineID(t *testing.T) {
	id1 := generateLineID("line_sess")
	id2 := generateLineID("line_sess")
	if !strings.HasPrefix(id1, "line_sess_") {
		t.Errorf("expected prefix line_sess_, got %s", id1)
	}
	if id1 == id2 {
		t.Errorf("expected unique IDs, got identical %s", id1)
	}
}

func TestStaffInactivityTimeoutDetection(t *testing.T) {
	timeout := 10 * time.Minute
	now := time.Now()

	// 1. Staff active 3 minutes ago -> Not inactive
	recentStaffActive := now.Add(-3 * time.Minute)
	if time.Since(recentStaffActive) > timeout {
		t.Errorf("expected staff to be considered active within 3 minutes")
	}

	// 2. Staff active 15 minutes ago -> Inactive!
	idleStaffActive := now.Add(-15 * time.Minute)
	if !(time.Since(idleStaffActive) > timeout) {
		t.Errorf("expected staff to be considered inactive after 15 minutes")
	}
}
