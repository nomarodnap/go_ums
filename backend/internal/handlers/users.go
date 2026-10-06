package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/dof/ums-backend/internal/config"
	"github.com/dof/ums-backend/internal/email"
	"github.com/dof/ums-backend/internal/worker"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ManageUserDTO struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	EmailVerified  bool      `json:"emailVerified"`
	Role           string    `json:"role"`
	Banned         bool      `json:"banned"`
	DepartmentID   *string   `json:"departmentId,omitempty"`
	DepartmentName *string   `json:"departmentName,omitempty"`
	Phone          *string   `json:"phone,omitempty"`
	HasPassword    bool      `json:"hasPassword"`
	CreatedAt      time.Time `json:"createdAt"`
}

type ListUsersOutput struct {
	Body []ManageUserDTO `json:"body"`
}

type CreateUserInput struct {
	Body struct {
		Name         string  `json:"name"`
		Email        string  `json:"email"`
		Role         string  `json:"role"`
		DepartmentID string  `json:"departmentId"`
		Phone        *string `json:"phone,omitempty"`
		Password     *string `json:"password,omitempty"`
	}
}

type UpdateUserInput struct {
	ID   string `path:"id" doc:"User ID"`
	Body struct {
		Role         *string `json:"role,omitempty"`
		DepartmentID *string `json:"departmentId,omitempty"`
		Phone        *string `json:"phone,omitempty"`
		Banned       *bool   `json:"banned,omitempty"`
	}
}

type SingleUserOutput struct {
	Body ManageUserDTO `json:"body"`
}

