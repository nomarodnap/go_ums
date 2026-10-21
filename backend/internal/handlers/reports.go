package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UtilityReportItemDTO struct {
	DepartmentName string  `json:"departmentName"`
	UtilityType    string  `json:"utilityType"`
	BillCount      int     `json:"billCount"`
	TotalAmount    float64 `json:"totalAmount"`
}

type ListUtilityReportOutput struct {
	Body []UtilityReportItemDTO `json:"body"`
}

type PendingReportItemDTO struct {
	DepartmentName string  `json:"departmentName"`
	UtilityType    string  `json:"utilityType"`
	BillCount      int     `json:"billCount"`
	TotalAmount    float64 `json:"totalAmount"`
}

type ListPendingReportOutput struct {
	Body []PendingReportItemDTO `json:"body"`
}

type BudgetReportItemDTO struct {
	FiscalYear      int     `json:"fiscalYear"`
	DepartmentName  string  `json:"departmentName"`
	AllocatedAmount float64 `json:"allocatedAmount"`
	UsedAmount      float64 `json:"usedAmount"`
	RemainingAmount float64 `json:"remainingAmount"`
	IsWarning       bool    `json:"isWarning"`
}

type ListBudgetReportOutput struct {
	Body []BudgetReportItemDTO `json:"body"`
}

func RegisterReportRoutes(api huma.API, pool *pgxpool.Pool) {
	// Report #01: Utility Report
	huma.Register(api, huma.Operation{
		OperationID: "getUtilityReport",
		Method:      http.MethodGet,
		Path:        "/api/reports/utility",
		Summary:     "Get utility expense summary report aggregated by department and utility type",
		Tags:        []string{"Reports"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct{}) (*ListUtilityReportOutput, error) {
		query := `
			SELECT d.full_name, b.utility_type, COUNT(*), COALESCE(SUM(b.invoice_amount), 0)
			FROM utility_bills b
			INNER JOIN departments d ON b.department_id = d.id
			WHERE b.is_pending_bill_only = false
			GROUP BY d.full_name, b.utility_type
			ORDER BY d.full_name, b.utility_type
		`
		rows, err := pool.Query(ctx, query)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch utility report: " + err.Error())
		}
		defer rows.Close()

		results := make([]UtilityReportItemDTO, 0)
		for rows.Next() {
			var item UtilityReportItemDTO
			if err := rows.Scan(&item.DepartmentName, &item.UtilityType, &item.BillCount, &item.TotalAmount); err == nil {
				results = append(results, item)
			}
		}

		return &ListUtilityReportOutput{Body: results}, nil
	})

	// Report #02: Pending Report
	huma.Register(api, huma.Operation{
		OperationID: "getPendingReport",
		Method:      http.MethodGet,
		Path:        "/api/reports/pending",
		Summary:     "Get pending/estimated bills report aggregated by department and utility type",
		Tags:        []string{"Reports"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct{}) (*ListPendingReportOutput, error) {
		query := `
			SELECT d.full_name, b.utility_type, COUNT(*), COALESCE(SUM(b.invoice_amount), 0)
			FROM utility_bills b
			INNER JOIN departments d ON b.department_id = d.id
			WHERE b.is_pending_bill_only = true AND b.payment_status = 'PENDING'
			GROUP BY d.full_name, b.utility_type
			ORDER BY d.full_name, b.utility_type
		`
		rows, err := pool.Query(ctx, query)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch pending report: " + err.Error())
		}
		defer rows.Close()

		results := make([]PendingReportItemDTO, 0)
		for rows.Next() {
			var item PendingReportItemDTO
			if err := rows.Scan(&item.DepartmentName, &item.UtilityType, &item.BillCount, &item.TotalAmount); err == nil {
				results = append(results, item)
			}
		}

		return &ListPendingReportOutput{Body: results}, nil
	})

	// Report #03: Budget Report
	huma.Register(api, huma.Operation{
		OperationID: "getBudgetReport",
		Method:      http.MethodGet,
		Path:        "/api/reports/budget",
		Summary:     "Get budget management report comparing allocated, used, and remaining amounts",
		Tags:        []string{"Reports"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct{}) (*ListBudgetReportOutput, error) {
		query := `
			SELECT b.fiscal_year, d.full_name, COALESCE(b.allocated_amount, 0), COALESCE(b.transferred_amount, 0)
			FROM budgets b
			INNER JOIN departments d ON b.department_id = d.id
			ORDER BY b.fiscal_year DESC, d.full_name
		`
		rows, err := pool.Query(ctx, query)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch budget report: " + err.Error())
		}
		defer rows.Close()

		results := make([]BudgetReportItemDTO, 0)
		for rows.Next() {
			var item BudgetReportItemDTO
			if err := rows.Scan(&item.FiscalYear, &item.DepartmentName, &item.AllocatedAmount, &item.UsedAmount); err == nil {
				item.RemainingAmount = item.AllocatedAmount - item.UsedAmount
				item.IsWarning = item.RemainingAmount < (item.AllocatedAmount * 0.20)
				results = append(results, item)
			}
		}

		return &ListBudgetReportOutput{Body: results}, nil
	})
}
