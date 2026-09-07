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

type BudgetDTO struct {
	ID                string    `json:"id"`
	BudgetCode        string    `json:"budgetCode"`
	Name              string    `json:"name"`
	FundSource        *string   `json:"fundSource,omitempty"`
	AllocatedAmount   float64   `json:"allocatedAmount"`
	TransferredAmount float64   `json:"transferredAmount"`
	DepartmentID      string    `json:"departmentId"`
	DepartmentName    *string   `json:"departmentName,omitempty"`
	FiscalYear        int       `json:"fiscalYear"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type BudgetCodeDTO struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	FiscalYear  int       `json:"fiscalYear"`
	Description *string   `json:"description,omitempty"`
	IsActive    bool      `json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
}

type ListBudgetsOutput struct {
	Body []BudgetDTO `json:"body"`
}

type ListBudgetCodesOutput struct {
	Body []BudgetCodeDTO `json:"body"`
}

type SingleBudgetCodeOutput struct {
	Body BudgetCodeDTO `json:"body"`
}

type CreateBudgetCodeInput struct {
	Body struct {
		Code        string  `json:"code" doc:"Budget Code"`
		Name        string  `json:"name" doc:"Budget Name"`
		FiscalYear  int     `json:"fiscalYear" doc:"Fiscal Year (BE)"`
		Description *string `json:"description,omitempty" doc:"Description or remarks"`
		IsActive    *bool   `json:"isActive,omitempty" doc:"Is Active status"`
	}
}

type UpdateBudgetCodeInput struct {
	ID   string `path:"id" doc:"Budget Code ID"`
	Body struct {
		Code        *string `json:"code,omitempty" doc:"Budget Code"`
		Name        *string `json:"name,omitempty" doc:"Budget Name"`
		FiscalYear  *int    `json:"fiscalYear,omitempty" doc:"Fiscal Year (BE)"`
		Description *string `json:"description,omitempty" doc:"Description or remarks"`
		IsActive    *bool   `json:"isActive,omitempty" doc:"Is Active status"`
	}
}

