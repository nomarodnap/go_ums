package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/handlers"
	"github.com/go-chi/chi/v5"
)

func main() {
	router := chi.NewMux()
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
	cfg := &config.Config{}

	handlers.RegisterAuthRoutes(api, nil, cfg, nil, nil)
	handlers.RegisterDepartmentRoutes(api, nil)
	handlers.RegisterBillRoutes(api, nil)
	handlers.RegisterAuditRoutes(api, nil)
	handlers.RegisterBudgetRoutes(api, nil)
	handlers.RegisterDashboardRoutes(api, nil)
	handlers.RegisterNotificationRoutes(api, nil)
	handlers.RegisterReportRoutes(api, nil)
	handlers.RegisterUserRoutes(api, nil, cfg, nil, nil)

	data, err := json.MarshalIndent(api.OpenAPI(), "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal OpenAPI spec: %v", err)
	}

	outputPath := "openapi.json"
	if len(os.Args) > 1 {
		outputPath = os.Args[1]
	}

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		log.Fatalf("Failed to write OpenAPI file: %v", err)
	}

	fmt.Printf("Successfully generated OpenAPI specification at %s (%d bytes)\n", outputPath, len(data))
}
