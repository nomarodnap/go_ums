-- name: ListNotifications :many
SELECT * FROM notifications
WHERE (sqlc.narg('department_id')::text IS NULL OR department_id = sqlc.narg('department_id'))
ORDER BY created_at DESC
LIMIT 100;

-- name: CreateNotification :one
INSERT INTO notifications (
    id, department_id, target_role, title, message, type,
    severity, is_read, link, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
)
RETURNING *;

-- name: MarkNotificationRead :one
UPDATE notifications
SET is_read = true, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: MarkAllNotificationsRead :exec
UPDATE notifications
SET is_read = true, updated_at = NOW()
WHERE (sqlc.narg('department_id')::text IS NULL OR department_id = sqlc.narg('department_id'));