func RegisterBudgetRoutes(api huma.API, pool *pgxpool.Pool) {
	// List Budgets
	huma.Register(api, huma.Operation{
		OperationID: "listBudgets",
		Method:      http.MethodGet,
		Path:        "/api/budgets",
		Summary:     "List department budgets",
		Tags:        []string{"Budgets"},
	}, func(ctx context.Context, input *struct {
		FiscalYear   int    `query:"fiscalYear" doc:"Fiscal Year"`
		DepartmentID string `query:"departmentId" doc:"Department ID"`
	}) (*ListBudgetsOutput, error) {
		query := `
			SELECT b.id, b.budget_code, b.name, b.fund_source, b.allocated_amount,
			       b.transferred_amount, b.department_id, d.full_name, b.fiscal_year,
			       b.created_at, b.updated_at
			FROM budgets b
			JOIN departments d ON b.department_id = d.id
			WHERE 1=1
		`
		var args []interface{}
		argIdx := 1
		if input.FiscalYear > 0 {
			query += " AND b.fiscal_year = $1"
			args = append(args, input.FiscalYear)
			argIdx++
		}
		if input.DepartmentID != "" {
			query += " AND b.department_id = $" + string(rune('0'+argIdx))
			args = append(args, input.DepartmentID)
		}
		query += " ORDER BY b.fiscal_year DESC, d.full_name ASC"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch budgets")
		}
		defer rows.Close()

		var results []BudgetDTO
		for rows.Next() {
			var b BudgetDTO
			if err := rows.Scan(
				&b.ID, &b.BudgetCode, &b.Name, &b.FundSource, &b.AllocatedAmount,
				&b.TransferredAmount, &b.DepartmentID, &b.DepartmentName, &b.FiscalYear,
				&b.CreatedAt, &b.UpdatedAt,
			); err == nil {
				results = append(results, b)
			}
		}

		return &ListBudgetsOutput{Body: results}, nil
	})

	// List Budget Codes
	huma.Register(api, huma.Operation{
		OperationID: "listBudgetCodes",
		Method:      http.MethodGet,
		Path:        "/api/budgets/codes",
		Summary:     "List official budget codes",
		Tags:        []string{"Budgets"},
	}, func(ctx context.Context, input *struct {
		FiscalYear int `query:"fiscalYear"`
	}) (*ListBudgetCodesOutput, error) {
		query := `SELECT id, code, name, fiscal_year, description, is_active, created_at FROM budget_codes WHERE 1=1`
		var args []interface{}
		if input.FiscalYear > 0 {
			query += " AND fiscal_year = $1"
			args = append(args, input.FiscalYear)
		}
		query += " ORDER BY fiscal_year DESC, code ASC"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch budget codes")
		}
		defer rows.Close()

		var results []BudgetCodeDTO
		for rows.Next() {
			var bc BudgetCodeDTO
			if err := rows.Scan(&bc.ID, &bc.Code, &bc.Name, &bc.FiscalYear, &bc.Description, &bc.IsActive, &bc.CreatedAt); err == nil {
				results = append(results, bc)
			}
		}

		return &ListBudgetCodesOutput{Body: results}, nil
	})

	// Create Budget Code
	huma.Register(api, huma.Operation{
		OperationID: "createBudgetCode",
		Method:      http.MethodPost,
		Path:        "/api/budgets/codes",
		Summary:     "Create a new budget code",
		Tags:        []string{"Budgets"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *CreateBudgetCodeInput) (*SingleBudgetCodeOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "strategy_finance", "central_staff"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		if input.Body.Code == "" {
			return nil, huma.Error400BadRequest("รหัสงบประมาณจำเป็นต้องระบุ")
		}
		if input.Body.FiscalYear <= 0 {
			return nil, huma.Error400BadRequest("ปีงบประมาณไม่ถูกต้อง")
		}

		name := input.Body.Name
		if name == "" {
			name = input.Body.Code
		}

		isActive := true
		if input.Body.IsActive != nil {
			isActive = *input.Body.IsActive
		}

		newID := uuid.New().String()
		var res BudgetCodeDTO

		err := pool.QueryRow(ctx, `
			INSERT INTO budget_codes (
				id, code, name, fiscal_year, description, is_active, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, NOW(), NOW()
			) RETURNING id, code, name, fiscal_year, description, is_active, created_at
		`, newID, input.Body.Code, name, input.Body.FiscalYear, input.Body.Description, isActive).Scan(
			&res.ID, &res.Code, &res.Name, &res.FiscalYear, &res.Description, &res.IsActive, &res.CreatedAt,
		)

		if err != nil {
			return nil, huma.Error500InternalServerError("ไม่สามารถบันทึกรหัสงบประมาณได้: " + err.Error())
		}

		return &SingleBudgetCodeOutput{Body: res}, nil
	})

	// Update Budget Code
	huma.Register(api, huma.Operation{
		OperationID: "updateBudgetCode",
		Method:      http.MethodPut,
		Path:        "/api/budgets/codes/{id}",
		Summary:     "Update a budget code",
		Tags:        []string{"Budgets"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *UpdateBudgetCodeInput) (*SingleBudgetCodeOutput, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "strategy_finance", "central_staff"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		var current BudgetCodeDTO
		err := pool.QueryRow(ctx, `
			SELECT id, code, name, fiscal_year, description, is_active, created_at
			FROM budget_codes WHERE id = $1
		`, input.ID).Scan(
			&current.ID, &current.Code, &current.Name, &current.FiscalYear, &current.Description, &current.IsActive, &current.CreatedAt,
		)
		if err != nil {
			return nil, huma.Error404NotFound("ไม่พบรหัสงบประมาณที่ระบุ")
		}

		if input.Body.Code != nil && *input.Body.Code != "" {
			current.Code = *input.Body.Code
		}
		if input.Body.Name != nil && *input.Body.Name != "" {
			current.Name = *input.Body.Name
		}
		if input.Body.FiscalYear != nil && *input.Body.FiscalYear > 0 {
			current.FiscalYear = *input.Body.FiscalYear
		}
		if input.Body.Description != nil {
			current.Description = input.Body.Description
		}
		if input.Body.IsActive != nil {
			current.IsActive = *input.Body.IsActive
		}

		var updated BudgetCodeDTO
		err = pool.QueryRow(ctx, `
			UPDATE budget_codes
			SET code = $1, name = $2, fiscal_year = $3, description = $4, is_active = $5, updated_at = NOW()
			WHERE id = $6
			RETURNING id, code, name, fiscal_year, description, is_active, created_at
		`, current.Code, current.Name, current.FiscalYear, current.Description, current.IsActive, input.ID).Scan(
			&updated.ID, &updated.Code, &updated.Name, &updated.FiscalYear, &updated.Description, &updated.IsActive, &updated.CreatedAt,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("ไม่สามารถอัปเดตรหัสงบประมาณได้: " + err.Error())
		}

		return &SingleBudgetCodeOutput{Body: updated}, nil
	})

	// Delete Budget Code
	huma.Register(api, huma.Operation{
		OperationID: "deleteBudgetCode",
		Method:      http.MethodDelete,
		Path:        "/api/budgets/codes/{id}",
		Summary:     "Delete a budget code",
		Tags:        []string{"Budgets"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id" doc:"Budget Code ID"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "strategy_finance", "central_staff"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		_, err := pool.Exec(ctx, "DELETE FROM budget_codes WHERE id = $1", input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("ไม่สามารถลบรหัสงบประมาณได้: " + err.Error())
		}

		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})
}
