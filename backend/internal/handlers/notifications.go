package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/linenotify"
	notifengine "github.com/dof/ums-backend/internal/notifications"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotificationDTO struct {
	ID                 string     `json:"id"`
	DepartmentID       *string    `json:"departmentId,omitempty"`
	DepartmentName     *string    `json:"departmentName,omitempty"`
	TargetRole         *string    `json:"targetRole,omitempty"`
	Title              string     `json:"title"`
	Message            string     `json:"message"`
	Type               string     `json:"type"`
	Severity           string     `json:"severity"`
	IsRead             bool       `json:"isRead"`
	Link               *string    `json:"link,omitempty"`
	CreatedAt          time.Time  `json:"createdAt"`
	AcknowledgedReason *string    `json:"acknowledgedReason,omitempty"`
	AcknowledgedBy     *string    `json:"acknowledgedBy,omitempty"`
	AcknowledgedAt     *time.Time `json:"acknowledgedAt,omitempty"`
}

type ListNotificationsOutput struct {
	Body []NotificationDTO `json:"body"`
}

func RegisterNotificationRoutes(api huma.API, pool *pgxpool.Pool, lineNotifiers ...*linenotify.Service) {
	var lineNotifier *linenotify.Service
	if len(lineNotifiers) > 0 {
		lineNotifier = lineNotifiers[0]
	}
	notifEngine := notifengine.NewEngine(pool, lineNotifier)

	// List Notifications
	huma.Register(api, huma.Operation{
		OperationID: "listNotifications",
		Method:      http.MethodGet,
		Path:        "/api/notifications",
		Summary:     "List system notifications",
		Tags:        []string{"Notifications"},
	}, func(ctx context.Context, input *struct {
		DepartmentID string `query:"departmentId" doc:"Optional Department ID filter"`
		Scope        string `query:"scope" doc:"Scope of notifications: 'my_dept' or 'all'" default:"all"`
	}) (*ListNotificationsOutput, error) {
		user, _ := auth.UserFromContext(ctx)
		userDeptID := ""
		if user != nil {
			userDeptID = user.DepartmentID
		}

		query := `
			SELECT n.id, n.department_id, d.full_name, n.target_role, n.title, n.message, n.type, n.severity, n.is_read, n.link, n.created_at,
			       n.acknowledged_reason, n.acknowledged_by, n.acknowledged_at 
			FROM notifications n
			LEFT JOIN departments d ON d.id = n.department_id
			WHERE 1=1
		`
		var args []interface{}
		argIdx := 1

		if input.Scope == "my_dept" {
			targetDept := input.DepartmentID
			if targetDept == "" {
				targetDept = userDeptID
			}
			if targetDept != "" {
				query += fmt.Sprintf(" AND (n.department_id = $%d OR n.department_id IS NULL)", argIdx)
				args = append(args, targetDept)
			} else {
				query += " AND n.department_id IS NULL"
			}
			query += " AND n.type != 'MANUAL_ANOMALY_EDITED'"
		} else {
			// scope == "all"
			if input.DepartmentID != "" {
				query += fmt.Sprintf(" AND (n.department_id = $%d OR n.department_id IS NULL)", argIdx)
				args = append(args, input.DepartmentID)
			}
		}
		query += " ORDER BY n.created_at DESC LIMIT 100"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch notifications: " + err.Error())
		}
		defer rows.Close()

		results := make([]NotificationDTO, 0)
		for rows.Next() {
			var n NotificationDTO
			if err := rows.Scan(
				&n.ID, &n.DepartmentID, &n.DepartmentName, &n.TargetRole, &n.Title, &n.Message, &n.Type, &n.Severity,
				&n.IsRead, &n.Link, &n.CreatedAt,
				&n.AcknowledgedReason, &n.AcknowledgedBy, &n.AcknowledgedAt,
			); err == nil {
				results = append(results, n)
			}
		}

		return &ListNotificationsOutput{Body: results}, nil
	})

	// Mark read / Acknowledge notification
	type MarkNotificationReadRequest struct {
		Reason string `json:"reason" minLength:"1" doc:"สาเหตุหรือหมายเหตุการรับทราบ (บังคับกรอก)"`
	}

	huma.Register(api, huma.Operation{
		OperationID: "markNotificationRead",
		Method:      http.MethodPut,
		Path:        "/api/notifications/{id}/read",
		Summary:     "Mark notification as read / Acknowledge",
		Tags:        []string{"Notifications"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID   string `path:"id"`
		Body MarkNotificationReadRequest
	}) (*struct{ Body bool `json:"body"` }, error) {
		reason := strings.TrimSpace(input.Body.Reason)
		if reason == "" {
			return nil, huma.Error422UnprocessableEntity("กรุณาระบุเหตุผลหรือหมายเหตุการรับทราบ")
		}

		user, _ := auth.UserFromContext(ctx)
		userName := ""
		if user != nil {
			userName = user.Name
		}

		_, err := pool.Exec(ctx, `
			UPDATE notifications
			SET is_read = true,
			    acknowledged_reason = $1,
			    acknowledged_by = COALESCE(NULLIF($2, ''), acknowledged_by),
			    acknowledged_at = NOW(),
			    updated_at = NOW()
			WHERE id = $3
		`, reason, userName, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark notification read: " + err.Error())
		}
		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Mark all read
	huma.Register(api, huma.Operation{
		OperationID: "markAllNotificationsRead",
		Method:      http.MethodPut,
		Path:        "/api/notifications/read-all",
		Summary:     "Mark all notifications as read",
		Tags:        []string{"Notifications"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Scope string `query:"scope" doc:"Scope: 'my_dept' or 'all'"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		user, err := auth.RequireRoles(ctx, "admin", "auditor", "central_staff", "regional_staff", "strategy_finance", "user")
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		if input.Scope == "all" && (user.Role == "admin" || user.Role == "auditor") {
			_, err = pool.Exec(ctx, "UPDATE notifications SET is_read = true WHERE is_read = false")
		} else if user.DepartmentID != "" {
			_, err = pool.Exec(ctx, "UPDATE notifications SET is_read = true WHERE is_read = false AND (department_id = $1 OR department_id IS NULL)", user.DepartmentID)
		} else {
			_, err = pool.Exec(ctx, "UPDATE notifications SET is_read = true WHERE is_read = false AND department_id IS NULL")
		}

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark all notifications as read")
		}
		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Get Notification Counts
	huma.Register(api, huma.Operation{
		OperationID: "getNotificationCounts",
		Method:      http.MethodGet,
		Path:        "/api/notifications/counts",
		Summary:     "Get unread notification counts for user department and system-wide",
		Tags:        []string{"Notifications"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct{}) (*struct {
		Body struct {
			MyDeptCount    int `json:"myDeptCount"`
			AllSystemCount int `json:"allSystemCount"`
		} `json:"body"`
	}, error) {
		user, err := auth.RequireRoles(ctx, "admin", "auditor", "central_staff", "regional_staff", "strategy_finance", "user")
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		var myDeptCount int
		if user.DepartmentID != "" {
			_ = pool.QueryRow(ctx, `
				SELECT count(*) FROM notifications
				WHERE is_read = false 
				  AND (department_id = $1 OR department_id IS NULL)
				  AND type != 'MANUAL_ANOMALY_EDITED'
			`, user.DepartmentID).Scan(&myDeptCount)
		} else {
			_ = pool.QueryRow(ctx, `
				SELECT count(*) FROM notifications
				WHERE is_read = false 
				  AND department_id IS NULL
				  AND type != 'MANUAL_ANOMALY_EDITED'
			`).Scan(&myDeptCount)
		}

		var allSystemCount int
		if user.Role == "admin" || user.Role == "auditor" {
			_ = pool.QueryRow(ctx, `
				SELECT count(*) FROM notifications
				WHERE is_read = false
			`).Scan(&allSystemCount)
		}

		out := &struct {
			Body struct {
				MyDeptCount    int `json:"myDeptCount"`
				AllSystemCount int `json:"allSystemCount"`
			} `json:"body"`
		}{}
		out.Body.MyDeptCount = myDeptCount
		out.Body.AllSystemCount = allSystemCount
		return out, nil
	})

	// Run Notification Engine
	huma.Register(api, huma.Operation{
		OperationID: "runNotificationEngine",
		Method:      http.MethodPost,
		Path:        "/api/notifications/run-engine",
		Summary:     "Run automated notification engine rules",
		Tags:        []string{"Notifications"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Mode string `query:"mode" doc:"Mode: 'all', 'missing_data', or 'daily'"`
	}) (*struct {
		Body struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		} `json:"body"`
	}, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "auditor"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		res, err := notifEngine.Run(ctx, input.Mode)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to run notification engine: " + err.Error())
		}

		out := &struct {
			Body struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			} `json:"body"`
		}{}
		out.Body.Success = true
		out.Body.Message = fmt.Sprintf("Notification engine executed successfully (%d new notification(s))", res.CreatedCount)
		return out, nil
	})
}
