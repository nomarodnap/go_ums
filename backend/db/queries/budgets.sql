-- name: ListBudgets :many
SELECT b.*, d.full_name AS department_name
FROM budgets b
JOIN departments d ON b.department_id = d.id
WHERE (sqlc.narg('fiscal_year')::int IS NULL OR b.fiscal_year = sqlc.narg('fiscal_year'))
  AND (sqlc.narg('department_id')::text IS NULL OR b.department_id = sqlc.narg('department_id'))
ORDER BY b.fiscal_year DESC, d.full_name ASC;

-- name: GetBudgetByID :one
SELECT * FROM budgets
WHERE id = $1 LIMIT 1;

-- name: CreateBudget :one
INSERT INTO budgets (
    id, budget_code, name, fund_source, allocated_amount, transferred_amount,
    department_id, fiscal_year, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
)
RETURNING *;

-- name: UpdateBudget :one
UPDATE budgets
SET 
    budget_code = $2,
    name = $3,
    fund_source = $4,
    allocated_amount = $5,
    transferred_amount = $6,
    fiscal_year = $7,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteBudget :exec
DELETE FROM budgets
WHERE id = $1;

-- Budget Codes
-- name: ListBudgetCodes :many
SELECT * FROM budget_codes
WHERE (sqlc.narg('fiscal_year')::int IS NULL OR fiscal_year = sqlc.narg('fiscal_year'))
ORDER BY code ASC;

-- name: CreateBudgetCode :one
INSERT INTO budget_codes (
    id, code, name, fiscal_year, description, is_active, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, NOW(), NOW()
)
RETURNING *;
