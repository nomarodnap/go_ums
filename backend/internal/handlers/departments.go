package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func isTenDigits(s string) bool {
	if len(s) != 10 {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}


type DepartmentDTO struct {
	ID                string    `json:"id"`
	CostCenterCode    *string   `json:"costCenterCode,omitempty"`
	DisbursingUnit    *string   `json:"disbursingUnit,omitempty"`
	DepositUnit       *string   `json:"depositUnit,omitempty"`
	FullName          string    `json:"fullName"`
	ShortName         *string   `json:"shortName,omitempty"`
	Division          *string   `json:"division,omitempty"`
	Location          *string   `json:"location,omitempty"`
	Province          *string   `json:"province,omitempty"`
	ResponsiblePerson *string   `json:"responsiblePerson,omitempty"`
	Phone             *string   `json:"phone,omitempty"`
	ResponsiblePhone  *string   `json:"responsiblePhone,omitempty"`
	Email             *string    `json:"email,omitempty"`
	Type              *string    `json:"type,omitempty"`
	IsActive          bool       `json:"isActive,omitempty"`
	SuspendedAt       *time.Time `json:"suspendedAt,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

type DepartmentServiceDTO struct {
	ID                      string    `json:"id"`
	DepartmentID            string    `json:"departmentId"`
	DepartmentName          *string   `json:"departmentName,omitempty"`
	UtilityType             string    `json:"utilityType"`
	Provider                string    `json:"provider"`
	ServiceNumber           string    `json:"serviceNumber"`
	LocationType            *string   `json:"locationType,omitempty"`
	PhoneOwnerName          *string   `json:"phoneOwnerName,omitempty"`
	PhoneOwnerPosition      *string   `json:"phoneOwnerPosition,omitempty"`
	PhoneOwnerDivision      *string   `json:"phoneOwnerDivision,omitempty"`
	PhoneReimbursementLimit *int       `json:"phoneReimbursementLimit,omitempty"`
	IsActive                bool       `json:"isActive"`
	SuspendedAt             *time.Time `json:"suspendedAt,omitempty"`
	CreatedAt               time.Time  `json:"createdAt"`
}

type ListDepartmentsOutput struct {
	Body []DepartmentDTO `json:"body"`
}

type ListDepartmentServicesOutput struct {
	Body []DepartmentServiceDTO `json:"body"`
}

type CreateDepartmentServiceInput struct {
	Body struct {
		DepartmentID            string  `json:"departmentId"`
		UtilityType             string  `json:"utilityType"`
		Provider                string  `json:"provider"`
		ServiceNumber           string  `json:"serviceNumber"`
		LocationType            *string `json:"locationType,omitempty"`
		PhoneOwnerName          *string `json:"phoneOwnerName,omitempty"`
		PhoneOwnerPosition      *string `json:"phoneOwnerPosition,omitempty"`
		PhoneOwnerDivision      *string `json:"phoneOwnerDivision,omitempty"`
		PhoneReimbursementLimit *int    `json:"phoneReimbursementLimit,omitempty"`
		IsActive                *bool   `json:"isActive,omitempty"`
	}
}

type UpdateDepartmentServiceInput struct {
	ID   string `path:"id" doc:"Service ID"`
	Body struct {
		DepartmentID            string  `json:"departmentId"`
		UtilityType             string  `json:"utilityType"`
		Provider                string  `json:"provider"`
		ServiceNumber           string  `json:"serviceNumber"`
		LocationType            *string `json:"locationType,omitempty"`
		PhoneOwnerName          *string `json:"phoneOwnerName,omitempty"`
		PhoneOwnerPosition      *string `json:"phoneOwnerPosition,omitempty"`
		PhoneOwnerDivision      *string `json:"phoneOwnerDivision,omitempty"`
		PhoneReimbursementLimit *int    `json:"phoneReimbursementLimit,omitempty"`
		IsActive                *bool   `json:"isActive,omitempty"`
	}
}

type SingleDepartmentServiceOutput struct {
	Body DepartmentServiceDTO `json:"body"`
}

type CreateDepartmentInput struct {
	Body struct {
		CostCenterCode    *string `json:"costCenterCode,omitempty"`
		DisbursingUnit    *string `json:"disbursingUnit,omitempty"`
		DepositUnit       *string `json:"depositUnit,omitempty"`
		FullName          string  `json:"fullName"`
		ShortName         *string `json:"shortName,omitempty"`
		Division          *string `json:"division,omitempty"`
		Location          *string `json:"location,omitempty"`
		Province          *string `json:"province,omitempty"`
		ResponsiblePerson *string `json:"responsiblePerson,omitempty"`
		Phone             *string `json:"phone,omitempty"`
		ResponsiblePhone  *string `json:"responsiblePhone,omitempty"`
		Email             *string `json:"email,omitempty"`
		Type              *string `json:"type,omitempty"`
	}
}

type UpdateDepartmentInput struct {
	ID   string `path:"id" doc:"Department ID"`
	Body struct {
		CostCenterCode    *string `json:"costCenterCode,omitempty"`
		DisbursingUnit    *string `json:"disbursingUnit,omitempty"`
		DepositUnit       *string `json:"depositUnit,omitempty"`
		FullName          string  `json:"fullName"`
		ShortName         *string `json:"shortName,omitempty"`
		Division          *string `json:"division,omitempty"`
		Location          *string `json:"location,omitempty"`
		Province          *string `json:"province,omitempty"`
		ResponsiblePerson *string `json:"responsiblePerson,omitempty"`
		Phone             *string `json:"phone,omitempty"`
		ResponsiblePhone  *string `json:"responsiblePhone,omitempty"`
		Email             *string `json:"email,omitempty"`
		Type              *string `json:"type,omitempty"`
	}
}

type SingleDepartmentOutput struct {
	Body DepartmentDTO `json:"body"`
}


func RegisterDepartmentRoutes(api huma.API, pool *pgxpool.Pool) {
	// List Departments
	huma.Register(api, huma.Operation{
		OperationID: "listDepartments",
		Method:      http.MethodGet,
		Path:        "/api/departments",
		Summary:     "List all departments",
		Tags:        []string{"Departments"},
	}, func(ctx context.Context, input *struct{}) (*ListDepartmentsOutput, error) {
		rows, err := pool.Query(ctx, `
			SELECT id, cost_center_code, disbursing_unit, deposit_unit, full_name, short_name,
			       division, location, province, responsible_person, phone, responsible_phone,
			       email, type, COALESCE(is_active, TRUE), suspended_at, created_at, updated_at
			FROM departments ORDER BY full_name ASC
		`)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch departments")
		}
		defer rows.Close()

		results := make([]DepartmentDTO, 0)
		for rows.Next() {
			var d DepartmentDTO
			if err := rows.Scan(
				&d.ID, &d.CostCenterCode, &d.DisbursingUnit, &d.DepositUnit, &d.FullName, &d.ShortName,
				&d.Division, &d.Location, &d.Province, &d.ResponsiblePerson, &d.Phone, &d.ResponsiblePhone,
				&d.Email, &d.Type, &d.IsActive, &d.SuspendedAt, &d.CreatedAt, &d.UpdatedAt,
			); err == nil {
				results = append(results, d)
			}
		}

		out := &ListDepartmentsOutput{Body: results}
		return out, nil
	})

	// List Services
	huma.Register(api, huma.Operation{
		OperationID: "listDepartmentServices",
		Method:      http.MethodGet,
		Path:        "/api/departments/services",
		Summary:     "List all department services",
		Tags:        []string{"Departments"},
	}, func(ctx context.Context, input *struct {
		DepartmentID string `query:"departmentId" doc:"Optional filter by department ID"`
		Status       string `query:"status" doc:"Optional filter by status: 'active', 'inactive', or 'all'"`
	}) (*ListDepartmentServicesOutput, error) {
		query := `
			SELECT ds.id, ds.department_id, ds.utility_type, ds.provider, ds.service_number, ds.location_type,
			       ds.phone_owner_name, ds.phone_owner_position, ds.phone_owner_division, ds.phone_reimbursement_limit, COALESCE(ds.is_active, TRUE), ds.suspended_at, ds.created_at,
			       d.full_name
			FROM department_services ds
			LEFT JOIN departments d ON ds.department_id = d.id
		`
		var args []interface{}
		var conditions []string

		if input.DepartmentID != "" {
			args = append(args, input.DepartmentID)
			conditions = append(conditions, fmt.Sprintf("ds.department_id = $%d", len(args)))
		}
		if input.Status == "active" {
			conditions = append(conditions, "ds.is_active = TRUE")
		} else if input.Status == "inactive" {
			conditions = append(conditions, "ds.is_active = FALSE")
		}
		if len(conditions) > 0 {
			query += " WHERE " + strings.Join(conditions, " AND ")
		}
		query += " ORDER BY ds.utility_type, ds.service_number ASC"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch services")
		}
		defer rows.Close()

		results := make([]DepartmentServiceDTO, 0)
		for rows.Next() {
			var s DepartmentServiceDTO
			if err := rows.Scan(
				&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.LocationType,
				&s.PhoneOwnerName, &s.PhoneOwnerPosition, &s.PhoneOwnerDivision, &s.PhoneReimbursementLimit, &s.IsActive, &s.SuspendedAt, &s.CreatedAt,
				&s.DepartmentName,
			); err == nil {
				results = append(results, s)
			}
		}

		return &ListDepartmentServicesOutput{Body: results}, nil
	})

	// Create Department Service
	huma.Register(api, huma.Operation{
		OperationID: "createDepartmentService",
		Method:      http.MethodPost,
		Path:        "/api/departments/services",
		Summary:     "Create a department service entry (e.g. meter number, phone line)",
		Tags:        []string{"Departments"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *CreateDepartmentServiceInput) (*SingleDepartmentServiceOutput, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "strategy_finance", "auditor", "user")
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}
		if user.Role != "admin" && user.Role != "central_staff" {
			if input.Body.DepartmentID != user.DepartmentID {
				return nil, huma.Error403Forbidden("คุณสามารถเพิ่มหมายเลขผู้ใช้ได้เฉพาะหน่วยงานของตนเองเท่านั้น")
			}
		}

		isActive := true
		if input.Body.IsActive != nil {
			isActive = *input.Body.IsActive
		}

		cleanServiceNumber := strings.TrimSpace(input.Body.ServiceNumber)
		if cleanServiceNumber == "" {
			return nil, huma.Error400BadRequest("กรุณาระบุรหัสเครื่องวัด / หมายเลขผู้ใช้")
		}

		// Check if service_number already exists in the system (case-insensitive)
		var existingID, existingDeptName, existingUtility string
		err = pool.QueryRow(ctx, `
			SELECT ds.id, COALESCE(d.full_name, ''), ds.utility_type
			FROM department_services ds
			LEFT JOIN departments d ON d.id = ds.department_id
			WHERE UPPER(TRIM(ds.service_number)) = UPPER($1)
			LIMIT 1
		`, cleanServiceNumber).Scan(&existingID, &existingDeptName, &existingUtility)
		if err == nil {
			errMsg := fmt.Sprintf("รหัสเครื่องวัด / หมายเลขผู้ใช้ '%s' มีบันทึกในระบบแล้ว", cleanServiceNumber)
			if existingDeptName != "" {
				errMsg += fmt.Sprintf(" (หน่วยงาน: %s)", existingDeptName)
			}
			return nil, huma.Error400BadRequest(errMsg)
		}

		serviceID := uuid.New().String()
		var s DepartmentServiceDTO
		var suspendedAt *time.Time
		if !isActive {
			now := time.Now()
			suspendedAt = &now
		}

		err = pool.QueryRow(ctx, `
			INSERT INTO department_services (
				id, department_id, utility_type, provider, service_number,
				location_type, phone_owner_name, phone_owner_position, phone_owner_division, phone_reimbursement_limit,
				is_active, suspended_at, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
			) RETURNING id, department_id, utility_type, provider, service_number, location_type,
			            phone_owner_name, phone_owner_position, phone_owner_division, phone_reimbursement_limit, is_active, suspended_at, created_at
		`, serviceID, input.Body.DepartmentID, input.Body.UtilityType, input.Body.Provider, cleanServiceNumber,
			input.Body.LocationType, input.Body.PhoneOwnerName, input.Body.PhoneOwnerPosition, input.Body.PhoneOwnerDivision, input.Body.PhoneReimbursementLimit,
			isActive, suspendedAt,
		).Scan(
			&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.LocationType,
			&s.PhoneOwnerName, &s.PhoneOwnerPosition, &s.PhoneOwnerDivision, &s.PhoneReimbursementLimit, &s.IsActive, &s.SuspendedAt, &s.CreatedAt,
		)

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create department service")
		}

		_ = pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", s.DepartmentID).Scan(&s.DepartmentName)

		return &SingleDepartmentServiceOutput{Body: s}, nil
	})

	// Update Department Service
	huma.Register(api, huma.Operation{
		OperationID: "updateDepartmentService",
		Method:      http.MethodPut,
		Path:        "/api/departments/services/{id}",
		Summary:     "Update a department service",
		Tags:        []string{"Departments"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *UpdateDepartmentServiceInput) (*SingleDepartmentServiceOutput, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "strategy_finance", "auditor", "user")
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}
		if user.Role != "admin" && user.Role != "central_staff" {
			var currentDeptID string
			_ = pool.QueryRow(ctx, "SELECT department_id FROM department_services WHERE id = $1", input.ID).Scan(&currentDeptID)
			if currentDeptID != user.DepartmentID || input.Body.DepartmentID != user.DepartmentID {
				return nil, huma.Error403Forbidden("คุณสามารถแก้ไขได้เฉพาะหมายเลขผู้ใช้ของหน่วยงานของตนเองเท่านั้น")
			}
		}

		cleanServiceNumber := strings.TrimSpace(input.Body.ServiceNumber)
		if cleanServiceNumber == "" {
			return nil, huma.Error400BadRequest("กรุณาระบุรหัสเครื่องวัด / หมายเลขผู้ใช้")
		}

		// Check if service_number already exists in another service entry (case-insensitive)
		var existingID, existingDeptName, existingUtility string
		err = pool.QueryRow(ctx, `
			SELECT ds.id, COALESCE(d.full_name, ''), ds.utility_type
			FROM department_services ds
			LEFT JOIN departments d ON d.id = ds.department_id
			WHERE UPPER(TRIM(ds.service_number)) = UPPER($1) AND ds.id != $2
			LIMIT 1
		`, cleanServiceNumber, input.ID).Scan(&existingID, &existingDeptName, &existingUtility)
		if err == nil {
			errMsg := fmt.Sprintf("รหัสเครื่องวัด / หมายเลขผู้ใช้ '%s' มีบันทึกในระบบแล้ว", cleanServiceNumber)
			if existingDeptName != "" {
				errMsg += fmt.Sprintf(" (หน่วยงาน: %s)", existingDeptName)
			}
			return nil, huma.Error400BadRequest(errMsg)
		}

		var s DepartmentServiceDTO
		err = pool.QueryRow(ctx, `
			UPDATE department_services
			SET department_id = $2, utility_type = $3, provider = $4, service_number = $5,
			    location_type = $6, phone_owner_name = $7, phone_owner_position = $8, phone_owner_division = $9,
			    phone_reimbursement_limit = $10,
			    is_active = COALESCE($11, is_active),
			    suspended_at = CASE 
			        WHEN $11 IS NULL THEN suspended_at
			        WHEN $11 = FALSE AND is_active = TRUE THEN NOW()
			        WHEN $11 = TRUE THEN NULL
			        ELSE suspended_at
			    END,
			    updated_at = NOW()
			WHERE id = $1
			RETURNING id, department_id, utility_type, provider, service_number, location_type,
			          phone_owner_name, phone_owner_position, phone_owner_division, phone_reimbursement_limit, is_active, suspended_at, created_at
		`, input.ID, input.Body.DepartmentID, input.Body.UtilityType, input.Body.Provider, cleanServiceNumber,
			input.Body.LocationType, input.Body.PhoneOwnerName, input.Body.PhoneOwnerPosition, input.Body.PhoneOwnerDivision, input.Body.PhoneReimbursementLimit,
			input.Body.IsActive,
		).Scan(
			&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.LocationType,
			&s.PhoneOwnerName, &s.PhoneOwnerPosition, &s.PhoneOwnerDivision, &s.PhoneReimbursementLimit, &s.IsActive, &s.SuspendedAt, &s.CreatedAt,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update service")
		}

		_ = pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", s.DepartmentID).Scan(&s.DepartmentName)

		return &SingleDepartmentServiceOutput{Body: s}, nil
	})

	// Toggle Department Service Status (ระงับการใช้งาน / ปลดระงับ)
	huma.Register(api, huma.Operation{
		OperationID: "toggleDepartmentServiceStatus",
		Method:      http.MethodPost,
		Path:        "/api/departments/services/{id}/toggle-status",
		Summary:     "Toggle active status of a department service (ระงับการใช้งาน / ปลดระงับ)",
		Tags:        []string{"Departments"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID   string `path:"id" doc:"Service ID"`
		Body struct {
			IsActive *bool `json:"isActive,omitempty"`
		}
	}) (*SingleDepartmentServiceOutput, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "strategy_finance", "auditor", "user")
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}
		if user.Role != "admin" && user.Role != "central_staff" {
			var currentDeptID string
			_ = pool.QueryRow(ctx, "SELECT department_id FROM department_services WHERE id = $1", input.ID).Scan(&currentDeptID)
			if currentDeptID != user.DepartmentID {
				return nil, huma.Error403Forbidden("คุณสามารถเปลี่ยนสถานะได้เฉพาะหมายเลขผู้ใช้ของหน่วยงานของตนเองเท่านั้น")
			}
		}

		var s DepartmentServiceDTO
		var updateQuery string
		var queryErr error

		if input.Body.IsActive != nil {
			targetActive := *input.Body.IsActive
			updateQuery = `
				UPDATE department_services
				SET is_active = $2,
				    suspended_at = CASE WHEN $2 = FALSE THEN NOW() ELSE NULL END,
				    updated_at = NOW()
				WHERE id = $1
				RETURNING id, department_id, utility_type, provider, service_number, location_type,
				          phone_owner_name, phone_owner_position, phone_owner_division, phone_reimbursement_limit, is_active, suspended_at, created_at
			`
			queryErr = pool.QueryRow(ctx, updateQuery, input.ID, targetActive).Scan(
				&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.LocationType,
				&s.PhoneOwnerName, &s.PhoneOwnerPosition, &s.PhoneOwnerDivision, &s.PhoneReimbursementLimit, &s.IsActive, &s.SuspendedAt, &s.CreatedAt,
			)
		} else {
			updateQuery = `
				UPDATE department_services
				SET is_active = NOT is_active,
				    suspended_at = CASE WHEN is_active = TRUE THEN NOW() ELSE NULL END,
				    updated_at = NOW()
				WHERE id = $1
				RETURNING id, department_id, utility_type, provider, service_number, location_type,
				          phone_owner_name, phone_owner_position, phone_owner_division, phone_reimbursement_limit, is_active, suspended_at, created_at
			`
			queryErr = pool.QueryRow(ctx, updateQuery, input.ID).Scan(
				&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.LocationType,
				&s.PhoneOwnerName, &s.PhoneOwnerPosition, &s.PhoneOwnerDivision, &s.PhoneReimbursementLimit, &s.IsActive, &s.SuspendedAt, &s.CreatedAt,
			)
		}

		if queryErr != nil {
			return nil, huma.Error500InternalServerError("failed to update service status")
		}

		_ = pool.QueryRow(ctx, "SELECT full_name FROM departments WHERE id = $1", s.DepartmentID).Scan(&s.DepartmentName)

		return &SingleDepartmentServiceOutput{Body: s}, nil
	})

	// Delete Department Service
	huma.Register(api, huma.Operation{
		OperationID: "deleteDepartmentService",
		Method:      http.MethodDelete,
		Path:        "/api/departments/services/{id}",
		Summary:     "Delete a department service",
		Tags:        []string{"Departments"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id" doc:"Service ID"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		user, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "strategy_finance", "auditor", "user")
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}
		if user.Role != "admin" && user.Role != "central_staff" {
			var currentDeptID string
			_ = pool.QueryRow(ctx, "SELECT department_id FROM department_services WHERE id = $1", input.ID).Scan(&currentDeptID)
			if currentDeptID != user.DepartmentID {
				return nil, huma.Error403Forbidden("คุณสามารถลบได้เฉพาะหมายเลขผู้ใช้ของหน่วยงานของตนเองเท่านั้น")
			}
		}

		_, err = pool.Exec(ctx, "DELETE FROM department_services WHERE id = $1", input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete service")
		}

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Create Department
	huma.Register(api, huma.Operation{
		OperationID: "createDepartment",
		Method:      http.MethodPost,
		Path:        "/api/departments",
		Summary:     "Create a new department",
		Tags:        []string{"Departments"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *CreateDepartmentInput) (*SingleDepartmentOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		if input.Body.DisbursingUnit != nil && *input.Body.DisbursingUnit == "หน่วยเบิกจ่าย" {
			if input.Body.CostCenterCode == nil || strings.TrimSpace(*input.Body.CostCenterCode) == "" {
				return nil, huma.Error400BadRequest("หน่วยเบิกจ่ายต้องระบุรหัสศูนย์ต้นทุน 10 หลัก")
			}
		}

		if input.Body.DisbursingUnit != nil && *input.Body.DisbursingUnit == "หน่วยฝากเบิก" {
			input.Body.CostCenterCode = nil
		}

		if input.Body.CostCenterCode != nil {
			trimmed := strings.TrimSpace(*input.Body.CostCenterCode)
			if trimmed == "" {
				input.Body.CostCenterCode = nil
			} else {
				if !isTenDigits(trimmed) {
					return nil, huma.Error400BadRequest("รหัสศูนย์ต้นทุนต้องเป็นตัวเลข 10 หลัก หรือเว้นว่างไว้")
				}
				input.Body.CostCenterCode = &trimmed
			}
		}

		deptID := uuid.New().String()
		var d DepartmentDTO

		err := pool.QueryRow(ctx, `
			INSERT INTO departments (
				id, cost_center_code, disbursing_unit, deposit_unit, full_name, short_name,
				division, location, province, responsible_person, phone, responsible_phone,
				email, type, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
			) RETURNING id, cost_center_code, disbursing_unit, deposit_unit, full_name, short_name,
			            division, location, province, responsible_person, phone, responsible_phone,
			            email, type, COALESCE(is_active, TRUE), suspended_at, created_at, updated_at
		`, deptID, input.Body.CostCenterCode, input.Body.DisbursingUnit, input.Body.DepositUnit, input.Body.FullName, input.Body.ShortName,
			input.Body.Division, input.Body.Location, input.Body.Province, input.Body.ResponsiblePerson, input.Body.Phone, input.Body.ResponsiblePhone,
			input.Body.Email, input.Body.Type,
		).Scan(
			&d.ID, &d.CostCenterCode, &d.DisbursingUnit, &d.DepositUnit, &d.FullName, &d.ShortName,
			&d.Division, &d.Location, &d.Province, &d.ResponsiblePerson, &d.Phone, &d.ResponsiblePhone,
			&d.Email, &d.Type, &d.IsActive, &d.SuspendedAt, &d.CreatedAt, &d.UpdatedAt,
		)

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create department")
		}

		return &SingleDepartmentOutput{Body: d}, nil
	})

	// Update Department
	huma.Register(api, huma.Operation{
		OperationID: "updateDepartment",
		Method:      http.MethodPut,
		Path:        "/api/departments/{id}",
		Summary:     "Update a department",
		Tags:        []string{"Departments"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *UpdateDepartmentInput) (*SingleDepartmentOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		if input.Body.DisbursingUnit != nil && *input.Body.DisbursingUnit == "หน่วยเบิกจ่าย" {
			if input.Body.CostCenterCode == nil || strings.TrimSpace(*input.Body.CostCenterCode) == "" {
				return nil, huma.Error400BadRequest("หน่วยเบิกจ่ายต้องระบุรหัสศูนย์ต้นทุน 10 หลัก")
			}
		}

		if input.Body.DisbursingUnit != nil && *input.Body.DisbursingUnit == "หน่วยฝากเบิก" {
			input.Body.CostCenterCode = nil
		}

		if input.Body.CostCenterCode != nil {
			trimmed := strings.TrimSpace(*input.Body.CostCenterCode)
			if trimmed == "" {
				input.Body.CostCenterCode = nil
			} else {
				if !isTenDigits(trimmed) {
					return nil, huma.Error400BadRequest("รหัสศูนย์ต้นทุนต้องเป็นตัวเลข 10 หลัก หรือเว้นว่างไว้")
				}
				input.Body.CostCenterCode = &trimmed
			}
		}

		var d DepartmentDTO

		err := pool.QueryRow(ctx, `
			UPDATE departments
			SET cost_center_code = $2, disbursing_unit = $3, deposit_unit = $4, full_name = $5,
			    short_name = $6, division = $7, location = $8, province = $9, responsible_person = $10,
			    phone = $11, responsible_phone = $12, email = $13, type = $14, updated_at = NOW()
			WHERE id = $1
			RETURNING id, cost_center_code, disbursing_unit, deposit_unit, full_name, short_name,
			            division, location, province, responsible_person, phone, responsible_phone,
			            email, type, COALESCE(is_active, TRUE), suspended_at, created_at, updated_at
		`, input.ID, input.Body.CostCenterCode, input.Body.DisbursingUnit, input.Body.DepositUnit, input.Body.FullName, input.Body.ShortName,
			input.Body.Division, input.Body.Location, input.Body.Province, input.Body.ResponsiblePerson, input.Body.Phone, input.Body.ResponsiblePhone,
			input.Body.Email, input.Body.Type,
		).Scan(
			&d.ID, &d.CostCenterCode, &d.DisbursingUnit, &d.DepositUnit, &d.FullName, &d.ShortName,
			&d.Division, &d.Location, &d.Province, &d.ResponsiblePerson, &d.Phone, &d.ResponsiblePhone,
			&d.Email, &d.Type, &d.IsActive, &d.SuspendedAt, &d.CreatedAt, &d.UpdatedAt,
		)

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update department")
		}

		return &SingleDepartmentOutput{Body: d}, nil
	})

	// Toggle Department Status (Suspend / Reactivate)
	huma.Register(api, huma.Operation{
		OperationID: "toggleDepartmentStatus",
		Method:      http.MethodPost,
		Path:        "/api/departments/{id}/toggle-status",
		Summary:     "Toggle department active or suspended status",
		Tags:        []string{"Departments"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID   string `path:"id" doc:"Department ID"`
		Body struct {
			IsActive *bool `json:"isActive,omitempty"`
		}
	}) (*SingleDepartmentOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		var d DepartmentDTO
		var updateQuery string
		var queryErr error

		if input.Body.IsActive != nil {
			targetActive := *input.Body.IsActive
			updateQuery = `
				UPDATE departments
				SET is_active = $2,
				    suspended_at = CASE WHEN $2 = FALSE THEN NOW() ELSE NULL END,
				    updated_at = NOW()
				WHERE id = $1
				RETURNING id, cost_center_code, disbursing_unit, deposit_unit, full_name, short_name,
				          division, location, province, responsible_person, phone, responsible_phone,
				          email, type, COALESCE(is_active, TRUE), suspended_at, created_at, updated_at
			`
			queryErr = pool.QueryRow(ctx, updateQuery, input.ID, targetActive).Scan(
				&d.ID, &d.CostCenterCode, &d.DisbursingUnit, &d.DepositUnit, &d.FullName, &d.ShortName,
				&d.Division, &d.Location, &d.Province, &d.ResponsiblePerson, &d.Phone, &d.ResponsiblePhone,
				&d.Email, &d.Type, &d.IsActive, &d.SuspendedAt, &d.CreatedAt, &d.UpdatedAt,
			)
		} else {
			updateQuery = `
				UPDATE departments
				SET is_active = NOT is_active,
				    suspended_at = CASE WHEN is_active = TRUE THEN NOW() ELSE NULL END,
				    updated_at = NOW()
				WHERE id = $1
				RETURNING id, cost_center_code, disbursing_unit, deposit_unit, full_name, short_name,
				          division, location, province, responsible_person, phone, responsible_phone,
				          email, type, COALESCE(is_active, TRUE), suspended_at, created_at, updated_at
			`
			queryErr = pool.QueryRow(ctx, updateQuery, input.ID).Scan(
				&d.ID, &d.CostCenterCode, &d.DisbursingUnit, &d.DepositUnit, &d.FullName, &d.ShortName,
				&d.Division, &d.Location, &d.Province, &d.ResponsiblePerson, &d.Phone, &d.ResponsiblePhone,
				&d.Email, &d.Type, &d.IsActive, &d.SuspendedAt, &d.CreatedAt, &d.UpdatedAt,
			)
		}

		if queryErr != nil {
			return nil, huma.Error500InternalServerError("failed to update department status")
		}

		return &SingleDepartmentOutput{Body: d}, nil
	})

	// Delete Department (Soft-suspend safety fallback instead of hard delete)
	huma.Register(api, huma.Operation{
		OperationID: "deleteDepartment",
		Method:      http.MethodDelete,
		Path:        "/api/departments/{id}",
		Summary:     "Delete or suspend a department",
		Tags:        []string{"Departments"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id" doc:"Department ID"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		if _, err := auth.RequireRoles(ctx, "admin"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		// Soft-suspend instead of hard delete to preserve historical utility bills, audits, and reports
		_, err := pool.Exec(ctx, "UPDATE departments SET is_active = FALSE, suspended_at = NOW(), updated_at = NOW() WHERE id = $1", input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to suspend department")
		}

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})
}
