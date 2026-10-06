package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/cache"
	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/email"
	"github.com/dof/ums-backend/internal/handlers"
	"github.com/dof/ums-backend/internal/worker"
)

func main() {
	cfg := config.LoadConfig()

	// 1. Connect to PostgreSQL (Supabase / Transaction Pooler with SimpleProtocol)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	connConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Database ParseConfig failed: %v", err)
	}
	connConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, connConfig)
	if err != nil {
		log.Printf("Warning: Failed to connect to database: %v. Running in offline mode.", err)
	} else {
		defer pool.Close()
		if err := pool.Ping(ctx); err != nil {
			log.Printf("Warning: Database ping failed: %v", err)
		} else {
			log.Println("Connected to PostgreSQL successfully.")
		}
	}

	// 2. Connect to Redis
	redisService := cache.NewRedisService(cfg.RedisURL)
	defer redisService.Close()

	// 3. Setup Chi Router
	router := chi.NewMux()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)

	// CORS Configuration
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://127.0.0.1:3000", cfg.CORSOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "Set-Cookie"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Auth Middleware
	router.Use(auth.AuthMiddleware(cfg.JWTSecret))

	// 3. Setup Huma v2 with OpenAPI 3.1
	humaConfig := huma.DefaultConfig("ระบบรายงานค่าสาธารณูปโภค กรมประมง API", "2.0.0")
	humaConfig.OpenAPI.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		"bearerAuth": {
			Type:         "http",
			Scheme:       "bearer",
			BearerFormat: "JWT",
			Description:  "Enter your JWT token (obtained via /api/auth/login)",
		},
	}

	api := humachi.New(router, humaConfig)

	// Initialize Email Service
	emailService := email.NewEmailService(cfg)

	// Initialize Asynq Background Task Queue (Redis)
	var taskDistributor worker.TaskDistributor
	taskDistributor, err = worker.NewRedisTaskDistributor(cfg.RedisURL)
	if err != nil {
		log.Printf("[Asynq] Warning: Failed to initialize task distributor: %v", err)
	} else {
		defer taskDistributor.Close()
	}

	taskProcessor, err := worker.NewRedisTaskProcessor(cfg.RedisURL, emailService)
	if err != nil {
		log.Printf("[Asynq] Warning: Failed to initialize task processor: %v", err)
	} else {
		go func() {
			if err := taskProcessor.Start(); err != nil {
				log.Printf("[Asynq Worker] Server stopped: %v", err)
			}
		}()
		defer taskProcessor.Shutdown()
	}

	// 4. Register Domain Handlers
	handlers.RegisterAuthRoutes(api, pool, cfg, emailService, taskDistributor)
	handlers.RegisterDepartmentRoutes(api, pool)
	handlers.RegisterBillRoutes(api, pool)
	handlers.RegisterAuditRoutes(api, pool)
	handlers.RegisterBudgetRoutes(api, pool)
	handlers.RegisterDashboardRoutes(api, pool)
	handlers.RegisterNotificationRoutes(api, pool)
	handlers.RegisterUserRoutes(api, pool, cfg, emailService, taskDistributor)

	// 5. Health check
	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","time":"` + time.Now().Format(time.RFC3339) + `"}`))
	})

	// 6. Start HTTP Server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("UMS Go Backend running on port %s (OpenAPI at http://localhost:%s/openapi.json, Docs at http://localhost:%s/docs)\n", cfg.Port, cfg.Port, cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v\n", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v\n", err)
	}

	fmt.Println("Server exited gracefully.")
}
