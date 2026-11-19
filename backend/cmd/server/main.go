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
	chi "github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dof/ums-backend/internal/ai"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/cache"
	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/email"
	"github.com/dof/ums-backend/internal/handlers"
	"github.com/dof/ums-backend/internal/linenotify"
	"github.com/dof/ums-backend/internal/realtime"
	"github.com/dof/ums-backend/internal/storage"
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
	connConfig.ConnConfig.StatementCacheCapacity = 0

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

	// 2. Initialize HybridCache (L1: Otter In-Memory + L2: Postgres UNLOGGED TABLE)
	hybridCache, err := cache.NewHybridCache(pool)
	if err != nil {
		log.Printf("Warning: Failed to initialize hybrid cache: %v. Running in memory-only mode.", err)
	} else {
		defer func() { _ = hybridCache.Close() }()
	}

	// 3. Setup Chi Router
	router := chi.NewMux()
	router.Use(middleware.RequestID)
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

	// Auth Middleware (Better Auth Session via HybridCache + Postgres + fallback JWT)
	router.Use(auth.AuthMiddleware(pool, hybridCache, cfg.JWTSecret))

	// 3. Setup Huma v2 with OpenAPI 3.1
	humaConfig := huma.DefaultConfig("ระบบรายงานค่าสาธารณูปโภค กรมประมง API", "2.0.0")
	humaConfig.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		"bearerAuth": {
			Type:         "http",
			Scheme:       "bearer",
			BearerFormat: "JWT",
			Description:  "Enter your JWT token (obtained via /api/auth/login)",
		},
	}

	api := humachi.New(router, humaConfig)

	// Initialize Email & LINE Department Notification Services
	emailService := email.NewEmailService(cfg)
	lineNotifier := linenotify.NewService(pool, cfg)

	// Initialize AI Services (shared between HTTP handlers, Bill lifecycle, and River worker)
	var summaryCache ai.CacheStore
	if hybridCache != nil {
		summaryCache = hybridCache
	}
	aiClient := ai.NewClient(cfg.GeminiAPIKey, cfg.GeminiModel)
	aiTools := ai.NewToolExecutor(pool)
	aiSummaryService := ai.NewSummaryService(aiClient, aiTools, pool, summaryCache)
	aiSearchService := ai.NewSearchService(aiClient, pool)
	aiForecastService := ai.NewForecastService(aiClient, pool, summaryCache)
	aiTools.SetForecastService(aiForecastService)
	aiTools.SetSearchService(aiSearchService)
	aiChatService := ai.NewChatService(aiClient, aiTools)

	// 4. Initialize River Background Job Queue (PostgreSQL-backed)
	var taskDistributor worker.TaskDistributor
	if pool != nil {
		riverService, err := worker.NewRiverService(pool, emailService, aiSummaryService, lineNotifier)
		if err != nil {
			log.Printf("[River] Warning: Failed to initialize river service: %v", err)
		} else {
			taskDistributor = riverService
			riverCtx, cancelRiver := context.WithCancel(context.Background())
			defer cancelRiver()

			go func() {
				if err := riverService.Start(riverCtx); err != nil {
					log.Printf("[River Worker] Server stopped: %v", err)
				}
			}()
			defer func() { _ = riverService.Stop(context.Background()) }()
		}
	}

	// 5. Initialize Realtime Hub (PostgreSQL LISTEN / NOTIFY + Go SSE)
	realtimeHub := realtime.NewHub(pool, cfg.DirectURL)
	realtimeHub.Start(context.Background())
	defer realtimeHub.Stop()
	realtime.RegisterRoutes(router, realtimeHub)

	// Initialize Storage Service (Garage S3 with local disk fallback)
	storageService := storage.NewGarageStorage(cfg)
	handlers.RegisterUploadRoutes(router, storageService)

	// 4. Register Domain Handlers
	handlers.RegisterAuthRoutes(api, pool, cfg, emailService, taskDistributor)
	handlers.RegisterDepartmentRoutes(api, pool)
	handlers.RegisterBillArchiveRoutes(api, pool, storageService, aiSearchService)
	handlers.RegisterBillRoutes(api, pool, aiSearchService)
	handlers.RegisterAuditRoutes(api, pool, lineNotifier)
	handlers.RegisterBudgetRoutes(api, pool)
	handlers.RegisterDashboardRoutes(api, pool)
	handlers.RegisterNotificationRoutes(api, pool, lineNotifier)
	handlers.RegisterReportRoutes(api, pool)
	handlers.RegisterUserRoutes(api, pool, cfg, emailService, taskDistributor)
	handlers.RegisterRoleRoutes(api, pool)
	handlers.RegisterAnnouncementRoutes(api, pool)
	handlers.RegisterAIRoutesWithServices(api, pool, cfg, handlers.AIRouteDeps{
		Summary:  aiSummaryService,
		Search:   aiSearchService,
		Forecast: aiForecastService,
		Chat:     aiChatService,
	})
	handlers.RegisterLineChatRoutes(api, pool, lineNotifier)
	handlers.RegisterLineWebhookRoutes(router, pool, cfg, lineNotifier, aiChatService)

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
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 90 * time.Second,
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
