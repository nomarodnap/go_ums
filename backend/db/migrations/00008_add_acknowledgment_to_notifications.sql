-- 00008_add_acknowledgment_to_notifications.sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS acknowledged_reason TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS acknowledged_by TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

