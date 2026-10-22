package worker

import (
	"context"
	"fmt"
	"log"

	"github.com/dof/ums-backend/internal/email"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

// EmailDeliveryArgs represents the payload for background email sending via River
type EmailDeliveryArgs struct {
	ToEmail  string `json:"to_email"`
	ToName   string `json:"to_name"`
	ResetURL string `json:"reset_url"`
}

func (EmailDeliveryArgs) Kind() string { return "email_delivery" }

// EmailDeliveryWorker processes background email jobs
type EmailDeliveryWorker struct {
	river.WorkerDefaults[EmailDeliveryArgs]
	emailService *email.EmailService
}

func (w *EmailDeliveryWorker) Work(ctx context.Context, job *river.Job[EmailDeliveryArgs]) error {
	log.Printf("[River Worker] Processing email delivery to: %s (%s)", job.Args.ToEmail, job.Args.ToName)

	if w.emailService == nil {
		return fmt.Errorf("email service is not configured")
	}

	if err := w.emailService.SendResetPasswordEmail(job.Args.ToEmail, job.Args.ToName, job.Args.ResetURL); err != nil {
		log.Printf("[River Worker] Failed sending email to %s: %v", job.Args.ToEmail, err)
		return err
	}

	log.Printf("[River Worker] Email successfully delivered to: %s", job.Args.ToEmail)
	return nil
}

// TaskDistributor interface for enqueuing background tasks
type TaskDistributor interface {
	DistributeTaskSendEmail(ctx context.Context, toEmail, toName, resetURL string) error
	Close() error
}

// RiverService combines task distributor and worker engine using PostgreSQL
type RiverService struct {
	Client *river.Client[pgx.Tx]
}

// NewRiverService initializes the River client and workers using pgxpool
func NewRiverService(pool *pgxpool.Pool, emailService *email.EmailService) (*RiverService, error) {
	workers := river.NewWorkers()
	river.AddWorker(workers, &EmailDeliveryWorker{emailService: emailService})

	client, err := river.NewClient(riverpgxv5.New(pool), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault: {MaxWorkers: 10},
		},
		Workers: workers,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create river client: %w", err)
	}

	return &RiverService{Client: client}, nil
}

// DistributeTaskSendEmail enqueues an email job into PostgreSQL
func (s *RiverService) DistributeTaskSendEmail(ctx context.Context, toEmail, toName, resetURL string) error {
	args := EmailDeliveryArgs{
		ToEmail:  toEmail,
		ToName:   toName,
		ResetURL: resetURL,
	}

	res, err := s.Client.Insert(ctx, args, nil)
	if err != nil {
		return fmt.Errorf("failed to enqueue email job: %w", err)
	}

	log.Printf("[River] Enqueued job: kind=%s, id=%d, queue=%s", res.Job.Kind, res.Job.ID, res.Job.Queue)
	return nil
}

// Start runs the background worker listening for River jobs
func (s *RiverService) Start(ctx context.Context) error {
	log.Println("[River Worker] Background worker server started (PostgreSQL Job Queue)...")
	return s.Client.Start(ctx)
}

// Stop gracefully stops the background worker
func (s *RiverService) Stop(ctx context.Context) error {
	log.Println("[River Worker] Background worker server shutting down...")
	return s.Client.Stop(ctx)
}

// Close implements TaskDistributor interface
func (s *RiverService) Close() error {
	return nil
}
