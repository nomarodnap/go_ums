package worker

import (
	"encoding/json"
	"testing"
)

func TestNewEmailDeliveryTask(t *testing.T) {
	toEmail := "test@fisheries.go.th"
	toName := "เจ้าหน้าที่ทดสอบ"
	resetURL := "http://localhost:3000/set-password?token=sample-token-123"

	task, err := NewEmailDeliveryTask(toEmail, toName, resetURL)
	if err != nil {
		t.Fatalf("expected no error creating task, got: %v", err)
	}

	if task.Type() != TypeEmailDelivery {
		t.Errorf("expected task type %s, got: %s", TypeEmailDelivery, task.Type())
	}

	var payload EmailDeliveryPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		t.Fatalf("failed to unmarshal payload: %v", err)
	}

	if payload.ToEmail != toEmail {
		t.Errorf("expected ToEmail %s, got %s", toEmail, payload.ToEmail)
	}
	if payload.ToName != toName {
		t.Errorf("expected ToName %s, got %s", toName, payload.ToName)
	}
	if payload.ResetURL != resetURL {
		t.Errorf("expected ResetURL %s, got %s", resetURL, payload.ResetURL)
	}
}

func TestAsynqParseRedisURLWithPassword(t *testing.T) {
	url := "redis://:qBte3j7A4S1p0y4hRNev5AkO@192.168.171.97:6379"
	_, err := NewRedisTaskDistributor(url)
	if err != nil {
		t.Fatalf("expected no error from NewRedisTaskDistributor with password URL, got: %v", err)
	}
}
