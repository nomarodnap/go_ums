package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotificationDTO struct {
	ID             string    `json:"id"`
	DepartmentID   *string   `json:"departmentId,omitempty"`
	DepartmentName *string   `json:"departmentName,omitempty"`
	TargetRole     *string   `json:"targetRole,omitempty"`
	Title          string    `json:"title"`
	Message        string    `json:"message"`
	Type           string    `json:"type"`
	Severity       string    `json:"severity"`
	IsRead         bool      `json:"isRead"`
	Link           *string   `json:"link,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

type ListNotificationsOutput struct {
	Body []NotificationDTO `json:"body"`
}

func RegisterNotificationRoutes(api huma.API, pool *pgxpool.Pool) {
	// List Notifications
	huma.Register(api, huma.Operation{
		OperationID: "listNotifications",
		Method:      http.MethodGet,
		Path:        "/api/notifications",
		Summary:     "List system notifications",
		Tags:        []string{"Notifications"},
	}, func(ctx context.Context, input *struct {
		DepartmentID string `query:"departmentId"`
	}) (*ListNotificationsOutput, error) {
		query := `
			SELECT n.id, n.department_id, d.full_name, n.target_role, n.title, n.message, n.type, n.severity, n.is_read, n.link, n.created_at 
			FROM notifications n
			LEFT JOIN departments d ON d.id = n.department_id
			WHERE 1=1
		`
		var args []interface{}
		if input.DepartmentID != "" {
			query += " AND (n.department_id = $1 OR n.department_id IS NULL)"
			args = append(args, input.DepartmentID)
		}
		query += " ORDER BY n.created_at DESC LIMIT 50"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch notifications")
		}
		defer rows.Close()

		var results []NotificationDTO
		for rows.Next() {
			var n NotificationDTO
			if err := rows.Scan(
				&n.ID, &n.DepartmentID, &n.DepartmentName, &n.TargetRole, &n.Title, &n.Message, &n.Type, &n.Severity,
				&n.IsRead, &n.Link, &n.CreatedAt,
			); err == nil {
				results = append(results, n)
			}
		}

		return &ListNotificationsOutput{Body: results}, nil
	})

	// Mark read
	huma.Register(api, huma.Operation{
		OperationID: "markNotificationRead",
		Method:      http.MethodPut,
		Path:        "/api/notifications/{id}/read",
		Summary:     "Mark notification as read",
		Tags:        []string{"Notifications"},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		_, err := pool.Exec(ctx, "UPDATE notifications SET is_read = true WHERE id = $1", input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark notification read")
		}
		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})
}
