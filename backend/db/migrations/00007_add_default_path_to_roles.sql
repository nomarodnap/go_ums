-- 00007_add_default_path_to_roles.sql
ALTER TABLE roles ADD COLUMN IF NOT EXISTS default_path VARCHAR(255) NOT NULL DEFAULT '/dashboard';

UPDATE roles SET default_path = '/dashboard' WHERE default_path IS NULL OR default_path = '';

