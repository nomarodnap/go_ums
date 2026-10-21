-- name: GetSessionAndUser :one
SELECT 
    s.id AS session_id,
    s.user_id,
    s.token,
    s.expires_at,
    u.id AS user_id_val,
    u.name,
    u.email,
    u.role,
    u.department_id,
    u.banned,
    u.ban_reason
FROM "session" s
JOIN "user" u ON s.user_id = u.id
WHERE s.token = $1 AND s.expires_at > NOW()
LIMIT 1;

-- name: DeleteSessionByToken :exec
DELETE FROM "session"
WHERE token = $1;
