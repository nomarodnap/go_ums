package notifications

import (
	"testing"
	"time"
)

func TestShouldRunMissingData(t *testing.T) {
	day15 := time.Date(2026, 11, 15, 9, 0, 0, 0, time.UTC)
	day23 := time.Date(2026, 11, 23, 9, 0, 0, 0, time.UTC)

	if !ShouldRunMissingData("all", day15) {
		t.Fatal("expected mode 'all' to run missing_data regardless of day")
	}
	if !ShouldRunMissingData("missing_data", day15) {
		t.Fatal("expected mode 'missing_data' to run regardless of day")
	}
	if ShouldRunMissingData("daily", day23) {
		t.Fatal("expected mode 'daily' not to run missing_data")
	}
	if ShouldRunMissingData("scheduled", day15) {
		t.Fatal("expected scheduled mode before day 23 not to run missing_data")
	}
	if !ShouldRunMissingData("scheduled", day23) {
		t.Fatal("expected scheduled mode on day 23+ to run missing_data")
	}
}

func TestShouldRunDailyRules(t *testing.T) {
	if !ShouldRunDailyRules("all") || !ShouldRunDailyRules("daily") || !ShouldRunDailyRules("scheduled") {
		t.Fatal("expected all/daily/scheduled modes to run daily rules")
	}
	if ShouldRunDailyRules("missing_data") {
		t.Fatal("expected missing_data mode not to run daily rules")
	}
}

