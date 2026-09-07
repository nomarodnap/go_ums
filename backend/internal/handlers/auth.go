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
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserDTO struct {
	ID             string    `json:"id" doc:"User unique ID"`
	Name           string    `json:"name" doc:"Full name"`
	Email          string    `json:"email" doc:"Email address"`
	Role           string    `json:"role" doc:"User role: admin, auditor, strategy_finance, central_staff, regional_staff, user"`
	DepartmentID   *string   `json:"departmentId,omitempty" doc:"Associated department ID"`
	DepartmentName *string   `json:"departmentName,omitempty" doc:"Associated department full name"`
	Phone          *string   `json:"phone,omitempty" doc:"Phone number"`
	CreatedAt      time.Time `json:"createdAt" doc:"Account creation timestamp"`
}

type LoginInput struct {
	Body struct {
		Email    string `json:"email" format:"email" doc:"Email address" example:"admin@fisheries.go.th"`
		Password string `json:"password" minLength:"6" doc:"Password" example:"password123"`
	}
}

type LoginOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Token string  `json:"token" doc:"JWT Bearer token"`
		User  UserDTO `json:"user" doc:"Authenticated user details"`
	}
}

type MeOutput struct {
	Body struct {
		User UserDTO `json:"user" doc:"Current authenticated user details"`
	}
}

type LogoutOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Success bool `json:"success"`
	}
}

