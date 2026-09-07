-- name: GetDepartmentByID :one
SELECT * FROM departments
WHERE id = $1 LIMIT 1;

-- name: ListDepartments :many
SELECT * FROM departments
ORDER BY full_name ASC;

-- name: CreateDepartment :one
INSERT INTO departments (
    id, cost_center_code, disbursing_unit, deposit_unit,
    full_name, short_name, division, location, province,
    responsible_person, phone, responsible_phone, email, type,
    created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
)
RETURNING *;

-- name: UpdateDepartment :one
UPDATE departments
SET 
    cost_center_code = $2,
    disbursing_unit = $3,
    deposit_unit = $4,
    full_name = $5,
    short_name = $6,
    division = $7,
    location = $8,
    province = $9,
    responsible_person = $10,
    phone = $11,
    responsible_phone = $12,
    email = $13,
    type = $14,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteDepartment :exec
DELETE FROM departments
WHERE id = $1;

-- Department Services
-- name: ListDepartmentServices :many
SELECT * FROM department_services
WHERE department_id = $1
ORDER BY utility_type, service_number ASC;

-- name: ListAllDepartmentServices :many
SELECT * FROM department_services
ORDER BY department_id, utility_type ASC;

-- name: CreateDepartmentService :one
INSERT INTO department_services (
    id, department_id, utility_type, provider, service_number,
    location_type, phone_owner_name, phone_owner_position,
    phone_reimbursement_limit, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
)
RETURNING *;

-- name: DeleteDepartmentService :exec
DELETE FROM department_services
WHERE id = $1;
