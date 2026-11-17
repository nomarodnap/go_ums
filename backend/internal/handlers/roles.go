package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RoleDTO struct {
	ID          string    `json:"id" doc:"Role unique identifier"`
	Name        string    `json:"name" doc:"Thai name of the role"`
	Description string    `json:"description" doc:"Role description"`
	Permissions []string  `json:"permissions" doc:"List of permitted routes/pages"`
	DefaultPath string    `json:"defaultPath" doc:"Default landing page path"`
	IsSystem    bool      `json:"isSystem" doc:"Whether this is a protected system role"`
	UserCount   int       `json:"userCount" doc:"Number of users assigned to this role"`
	CreatedAt   time.Time `json:"createdAt" doc:"Created timestamp"`
	UpdatedAt   time.Time `json:"updatedAt" doc:"Updated timestamp"`
}

type ListRolesOutput struct {
	Body []RoleDTO `json:"body"`
}

type SingleRoleOutput struct {
	Body RoleDTO `json:"body"`
}

type CreateRoleInput struct {
	Body struct {
		Name        string   `json:"name" minLength:"1" maxLength:"100" doc:"Role name (e.g. เจ้าหน้าที่การเงิน)"`
		Description string   `json:"description,omitempty" maxLength:"500" doc:"Role description"`
		Permissions []string `json:"permissions" doc:"List of permitted routes/pages"`
		DefaultPath string   `json:"defaultPath,omitempty" doc:"Default landing page path (e.g. /bills)"`
	}
}

type UpdateRoleInput struct {
	ID   string `path:"id" doc:"Role identifier"`
	Body struct {
		Name        *string   `json:"name,omitempty" minLength:"1" maxLength:"100" doc:"Role name"`
		Description *string   `json:"description,omitempty" maxLength:"500" doc:"Role description"`
		Permissions *[]string `json:"permissions,omitempty" doc:"List of permitted routes/pages"`
		DefaultPath *string   `json:"defaultPath,omitempty" doc:"Default landing page path"`
	}
}

type DeleteRoleInput struct {
	ID string `path:"id" doc:"Role identifier"`
}

type DeleteRoleOutput struct {
	Body struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
}

func generateRoleID() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return fmt.Sprintf("role_%s", hex.EncodeToString(b))
}

func ensureRolesTable(pool *pgxpool.Pool) {
	if pool == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	ddl := `
	ALTER TABLE roles ADD COLUMN IF NOT EXISTS default_path VARCHAR(255) NOT NULL DEFAULT '/dashboard';
	CREATE TABLE IF NOT EXISTS roles (
		id VARCHAR(64) PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		description TEXT DEFAULT '',
		permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
		is_system BOOLEAN NOT NULL DEFAULT false,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	INSERT INTO roles (id, name, description, permissions, is_system)
	VALUES
		('admin', 'ผู้ดูแลระบบ', 'สิทธิ์สูงสุด เข้าถึงและจัดการได้ทุกส่วนของระบบ', '["*"]'::jsonb, true),
		('auditor', 'ผู้ตรวจสอบภายใน (กตน.)', 'สิทธิ์สำหรับตรวจสอบข้อมูล ภาพรวม รายงาน และการแจ้งเตือน', '["/dashboard", "/overview", "/all-bills", "/all-bills:review", "/all-bills:flag", "/services", "/bill-tracking", "/reports", "/reports/budget", "/reports/utility", "/reports/pending", "/all-notifications", "/audits"]'::jsonb, false),
		('central_staff', 'เจ้าหน้าที่ส่วนกลาง', 'สิทธิ์เจ้าหน้าที่ส่วนกลาง ดูแลบิล จัดการหน่วยงานและรายงาน', '["/dashboard", "/bills", "/bills:review", "/all-bills", "/all-bills:review", "/services", "/bill-tracking", "/reports", "/reports/budget", "/reports/utility", "/reports/pending", "/notifications", "/departments"]'::jsonb, false),
		('regional_staff', 'เจ้าหน้าที่ภูมิภาค', 'สิทธิ์เจ้าหน้าที่ภูมิภาค บันทึกบิล ติดตามสถานะและดูรายงาน', '["/dashboard", "/bills", "/services", "/bill-tracking", "/reports", "/reports/budget", "/reports/utility", "/reports/pending", "/notifications"]'::jsonb, false),
		('user', 'ผู้ใช้งานทั่วไป', 'สิทธิ์พื้นฐานสำหรับดูและบันทึกบิลของหน่วยงานตนเอง', '["/dashboard", "/bills", "/services", "/notifications"]'::jsonb, false)
	ON CONFLICT (id) DO NOTHING;

	UPDATE roles SET permissions = permissions || '["/all-bills:review", "/all-bills:flag"]'::jsonb
	WHERE id = 'auditor' AND NOT (permissions ? '/all-bills:review');

	UPDATE roles SET permissions = permissions || '["/bills:review", "/all-bills:review"]'::jsonb
	WHERE id = 'central_staff' AND NOT (permissions ? '/bills:review');
	`
	_, _ = pool.Exec(ctx, ddl)
}

