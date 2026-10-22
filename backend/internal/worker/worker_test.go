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
