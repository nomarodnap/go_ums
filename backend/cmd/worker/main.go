package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/email"
	"github.com/dof/ums-backend/internal/worker"
)

func main() {
	cfg := config.LoadConfig()

	log.Println("[Asynq Worker] Initializing standalone background worker service...")

	emailService := email.NewEmailService(cfg)

	processor, err := worker.NewRedisTaskProcessor(cfg.RedisURL, emailService)
	if err != nil {
		log.Fatalf("[Asynq Worker] Failed to initialize task processor: %v", err)
	}

	// Handle graceful shutdown
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit

		log.Println("[Asynq Worker] Signal received, shutting down worker...")
		processor.Shutdown()
		os.Exit(0)
	}()

	if err := processor.Start(); err != nil {
		log.Fatalf("[Asynq Worker] Error running worker server: %v", err)
	}
}
