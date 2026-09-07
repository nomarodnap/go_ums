-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: ListUsers :many
SELECT u.id, u.name, u.email, u.email_verified, u.image, u.role, u.banned, u.ban_reason, u.department_id, u.phone, u.created_at, u.updated_at,
       d.full_name AS department_name
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
ORDER BY u.created_at DESC;

-- name: CreateUser :one
INSERT INTO users (
    id, name, email, password_hash, email_verified, image, role,
    banned, ban_reason, ban_expires, department_id, phone,
    created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
)
RETURNING *;

-- name: UpdateUser :one
UPDATE users
SET 
    name = $2,
    role = $3,
    department_id = $4,
    phone = $5,
    banned = $6,
    ban_reason = $7,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdatePassword :exec
UPDATE users
SET password_hash = $2, updated_at = NOW()
WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;
