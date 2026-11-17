package worker

import (
	"testing"
)

func TestEmailDeliveryArgsKind(t *testing.T) {
	args := EmailDeliveryArgs{
		ToEmail:  "test@example.com",
		ToName:   "Tester",
		ResetURL: "https://example.com/reset",
	}

	if args.Kind() != "email_delivery" {
		t.Fatalf("Expected kind email_delivery, got %s", args.Kind())
	}
}

func TestMonthlyAISummaryArgsKindAndOpts(t *testing.T) {
	args := MonthlyAISummaryArgs{
		Scope:       "all",
		Month:       11,
		YearCE:      2026,
		TriggeredBy: "periodic",
	}

	if args.Kind() != "monthly_ai_summary" {
		t.Fatalf("Expected kind monthly_ai_summary, got %s", args.Kind())
	}
	if opts := args.InsertOpts(); opts.MaxAttempts != 2 {
		t.Fatalf("Expected MaxAttempts=2, got %d", opts.MaxAttempts)
	}
}

func TestNotificationEngineArgsKindAndOpts(t *testing.T) {
	args := NotificationEngineArgs{
		Mode:        "scheduled",
		TriggeredBy: "periodic",
	}

	if args.Kind() != "notification_engine" {
		t.Fatalf("Expected kind notification_engine, got %s", args.Kind())
	}
	if opts := args.InsertOpts(); opts.MaxAttempts != 2 {
		t.Fatalf("Expected MaxAttempts=2, got %d", opts.MaxAttempts)
	}
}
