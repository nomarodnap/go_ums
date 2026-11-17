package worker

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/email"
	"github.com/dof/ums-backend/internal/linenotify"
	"github.com/dof/ums-backend/internal/notifications"
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

// MonthlyAISummaryArgs represents the payload for background AI monthly summary generation via River
type MonthlyAISummaryArgs struct {
	Scope        string `json:"scope"`
	DepartmentID string `json:"department_id,omitempty"`
	Month        int    `json:"month,omitempty"`
	YearCE       int    `json:"year_ce,omitempty"`
	Force        bool   `json:"force,omitempty"`
	TriggeredBy  string `json:"triggered_by,omitempty"`
}

func (MonthlyAISummaryArgs) Kind() string { return "monthly_ai_summary" }

func (MonthlyAISummaryArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{MaxAttempts: 2}
}

// MonthlyAISummaryWorker generates and persists monthly AI executive insights into Postgres cache.
type MonthlyAISummaryWorker struct {
	river.WorkerDefaults[MonthlyAISummaryArgs]
	summaryService *ai.SummaryService
}

func (w *MonthlyAISummaryWorker) Work(ctx context.Context, job *river.Job[MonthlyAISummaryArgs]) error {
	if w.summaryService == nil || !w.summaryService.IsConfigured() {
		return river.JobCancel(fmt.Errorf("gemini AI service is not configured"))
	}

	isAdmin := job.Args.Scope != "department" && job.Args.DepartmentID == ""
	scope := ai.UserScope{
		Role:         "worker",
		IsAdmin:      isAdmin,
		DepartmentID: job.Args.DepartmentID,
	}

	if !job.Args.Force && w.summaryService.IsSummaryFresh(ctx, scope, job.Args.Month, job.Args.YearCE) {
		log.Printf("[River Worker] Skipping AI summary (%s) — fresh cache already exists", job.Args.Scope)
		return nil
	}

	log.Printf("[River Worker] Generating AI monthly summary (scope=%s, dept=%s, trigger=%s)...",
		job.Args.Scope, job.Args.DepartmentID, job.Args.TriggeredBy)

	if _, err := w.summaryService.GetMonthlySummary(ctx, scope, job.Args.Month, job.Args.YearCE, true, "worker"); err != nil {
		log.Printf("[River Worker] Failed generating AI summary: %v", err)
		return err
	}

	log.Println("[River Worker] AI monthly summary generated and cached successfully.")
	return nil
}

// NotificationEngineArgs represents the payload for scheduled department notification checks via River.
type NotificationEngineArgs struct {
	Mode        string `json:"mode,omitempty"`
	TriggeredBy string `json:"triggered_by,omitempty"`
}

func (NotificationEngineArgs) Kind() string { return "notification_engine" }

func (NotificationEngineArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{MaxAttempts: 2}
}

// NotificationEngineWorker evaluates automated department notifications and dispatches LINE alerts.
type NotificationEngineWorker struct {
	river.WorkerDefaults[NotificationEngineArgs]
	engine *notifications.Engine
}

func (w *NotificationEngineWorker) Work(ctx context.Context, job *river.Job[NotificationEngineArgs]) error {
	if w.engine == nil {
		return river.JobCancel(fmt.Errorf("notification engine is not configured"))
	}

	mode := job.Args.Mode
	if mode == "" {
		mode = "scheduled"
	}

	res, err := w.engine.Run(ctx, mode)
	if err != nil {
		log.Printf("[River Worker] Notification engine failed (mode=%s, trigger=%s): %v", mode, job.Args.TriggeredBy, err)
		return err
	}

	log.Printf("[River Worker] Notification engine finished (mode=%s, trigger=%s, created=%d)", mode, job.Args.TriggeredBy, res.CreatedCount)
	return nil
}

// TaskDistributor interface for enqueuing background tasks
type TaskDistributor interface {
	DistributeTaskSendEmail(ctx context.Context, toEmail, toName, resetURL string) error
	DistributeTaskGenerateAISummary(ctx context.Context, args MonthlyAISummaryArgs) error
	Close() error
}

// RiverService combines task distributor and worker engine using PostgreSQL
type RiverService struct {
	Client *river.Client[pgx.Tx]
}

// NewRiverService initializes the River client and workers using pgxpool
func NewRiverService(pool *pgxpool.Pool, emailService *email.EmailService, summarySvc *ai.SummaryService, lineNotifiers ...*linenotify.Service) (*RiverService, error) {
	var lineNotifier *linenotify.Service
	if len(lineNotifiers) > 0 {
		lineNotifier = lineNotifiers[0]
	}

	notifEngine := notifications.NewEngine(pool, lineNotifier)

	workers := river.NewWorkers()
	river.AddWorker(workers, &EmailDeliveryWorker{emailService: emailService})
	river.AddWorker(workers, &MonthlyAISummaryWorker{summaryService: summarySvc})
	river.AddWorker(workers, &NotificationEngineWorker{engine: notifEngine})

	periodicJobs := []*river.PeriodicJob{
		river.NewPeriodicJob(
			river.PeriodicInterval(24*time.Hour),
			func() (river.JobArgs, *river.InsertOpts) {
				return NotificationEngineArgs{
					Mode:        "scheduled",
					TriggeredBy: "periodic",
				}, nil
			},
			&river.PeriodicJobOpts{
				ID:         "daily_department_notifications",
				RunOnStart: true,
			},
		),
	}
	if summarySvc != nil && summarySvc.IsConfigured() {
		periodicJobs = append(periodicJobs, river.NewPeriodicJob(
			river.PeriodicInterval(24*time.Hour),
			func() (river.JobArgs, *river.InsertOpts) {
				return MonthlyAISummaryArgs{
					Scope:       "all",
					Force:       false,
					TriggeredBy: "periodic",
				}, nil
			},
			&river.PeriodicJobOpts{
				ID:         "daily_monthly_ai_summary",
				RunOnStart: true,
			},
		))
	}

	client, err := river.NewClient(riverpgxv5.New(pool), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault: {MaxWorkers: 10},
		},
		Workers:      workers,
		PeriodicJobs: periodicJobs,
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

// DistributeTaskGenerateAISummary enqueues an AI summary generation job into PostgreSQL
func (s *RiverService) DistributeTaskGenerateAISummary(ctx context.Context, args MonthlyAISummaryArgs) error {
	res, err := s.Client.Insert(ctx, args, nil)
	if err != nil {
		return fmt.Errorf("failed to enqueue ai summary job: %w", err)
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
