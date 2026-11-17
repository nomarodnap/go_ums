package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/cache"
	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/email"
	"github.com/dof/ums-backend/internal/linenotify"
	"github.com/dof/ums-backend/internal/worker"
)

func main() {
	cfg := config.LoadConfig()

	log.Println("[River Worker] Initializing standalone background worker service...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	connConfig, err := pgxpool.ParseConfig(cfg.DirectURL)
	if err != nil {
		log.Fatalf("[River Worker] ParseConfig failed: %v", err)
	}
	connConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, connConfig)
	if err != nil {
		log.Fatalf("[River Worker] Failed to connect to database: %v", err)
	}
	defer pool.Close()

	hybridCache, cacheErr := cache.NewHybridCache(pool)
	if cacheErr != nil {
		log.Printf("[River Worker] Warning: Failed to initialize hybrid cache: %v", cacheErr)
	} else {
		defer func() { _ = hybridCache.Close() }()
	}

	aiClient := ai.NewClient(cfg.GeminiAPIKey, cfg.GeminiModel)
	aiTools := ai.NewToolExecutor(pool)
	var summaryCache ai.CacheStore
	if hybridCache != nil {
		summaryCache = hybridCache
	}
	summaryService := ai.NewSummaryService(aiClient, aiTools, pool, summaryCache)

	emailService := email.NewEmailService(cfg)
	lineNotifier := linenotify.NewService(pool, cfg)

	riverService, err := worker.NewRiverService(pool, emailService, summaryService, lineNotifier)
	if err != nil {
		log.Fatalf("[River Worker] Failed to initialize river service: %v", err)
	}

	// Handle graceful shutdown
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit

		log.Println("[River Worker] Signal received, shutting down worker...")
		_ = riverService.Stop(context.Background())
		os.Exit(0)
	}()

	if err := riverService.Start(ctx); err != nil {
		log.Fatalf("[River Worker] Error running worker server: %v", err)
	}
}
