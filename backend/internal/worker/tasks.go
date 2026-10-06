package worker

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
)

// Task Type Constants
const (
	TypeEmailDelivery = "email:delivery"
)

// EmailDeliveryPayload represents the data needed to send a notification or reset email
type EmailDeliveryPayload struct {
	ToEmail  string `json:"to_email"`
	ToName   string `json:"to_name"`
	ResetURL string `json:"reset_url"`
}

// NewEmailDeliveryTask creates a new Asynq task for sending emails in background
func NewEmailDeliveryTask(toEmail, toName, resetURL string) (*asynq.Task, error) {
	payload, err := json.Marshal(EmailDeliveryPayload{
		ToEmail:  toEmail,
		ToName:   toName,
		ResetURL: resetURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal email delivery payload: %w", err)
	}

	return asynq.NewTask(
		TypeEmailDelivery,
		payload,
		asynq.MaxRetry(3),
		asynq.Timeout(30*time.Second),
		asynq.Retention(24*time.Hour),
	), nil
}