// HasRolePermission checks if the role has any of the requested permissions or wildcard '*'
func HasRolePermission(ctx context.Context, pool *pgxpool.Pool, role string, perms ...string) bool {
	if role == "admin" {
		return true
	}
	if pool == nil || role == "" || len(perms) == 0 {
		return false
	}
	var hasPerm bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM roles
			WHERE id = $1
			  AND (permissions ? '*' OR permissions ?| $2)
		)
	`, role, perms).Scan(&hasPerm)
	return err == nil && hasPerm
}

func RegisterRoleRoutes(api huma.API, pool *pgxpool.Pool) {
	ensureRolesTable(pool)

	// 1. List Roles
	huma.Register(api, huma.Operation{
		OperationID: "listRoles",
		Method:      http.MethodGet,
		Path:        "/api/v1/roles",
		Summary:     "List all roles",
		Description: "Returns all roles including system and custom roles with their permissions and user counts.",
		Tags:        []string{"Roles"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct{}) (*ListRolesOutput, error) {
		if pool == nil {
			return &ListRolesOutput{Body: []RoleDTO{}}, nil
		}

		rows, err := pool.Query(ctx, `
			SELECT r.id, r.name, COALESCE(r.description, ''), r.permissions::text, COALESCE(r.default_path, '/dashboard'), r.is_system,
			       COUNT(u.id) AS user_count, r.created_at, r.updated_at
			FROM roles r
			LEFT JOIN "user" u ON u.role = r.id
			GROUP BY r.id, r.name, r.description, r.permissions, r.default_path, r.is_system, r.created_at, r.updated_at
			ORDER BY r.is_system DESC, r.created_at ASC
		`)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list roles: " + err.Error())
		}
		defer rows.Close()

		var roles []RoleDTO
		for rows.Next() {
			var r RoleDTO
			var permBytes []byte
			if err := rows.Scan(&r.ID, &r.Name, &r.Description, &permBytes, &r.DefaultPath, &r.IsSystem, &r.UserCount, &r.CreatedAt, &r.UpdatedAt); err != nil {
				continue
			}
			r.Permissions = []string{}
			if len(permBytes) > 0 {
				_ = json.Unmarshal(permBytes, &r.Permissions)
			}
			roles = append(roles, r)
		}

		if roles == nil {
			roles = []RoleDTO{}
		}

		return &ListRolesOutput{Body: roles}, nil
	})

	// 2. Create Custom Role
	huma.Register(api, huma.Operation{
		OperationID: "createRole",
		Method:      http.MethodPost,
		Path:        "/api/v1/roles",
		Summary:     "Create a new custom role",
		Description: "Create a new role with specific page-level permissions.",
		Tags:        []string{"Roles"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *CreateRoleInput) (*SingleRoleOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		name := strings.TrimSpace(input.Body.Name)
		if name == "" {
			return nil, huma.Error400BadRequest("role name is required")
		}

		id := generateRoleID()
		perms := input.Body.Permissions
		if perms == nil {
			perms = []string{}
		}
		permBytes, err := json.Marshal(perms)
		if err != nil {
			permBytes = []byte("[]")
		}

		defaultPath := strings.TrimSpace(input.Body.DefaultPath)
		if defaultPath == "" {
			if len(perms) > 0 {
				defaultPath = perms[0]
			} else {
				defaultPath = "/dashboard"
			}
		}

		now := time.Now()
		var created RoleDTO
		var returnedPermBytes []byte
		err = pool.QueryRow(ctx, `
			INSERT INTO roles (id, name, description, permissions, default_path, is_system, created_at, updated_at)
			VALUES ($1, $2, $3, $4::jsonb, $5, false, $6, $6)
			RETURNING id, name, COALESCE(description, ''), permissions::text, COALESCE(default_path, '/dashboard'), is_system, created_at, updated_at
		`, id, name, input.Body.Description, string(permBytes), defaultPath, now).Scan(
			&created.ID, &created.Name, &created.Description, &returnedPermBytes, &created.DefaultPath, &created.IsSystem, &created.CreatedAt, &created.UpdatedAt,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create role: " + err.Error())
		}

		created.Permissions = []string{}
		if len(returnedPermBytes) > 0 {
			_ = json.Unmarshal(returnedPermBytes, &created.Permissions)
		}
		created.UserCount = 0

		return &SingleRoleOutput{Body: created}, nil
	})

	// 3. Update Role
	huma.Register(api, huma.Operation{
		OperationID: "updateRole",
		Method:      http.MethodPut,
		Path:        "/api/v1/roles/{id}",
		Summary:     "Update role name, description, or permissions",
		Description: "Update permissions and details for an existing role.",
		Tags:        []string{"Roles"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *UpdateRoleInput) (*SingleRoleOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		// Check if role exists
		var isSystem bool
		var existingPerms []byte
		err := pool.QueryRow(ctx, `SELECT is_system, permissions::text FROM roles WHERE id = $1`, input.ID).Scan(&isSystem, &existingPerms)
		if err != nil {
			return nil, huma.Error404NotFound("role not found")
		}

		now := time.Now()
		if input.Body.Name != nil {
			trimmedName := strings.TrimSpace(*input.Body.Name)
			if trimmedName != "" {
				_, _ = pool.Exec(ctx, `UPDATE roles SET name = $2, updated_at = $3 WHERE id = $1`, input.ID, trimmedName, now)
			}
		}

		if input.Body.Description != nil {
			_, _ = pool.Exec(ctx, `UPDATE roles SET description = $2, updated_at = $3 WHERE id = $1`, input.ID, *input.Body.Description, now)
		}

		if input.Body.DefaultPath != nil {
			trimmedPath := strings.TrimSpace(*input.Body.DefaultPath)
			if trimmedPath != "" {
				_, _ = pool.Exec(ctx, `UPDATE roles SET default_path = $2, updated_at = $3 WHERE id = $1`, input.ID, trimmedPath, now)
			}
		}

		if input.Body.Permissions != nil {
			perms := *input.Body.Permissions
			// System admin role always retains wildcard access
			if input.ID == "admin" {
				hasWildcard := false
				for _, p := range perms {
					if p == "*" {
						hasWildcard = true
						break
					}
				}
				if !hasWildcard {
					perms = append([]string{"*"}, perms...)
				}
			}
			permBytes, _ := json.Marshal(perms)
			_, _ = pool.Exec(ctx, `UPDATE roles SET permissions = $2::jsonb, updated_at = $3 WHERE id = $1`, input.ID, string(permBytes), now)
		}

		var updated RoleDTO
		var returnedPermBytes []byte
		err = pool.QueryRow(ctx, `
			SELECT r.id, r.name, COALESCE(r.description, ''), r.permissions::text, COALESCE(r.default_path, '/dashboard'), r.is_system,
			       COUNT(u.id) AS user_count, r.created_at, r.updated_at
			FROM roles r
			LEFT JOIN "user" u ON u.role = r.id
			WHERE r.id = $1
			GROUP BY r.id, r.name, r.description, r.permissions, r.default_path, r.is_system, r.created_at, r.updated_at
		`, input.ID).Scan(
			&updated.ID, &updated.Name, &updated.Description, &returnedPermBytes, &updated.DefaultPath, &updated.IsSystem, &updated.UserCount, &updated.CreatedAt, &updated.UpdatedAt,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch updated role: " + err.Error())
		}

		updated.Permissions = []string{}
		if len(returnedPermBytes) > 0 {
			_ = json.Unmarshal(returnedPermBytes, &updated.Permissions)
		}

		return &SingleRoleOutput{Body: updated}, nil
	})

	// 4. Delete Role
	huma.Register(api, huma.Operation{
		OperationID: "deleteRole",
		Method:      http.MethodDelete,
		Path:        "/api/v1/roles/{id}",
		Summary:     "Delete custom role",
		Description: "Deletes a role if it is not a system role and has no active users assigned.",
		Tags:        []string{"Roles"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *DeleteRoleInput) (*DeleteRoleOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		var isSystem bool
		err := pool.QueryRow(ctx, `SELECT is_system FROM roles WHERE id = $1`, input.ID).Scan(&isSystem)
		if err != nil {
			return nil, huma.Error404NotFound("role not found")
		}

		if isSystem {
			return nil, huma.Error400BadRequest("ไม่สามารถลบบทบาทของระบบ (System Role) ได้")
		}

		var userCount int
		_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM "user" WHERE role = $1`, input.ID).Scan(&userCount)
		if userCount > 0 {
			return nil, huma.Error400BadRequest(fmt.Sprintf("ไม่สามารถลบบทบาทนี้ได้เนื่องจากมีผู้ใช้งานในระบบจำนวน %d คนกำลังใช้งานอยู่", userCount))
		}

		_, err = pool.Exec(ctx, `DELETE FROM roles WHERE id = $1`, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete role: " + err.Error())
		}

		out := &DeleteRoleOutput{}
		out.Body.Success = true
		out.Body.Message = "ลบบทบาทเรียบร้อยแล้ว"
		return out, nil
	})
}

