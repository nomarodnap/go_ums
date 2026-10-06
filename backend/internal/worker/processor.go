package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/dof/ums-backend/internal/email"
	"github.com/hibiken/asynq"
)

const (
	QueueCritical = "critical"
	QueueDefault  = "default"
	QueueLow      = "low"
)

type TaskProcessor interface {
	Start() error
	Shutdown()
	ProcessTaskEmailDelivery(ctx context.Context, t *asynq.Task) error
}

type RedisTaskProcessor struct {
	server       *asynq.Server
	emailService *email.EmailService
}

func NewRedisTaskProcessor(redisURL string, emailService *email.EmailService) (*RedisTaskProcessor, error) {
	redisOpt, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis url for asynq processor: %w", err)
	}

	server := asynq.NewServer(
		redisOpt,
		asynq.Config{
			Concurrency: 10,
			Queues: map[string]int{
				QueueCritical: 6,
				QueueDefault:  3,
				QueueLow:      1,
			},
			ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
				log.Printf("[Asynq] Error processing task %s: %v", task.Type(), err)
			}),
		},
	)

	return &RedisTaskProcessor{
		server:       server,
		emailService: emailService,
	}, nil
}

func (p *RedisTaskProcessor) ProcessTaskEmailDelivery(ctx context.Context, t *asynq.Task) error {
	var payload EmailDeliveryPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal email payload: %w", asynq.SkipRetry)
	}

	log.Printf("[Asynq Worker] Processing email delivery to: %s (%s)", payload.ToEmail, payload.ToName)

	if p.emailService == nil {
		return fmt.Errorf("email service is not configured")
	}

	if err := p.emailService.SendResetPasswordEmail(payload.ToEmail, payload.ToName, payload.ResetURL); err != nil {
		log.Printf("[Asynq Worker] Failed sending email to %s: %v", payload.ToEmail, err)
		return fmt.Errorf("failed sending email: %w", err)
	}

	log.Printf("[Asynq Worker] Email successfully delivered to: %s", payload.ToEmail)
	return nil
}

func (p *RedisTaskProcessor) Start() error {
	mux := asynq.NewServeMux()
	mux.HandleFunc(TypeEmailDelivery, p.ProcessTaskEmailDelivery)

	log.Println("[Asynq Worker] Worker server started and listening for tasks...")
	return p.server.Run(mux)
}

func (p *RedisTaskProcessor) Shutdown() {
	if p.server != nil {
		p.server.Shutdown()
		log.Println("[Asynq Worker] Worker server shutdown completed.")
	}
}
