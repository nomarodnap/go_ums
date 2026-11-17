package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnnouncementImageDTO struct {
	ID      string `json:"id" doc:"Image unique identifier"`
	URL     string `json:"url" doc:"Image URL"`
	Title   string `json:"title,omitempty" doc:"Image title or caption"`
	LinkURL string `json:"linkUrl,omitempty" doc:"Optional target URL when clicked"`
}

type AnnouncementSettingsDTO struct {
	IsEnabled       bool                   `json:"isEnabled" doc:"Whether announcement popup is active"`
	IntervalSeconds int                    `json:"intervalSeconds" doc:"Seconds before cycling to the next slide"`
	Images          []AnnouncementImageDTO `json:"images" doc:"List of announcement images (0-6)"`
	UpdatedAt       *time.Time             `json:"updatedAt,omitempty" doc:"Last update timestamp"`
}

type GetAnnouncementsOutput struct {
	Body AnnouncementSettingsDTO `json:"body"`
}

type UpdateAnnouncementsInput struct {
	Body struct {
		IsEnabled       bool                   `json:"isEnabled" doc:"Whether announcement popup is active"`
		IntervalSeconds int                    `json:"intervalSeconds" doc:"Seconds before cycling (2-60)"`
		Images          []AnnouncementImageDTO `json:"images" doc:"List of announcement images (0-6)"`
	}
}

func ensureSystemSettingsTable(pool *pgxpool.Pool) {
	if pool == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	ddl := `
	CREATE TABLE IF NOT EXISTS system_settings (
		key VARCHAR(64) PRIMARY KEY,
		value JSONB NOT NULL DEFAULT '{}'::jsonb,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	INSERT INTO system_settings (key, value)
	VALUES ('login_announcements', '{"isEnabled": false, "intervalSeconds": 5, "images": []}'::jsonb)
	ON CONFLICT (key) DO NOTHING;
	`
	_, _ = pool.Exec(ctx, ddl)
}

// RegisterAnnouncementRoutes registers endpoints for managing login announcements CMS.
func RegisterAnnouncementRoutes(api huma.API, pool *pgxpool.Pool) {
	ensureSystemSettingsTable(pool)

	// 1. Get Announcement Settings (Public)
	huma.Register(api, huma.Operation{
		OperationID: "getAnnouncements",
		Method:      http.MethodGet,
		Path:        "/api/announcements",
		Summary:     "Get login announcement popup settings",
		Tags:        []string{"CMS", "Settings"},
	}, func(ctx context.Context, input *struct{}) (*GetAnnouncementsOutput, error) {
		var rawVal []byte
		var updatedAt time.Time

		err := pool.QueryRow(ctx, `
			SELECT value, updated_at
			FROM system_settings
			WHERE key = 'login_announcements'
		`).Scan(&rawVal, &updatedAt)

		if err != nil {
			// Return default empty settings if not found
			return &GetAnnouncementsOutput{
				Body: AnnouncementSettingsDTO{
					IsEnabled:       false,
					IntervalSeconds: 5,
					Images:          []AnnouncementImageDTO{},
				},
			}, nil
		}

		var settings AnnouncementSettingsDTO
		if err := json.Unmarshal(rawVal, &settings); err != nil {
			return nil, huma.Error500InternalServerError("failed to parse announcement settings: " + err.Error())
		}
		if settings.Images == nil {
			settings.Images = []AnnouncementImageDTO{}
		}
		if settings.IntervalSeconds <= 0 {
			settings.IntervalSeconds = 5
		}
		settings.UpdatedAt = &updatedAt

		return &GetAnnouncementsOutput{Body: settings}, nil
	})

	// 2. Update Announcement Settings (Admin / Staff)
	huma.Register(api, huma.Operation{
		OperationID: "updateAnnouncements",
		Method:      http.MethodPut,
		Path:        "/api/announcements",
		Summary:     "Update login announcement popup settings",
		Tags:        []string{"CMS", "Settings"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *UpdateAnnouncementsInput) (*GetAnnouncementsOutput, error) {
		_, err := auth.RequireRoles(ctx, "admin", "central_staff", "auditor", "strategy_finance")
		if err != nil {
			return nil, huma.Error403Forbidden("สิทธิ์การเข้าถึงไม่เพียงพอ: เฉพาะผู้ดูแลระบบที่สามารถจัดการประกาศได้")
		}

		if len(input.Body.Images) > 6 {
			return nil, huma.Error400BadRequest("สามารถอัปโหลดรูปภาพประกาศได้สูงสุดไม่เกิน 6 รูป")
		}

		interval := input.Body.IntervalSeconds
		if interval <= 0 {
			interval = 5
		}
		if interval < 2 {
			interval = 2
		}
		if interval > 60 {
			interval = 60
		}

		images := input.Body.Images
		if images == nil {
			images = []AnnouncementImageDTO{}
		}

		settingsToSave := AnnouncementSettingsDTO{
			IsEnabled:       input.Body.IsEnabled,
			IntervalSeconds: interval,
			Images:          images,
		}

		jsonBytes, err := json.Marshal(settingsToSave)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to encode announcement settings: " + err.Error())
		}

		var updatedTime time.Time
		err = pool.QueryRow(ctx, `
			INSERT INTO system_settings (key, value, updated_at)
			VALUES ('login_announcements', $1::jsonb, NOW())
			ON CONFLICT (key) DO UPDATE
			SET value = EXCLUDED.value, updated_at = NOW()
			RETURNING updated_at
		`, string(jsonBytes)).Scan(&updatedTime)

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to save announcement settings: " + err.Error())
		}

		settingsToSave.UpdatedAt = &updatedTime

		return &GetAnnouncementsOutput{Body: settingsToSave}, nil
	})
}