func RegisterAuthRoutes(api huma.API, pool *pgxpool.Pool, cfg *config.Config, emailService *email.EmailService) {
	// Ensure verification table exists
	_, _ = pool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS verification (
			id text PRIMARY KEY,
			identifier text NOT NULL,
			value text NOT NULL,
			expires_at timestamp NOT NULL,
			created_at timestamp DEFAULT NOW(),
			updated_at timestamp DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_verification_value ON verification (value);
	`)

	// Login
	huma.Register(api, huma.Operation{
		OperationID: "login",
		Method:      http.MethodPost,
		Path:        "/api/auth/login",
		Summary:     "User login",
		Description: "Authenticate with email and password to receive a JWT token and session cookie.",
		Tags:        []string{"Auth"},
	}, func(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
		var id, name, email, role string
		var passwordHash, departmentID, departmentName, phone *string
		var banned *bool
		var createdAt time.Time

		err := pool.QueryRow(ctx, `
			SELECT u.id, u.name, u.email, a.password, u.role, u.department_id, d.full_name, u.phone, u.banned, u.created_at 
			FROM "user" u
			LEFT JOIN "account" a ON a.user_id = u.id AND a.provider_id = 'credential'
			LEFT JOIN "departments" d ON d.id = u.department_id
			WHERE LOWER(u.email) = LOWER($1)
			LIMIT 1
		`, input.Body.Email).Scan(&id, &name, &email, &passwordHash, &role, &departmentID, &departmentName, &phone, &banned, &createdAt)

		if err != nil {
			return nil, huma.Error401Unauthorized("invalid email or password")
		}

		if banned != nil && *banned {
			return nil, huma.Error403Forbidden("account is suspended")
		}

		if passwordHash == nil || !auth.CheckPasswordHash(input.Body.Password, *passwordHash) {
			return nil, huma.Error401Unauthorized("invalid email or password")
		}

		deptIDStr := ""
		if departmentID != nil {
			deptIDStr = *departmentID
		}

		token, err := auth.GenerateToken(id, email, name, role, deptIDStr, cfg.JWTSecret)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to generate token")
		}

		out := &LoginOutput{}
		out.Body.Token = token
		out.Body.User = UserDTO{
			ID:             id,
			Name:           name,
			Email:          email,
			Role:           role,
			DepartmentID:   departmentID,
			DepartmentName: departmentName,
			Phone:          phone,
			CreatedAt:      createdAt,
		}
		out.SetCookie = http.Cookie{
			Name:     "auth_token",
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   86400,
		}
		return out, nil
	})

	// Get Current User (Me)
	huma.Register(api, huma.Operation{
		OperationID: "getCurrentUser",
		Method:      http.MethodGet,
		Path:        "/api/auth/me",
		Summary:     "Get current user profile",
		Tags:        []string{"Auth"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct{}) (*MeOutput, error) {
		claims, ok := auth.UserFromContext(ctx)
		if !ok || claims == nil {
			return nil, huma.Error401Unauthorized("unauthorized")
		}

		var id, name, email, role string
		var departmentID, departmentName, phone *string
		var createdAt time.Time

		err := pool.QueryRow(ctx, `
			SELECT u.id, u.name, u.email, u.role, u.department_id, d.full_name, u.phone, u.created_at 
			FROM "user" u
			LEFT JOIN "departments" d ON d.id = u.department_id
			WHERE u.id = $1 LIMIT 1
		`, claims.UserID).Scan(&id, &name, &email, &role, &departmentID, &departmentName, &phone, &createdAt)

		if err != nil {
			return nil, huma.Error404NotFound("user not found")
		}

		out := &MeOutput{}
		out.Body.User = UserDTO{
			ID:             id,
			Name:           name,
			Email:          email,
			Role:           role,
			DepartmentID:   departmentID,
			DepartmentName: departmentName,
			Phone:          phone,
			CreatedAt:      createdAt,
		}
		return out, nil
	})

	// Logout
	huma.Register(api, huma.Operation{
		OperationID: "logout",
		Method:      http.MethodPost,
		Path:        "/api/auth/logout",
		Summary:     "User logout",
		Tags:        []string{"Auth"},
	}, func(ctx context.Context, input *struct{}) (*LogoutOutput, error) {
		out := &LogoutOutput{}
		out.Body.Success = true
		out.SetCookie = http.Cookie{
			Name:     "auth_token",
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			MaxAge:   -1,
		}
		return out, nil
	})

	// Forgot Password
	huma.Register(api, huma.Operation{
		OperationID: "forgotPassword",
		Method:      http.MethodPost,
		Path:        "/api/auth/forgot-password",
		Summary:     "Request password reset link",
		Tags:        []string{"Auth"},
	}, func(ctx context.Context, input *struct {
		Body struct {
			Email string `json:"email" format:"email" doc:"User email address" example:"admin@fisheries.go.th"`
		}
	}) (*struct {
		Body struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
	}, error) {
		var id, name, userEmail string
		err := pool.QueryRow(ctx, `SELECT id, name, email FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1`, input.Body.Email).Scan(&id, &name, &userEmail)
		if err != nil {
			return nil, huma.Error404NotFound("ไม่พบอีเมลนี้ในระบบ")
		}

		token := uuid.New().String()
		verID := uuid.New().String()
		expiresAt := time.Now().Add(1 * time.Hour)

		// Save token to verification table
		_, err = pool.Exec(ctx, `
			INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
		`, verID, userEmail, token, expiresAt)
		if err != nil {
			log.Printf("Failed to insert verification token: %v", err)
			return nil, huma.Error500InternalServerError("เกิดข้อผิดพลาดในการสร้างรหัสยืนยัน")
		}

		resetURL := fmt.Sprintf("%s/set-password?token=%s", cfg.AppURL, token)
		if err := emailService.SendResetPasswordEmail(userEmail, name, resetURL); err != nil {
			log.Printf("Failed to send reset email to %s: %v", userEmail, err)
			return nil, huma.Error500InternalServerError("ไม่สามารถส่งอีเมลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง")
		}

		out := &struct {
			Body struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
		}{}
		out.Body.Success = true
		out.Body.Message = "เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านไปที่อีเมลเรียบร้อยแล้ว"
		return out, nil
	})

	// Reset Password
	huma.Register(api, huma.Operation{
		OperationID: "resetPassword",
		Method:      http.MethodPost,
		Path:        "/api/auth/reset-password",
		Summary:     "Reset or set new password with token",
		Tags:        []string{"Auth"},
	}, func(ctx context.Context, input *struct {
		Body struct {
			Token    string `json:"token" minLength:"1" doc:"Password reset token"`
			Password string `json:"password" minLength:"8" doc:"New password (min 8 chars)"`
		}
	}) (*struct {
		Body struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
	}, error) {
		var verID, identifier string
		var expiresAt time.Time

		err := pool.QueryRow(ctx, `
			SELECT id, identifier, expires_at 
			FROM verification 
			WHERE value = $1 
			LIMIT 1
		`, input.Body.Token).Scan(&verID, &identifier, &expiresAt)

		if err != nil {
			return nil, huma.Error400BadRequest("ลิงก์สำหรับตั้งรหัสผ่านไม่ถูกต้อง หรือถูกใช้งานไปแล้ว")
		}

		if expiresAt.Before(time.Now()) {
			_, _ = pool.Exec(ctx, `DELETE FROM verification WHERE id = $1`, verID)
			return nil, huma.Error400BadRequest("ลิงก์สำหรับตั้งรหัสผ่านหมดอายุแล้ว กรุณาส่งคำขอใหม่อีกครั้ง")
		}

		var userID string
		err = pool.QueryRow(ctx, `SELECT id FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1`, identifier).Scan(&userID)
		if err != nil {
			return nil, huma.Error404NotFound("ไม่พบบัญชีผู้ใช้งานในระบบ")
		}

		hashedPassword, err := auth.HashPassword(input.Body.Password)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to hash password")
		}

		// Update or insert account record
		var accountID string
		err = pool.QueryRow(ctx, `SELECT id FROM "account" WHERE user_id = $1 AND provider_id = 'credential' LIMIT 1`, userID).Scan(&accountID)
		if err != nil {
			newAccountID := uuid.New().String()
			_, err = pool.Exec(ctx, `
				INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
				VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())
			`, newAccountID, userID, userID, hashedPassword)
			if err != nil {
				log.Printf("Failed to insert account: %v", err)
				return nil, huma.Error500InternalServerError("เกิดข้อผิดพลาดในการบันทึกรหัสผ่าน")
			}
		} else {
			_, err = pool.Exec(ctx, `
				UPDATE "account" 
				SET password = $1, updated_at = NOW() 
				WHERE id = $2
			`, hashedPassword, accountID)
			if err != nil {
				log.Printf("Failed to update account password: %v", err)
				return nil, huma.Error500InternalServerError("เกิดข้อผิดพลาดในการบันทึกรหัสผ่าน")
			}
		}

		// Mark email verified
		_, _ = pool.Exec(ctx, `UPDATE "user" SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`, userID)

		// Delete used verification token
		_, _ = pool.Exec(ctx, `DELETE FROM verification WHERE id = $1`, verID)

		out := &struct {
			Body struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
		}{}
		out.Body.Success = true
		out.Body.Message = "ตั้งรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
		return out, nil
	})
}
