package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

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
	Email             *string   `json:"email,omitempty"`
	Type              *string   `json:"type,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
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
	PhoneReimbursementLimit *int      `json:"phoneReimbursementLimit,omitempty"`
	CreatedAt               time.Time `json:"createdAt"`
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
		PhoneReimbursementLimit *int    `json:"phoneReimbursementLimit,omitempty"`
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
		PhoneReimbursementLimit *int    `json:"phoneReimbursementLimit,omitempty"`
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
			       email, type, created_at, updated_at
			FROM departments ORDER BY full_name ASC
		`)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch departments")
		}
		defer rows.Close()

		var results []DepartmentDTO
		for rows.Next() {
			var d DepartmentDTO
			if err := rows.Scan(
				&d.ID, &d.CostCenterCode, &d.DisbursingUnit, &d.DepositUnit, &d.FullName, &d.ShortName,
				&d.Division, &d.Location, &d.Province, &d.ResponsiblePerson, &d.Phone, &d.ResponsiblePhone,
				&d.Email, &d.Type, &d.CreatedAt, &d.UpdatedAt,
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
	}) (*ListDepartmentServicesOutput, error) {
		query := `
			SELECT ds.id, ds.department_id, ds.utility_type, ds.provider, ds.service_number, ds.location_type,
			       ds.phone_owner_name, ds.phone_owner_position, ds.phone_reimbursement_limit, ds.created_at,
			       d.full_name
			FROM department_services ds
			LEFT JOIN departments d ON ds.department_id = d.id
		`
		var args []interface{}
		if input.DepartmentID != "" {
			query += " WHERE ds.department_id = $1"
			args = append(args, input.DepartmentID)
		}
		query += " ORDER BY ds.utility_type, ds.service_number ASC"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch services")
		}
		defer rows.Close()

		var results []DepartmentServiceDTO
		for rows.Next() {
			var s DepartmentServiceDTO
			if err := rows.Scan(
				&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.LocationType,
				&s.PhoneOwnerName, &s.PhoneOwnerPosition, &s.PhoneReimbursementLimit, &s.CreatedAt,
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
		sess, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "user")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		if sess.Role == "user" && sess.DepartmentID != "" && input.Body.DepartmentID != sess.DepartmentID {
			return nil, huma.Error403Forbidden("ท่านสามารถจัดการได้เฉพาะหมายเลขผู้ใช้ของหน่วยงานตนเองเท่านั้น")
		}

		serviceID := uuid.New().String()
		var s DepartmentServiceDTO

		err = pool.QueryRow(ctx, `
			INSERT INTO department_services (
				id, department_id, utility_type, provider, service_number,
				location_type, phone_owner_name, phone_owner_position, phone_reimbursement_limit,
				created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
			) RETURNING id, department_id, utility_type, provider, service_number, location_type,
			            phone_owner_name, phone_owner_position, phone_reimbursement_limit, created_at
		`, serviceID, input.Body.DepartmentID, input.Body.UtilityType, input.Body.Provider, input.Body.ServiceNumber,
			input.Body.LocationType, input.Body.PhoneOwnerName, input.Body.PhoneOwnerPosition, input.Body.PhoneReimbursementLimit,
		).Scan(
			&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.LocationType,
			&s.PhoneOwnerName, &s.PhoneOwnerPosition, &s.PhoneReimbursementLimit, &s.CreatedAt,
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
		sess, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "user")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		if sess.Role == "user" {
			var existingDeptID string
			err := pool.QueryRow(ctx, "SELECT department_id FROM department_services WHERE id = $1", input.ID).Scan(&existingDeptID)
			if err != nil {
				return nil, huma.Error404NotFound("service not found")
			}
			if sess.DepartmentID == "" || existingDeptID != sess.DepartmentID || input.Body.DepartmentID != sess.DepartmentID {
				return nil, huma.Error403Forbidden("ท่านสามารถจัดการได้เฉพาะหมายเลขผู้ใช้ของหน่วยงานตนเองเท่านั้น")
			}
		}

		var s DepartmentServiceDTO
		err = pool.QueryRow(ctx, `
			UPDATE department_services
			SET department_id = $2, utility_type = $3, provider = $4, service_number = $5,
			    location_type = $6, phone_owner_name = $7, phone_owner_position = $8,
			    phone_reimbursement_limit = $9, updated_at = NOW()
			WHERE id = $1
			RETURNING id, department_id, utility_type, provider, service_number, location_type,
			          phone_owner_name, phone_owner_position, phone_reimbursement_limit, created_at
		`, input.ID, input.Body.DepartmentID, input.Body.UtilityType, input.Body.Provider, input.Body.ServiceNumber,
			input.Body.LocationType, input.Body.PhoneOwnerName, input.Body.PhoneOwnerPosition, input.Body.PhoneReimbursementLimit,
		).Scan(
			&s.ID, &s.DepartmentID, &s.UtilityType, &s.Provider, &s.ServiceNumber, &s.LocationType,
			&s.PhoneOwnerName, &s.PhoneOwnerPosition, &s.PhoneReimbursementLimit, &s.CreatedAt,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update service")
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
		sess, err := auth.RequireRoles(ctx, "admin", "central_staff", "regional_staff", "user")
		if err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		if sess.Role == "user" {
			var existingDeptID string
			err := pool.QueryRow(ctx, "SELECT department_id FROM department_services WHERE id = $1", input.ID).Scan(&existingDeptID)
			if err != nil {
				return nil, huma.Error404NotFound("service not found")
			}
			if sess.DepartmentID == "" || existingDeptID != sess.DepartmentID {
				return nil, huma.Error403Forbidden("ท่านสามารถจัดการได้เฉพาะหมายเลขผู้ใช้ของหน่วยงานตนเองเท่านั้น")
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
			            email, type, created_at, updated_at
		`, deptID, input.Body.CostCenterCode, input.Body.DisbursingUnit, input.Body.DepositUnit, input.Body.FullName, input.Body.ShortName,
			input.Body.Division, input.Body.Location, input.Body.Province, input.Body.ResponsiblePerson, input.Body.Phone, input.Body.ResponsiblePhone,
			input.Body.Email, input.Body.Type,
		).Scan(
			&d.ID, &d.CostCenterCode, &d.DisbursingUnit, &d.DepositUnit, &d.FullName, &d.ShortName,
			&d.Division, &d.Location, &d.Province, &d.ResponsiblePerson, &d.Phone, &d.ResponsiblePhone,
			&d.Email, &d.Type, &d.CreatedAt, &d.UpdatedAt,
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

		var d DepartmentDTO

		err := pool.QueryRow(ctx, `
			UPDATE departments
			SET cost_center_code = $2, disbursing_unit = $3, deposit_unit = $4, full_name = $5,
			    short_name = $6, division = $7, location = $8, province = $9, responsible_person = $10,
			    phone = $11, responsible_phone = $12, email = $13, type = $14, updated_at = NOW()
			WHERE id = $1
			RETURNING id, cost_center_code, disbursing_unit, deposit_unit, full_name, short_name,
			            division, location, province, responsible_person, phone, responsible_phone,
			            email, type, created_at, updated_at
		`, input.ID, input.Body.CostCenterCode, input.Body.DisbursingUnit, input.Body.DepositUnit, input.Body.FullName, input.Body.ShortName,
			input.Body.Division, input.Body.Location, input.Body.Province, input.Body.ResponsiblePerson, input.Body.Phone, input.Body.ResponsiblePhone,
			input.Body.Email, input.Body.Type,
		).Scan(
			&d.ID, &d.CostCenterCode, &d.DisbursingUnit, &d.DepositUnit, &d.FullName, &d.ShortName,
			&d.Division, &d.Location, &d.Province, &d.ResponsiblePerson, &d.Phone, &d.ResponsiblePhone,
			&d.Email, &d.Type, &d.CreatedAt, &d.UpdatedAt,
		)

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update department")
		}

		return &SingleDepartmentOutput{Body: d}, nil
	})

	// Delete Department
	huma.Register(api, huma.Operation{
		OperationID: "deleteDepartment",
		Method:      http.MethodDelete,
		Path:        "/api/departments/{id}",
		Summary:     "Delete a department",
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

		_, err := pool.Exec(ctx, "DELETE FROM departments WHERE id = $1", input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete department")
		}

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})
}