func RegisterUserRoutes(api huma.API, pool *pgxpool.Pool, cfg *config.Config, emailService *email.EmailService, taskDistributor ...worker.TaskDistributor) {
	var distributor worker.TaskDistributor
	if len(taskDistributor) > 0 {
		distributor = taskDistributor[0]
	}

	// List Users (Admin / Staff)
	huma.Register(api, huma.Operation{
		OperationID: "listUsers",
		Method:      http.MethodGet,
		Path:        "/api/users",
		Summary:     "List all users with department and status",
		Tags:        []string{"Users"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		DepartmentID string `query:"departmentId" doc:"Optional department ID filter"`
	}) (*ListUsersOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		query := `
			SELECT u.id, u.name, u.email, u.email_verified, u.role, COALESCE(u.banned, FALSE),
			       u.department_id, d.full_name, u.phone, (a.password IS NOT NULL), u.created_at
			FROM "user" u
			LEFT JOIN "departments" d ON d.id = u.department_id
			LEFT JOIN "account" a ON a.user_id = u.id AND a.provider_id = 'credential'
			WHERE 1=1
		`
		var args []interface{}
		if input.DepartmentID != "" {
			query += " AND u.department_id = $1"
			args = append(args, input.DepartmentID)
		}
		query += " ORDER BY u.created_at DESC"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch users")
		}
		defer rows.Close()

		var results []ManageUserDTO
		for rows.Next() {
			var u ManageUserDTO
			if err := rows.Scan(
				&u.ID, &u.Name, &u.Email, &u.EmailVerified, &u.Role, &u.Banned,
				&u.DepartmentID, &u.DepartmentName, &u.Phone, &u.HasPassword, &u.CreatedAt,
			); err == nil {
				results = append(results, u)
			}
		}

		return &ListUsersOutput{Body: results}, nil
	})

	// Create User (Admin only)
	huma.Register(api, huma.Operation{
		OperationID: "createUser",
		Method:      http.MethodPost,
		Path:        "/api/users",
		Summary:     "Create a new user account (Admin only)",
		Tags:        []string{"Users"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *CreateUserInput) (*SingleUserOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		userID := uuid.New().String()
		role := input.Body.Role
		if role == "" {
			role = "user"
		}

		var deptName *string
		_ = pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", input.Body.DepartmentID).Scan(&deptName)

		now := time.Now()
		_, err := pool.Exec(ctx, `
			INSERT INTO "user" (id, name, email, email_verified, role, banned, department_id, phone, created_at, updated_at)
			VALUES ($1, $2, $3, FALSE, $4, FALSE, $5, $6, $7, $7)
		`, userID, input.Body.Name, input.Body.Email, role, input.Body.DepartmentID, input.Body.Phone, now)

		if err != nil {
			return nil, huma.Error400BadRequest("failed to create user: email might already exist")
		}

		hasPassword := false
		if input.Body.Password != nil && *input.Body.Password != "" {
			hashed, err := auth.HashPassword(*input.Body.Password)
			if err == nil {
				accountID := uuid.New().String()
				_, _ = pool.Exec(ctx, `
					INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
					VALUES ($1, $2, 'credential', $3, $4, $5, $5)
				`, accountID, userID, userID, hashed, now)
				hasPassword = true
			}
		} else {
			// Send initial password setup email asynchronously via Asynq
			token := uuid.New().String()
			verID := uuid.New().String()
			expiresAt := time.Now().Add(24 * time.Hour)
			_, _ = pool.Exec(ctx, `
				INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
				VALUES ($1, $2, $3, $4, NOW(), NOW())
			`, verID, input.Body.Email, token, expiresAt)

			resetURL := fmt.Sprintf("%s/set-password?token=%s", cfg.AppURL, token)
			if distributor != nil {
				_ = distributor.DistributeTaskSendEmail(ctx, input.Body.Email, input.Body.Name, resetURL)
			} else {
				go func() {
					_ = emailService.SendResetPasswordEmail(input.Body.Email, input.Body.Name, resetURL)
				}()
			}
		}

		u := ManageUserDTO{
			ID:             userID,
			Name:           input.Body.Name,
			Email:          input.Body.Email,
			EmailVerified:  false,
			Role:           role,
			Banned:         false,
			DepartmentID:   &input.Body.DepartmentID,
			DepartmentName: deptName,
			Phone:          input.Body.Phone,
			HasPassword:    hasPassword,
			CreatedAt:      now,
		}

		return &SingleUserOutput{Body: u}, nil
	})

	// Update User (Admin only)
	huma.Register(api, huma.Operation{
		OperationID: "updateUser",
		Method:      http.MethodPut,
		Path:        "/api/users/{id}",
		Summary:     "Update user details, role, department, or ban status",
		Tags:        []string{"Users"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *UpdateUserInput) (*SingleUserOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		// Update fields conditionally
		if input.Body.Role != nil {
			_, _ = pool.Exec(ctx, `UPDATE "user" SET role = $2, updated_at = NOW() WHERE id = $1`, input.ID, *input.Body.Role)
		}
		if input.Body.DepartmentID != nil {
			deptID := *input.Body.DepartmentID
			if deptID == "" {
				_, _ = pool.Exec(ctx, `UPDATE "user" SET department_id = NULL, updated_at = NOW() WHERE id = $1`, input.ID)
			} else {
				_, _ = pool.Exec(ctx, `UPDATE "user" SET department_id = $2, updated_at = NOW() WHERE id = $1`, input.ID, deptID)
			}
		}
		if input.Body.Phone != nil {
			_, _ = pool.Exec(ctx, `UPDATE "user" SET phone = $2, updated_at = NOW() WHERE id = $1`, input.ID, *input.Body.Phone)
		}
		if input.Body.Banned != nil {
			_, _ = pool.Exec(ctx, `UPDATE "user" SET banned = $2, updated_at = NOW() WHERE id = $1`, input.ID, *input.Body.Banned)
		}

		var u ManageUserDTO
		err := pool.QueryRow(ctx, `
			SELECT u.id, u.name, u.email, u.email_verified, u.role, COALESCE(u.banned, FALSE),
			       u.department_id, d.full_name, u.phone, (a.password IS NOT NULL), u.created_at
			FROM "user" u
			LEFT JOIN "departments" d ON d.id = u.department_id
			LEFT JOIN "account" a ON a.user_id = u.id AND a.provider_id = 'credential'
			WHERE u.id = $1
		`, input.ID).Scan(
			&u.ID, &u.Name, &u.Email, &u.EmailVerified, &u.Role, &u.Banned,
			&u.DepartmentID, &u.DepartmentName, &u.Phone, &u.HasPassword, &u.CreatedAt,
		)

		if err != nil {
			return nil, huma.Error404NotFound("user not found")
		}

		return &SingleUserOutput{Body: u}, nil
	})

	// Send Password Reset Email (Admin trigger)
	huma.Register(api, huma.Operation{
		OperationID: "sendPasswordReset",
		Method:      http.MethodPost,
		Path:        "/api/users/{id}/reset-password",
		Summary:     "Send a password setup / reset email to the user",
		Tags:        []string{"Users"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id" doc:"User ID"`
	}) (*struct {
		Body struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
	}, error) {
		if _, err := auth.RequireRoles(ctx, "admin"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		var name, userEmail string
		err := pool.QueryRow(ctx, `SELECT name, email FROM "user" WHERE id = $1`, input.ID).Scan(&name, &userEmail)
		if err != nil {
			return nil, huma.Error404NotFound("user not found")
		}

		token := uuid.New().String()
		verID := uuid.New().String()
		expiresAt := time.Now().Add(1 * time.Hour)

		_, err = pool.Exec(ctx, `
			INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
		`, verID, userEmail, token, expiresAt)
		if err != nil {
			log.Printf("Failed to insert verification token: %v", err)
			return nil, huma.Error500InternalServerError("เกิดข้อผิดพลาดในการสร้างรหัสยืนยัน")
		}

		resetURL := fmt.Sprintf("%s/set-password?token=%s", cfg.AppURL, token)
		if distributor != nil {
			if err := distributor.DistributeTaskSendEmail(ctx, userEmail, name, resetURL); err != nil {
				log.Printf("[Users] Failed to enqueue reset email via Asynq, fallback to sync: %v", err)
				_ = emailService.SendResetPasswordEmail(userEmail, name, resetURL)
			}
		} else {
			if err := emailService.SendResetPasswordEmail(userEmail, name, resetURL); err != nil {
				log.Printf("Failed to send reset email to %s: %v", userEmail, err)
				return nil, huma.Error500InternalServerError("ไม่สามารถส่งอีเมลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง")
			}
		}

		out := &struct {
			Body struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
		}{}
		out.Body.Success = true
		out.Body.Message = "ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านไปยัง " + userEmail + " เรียบร้อยแล้ว"
		return out, nil
	})
}
