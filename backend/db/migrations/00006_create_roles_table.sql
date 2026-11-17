-- 00006_create_roles_table.sql
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial roles if they do not exist
INSERT INTO roles (id, name, description, permissions, is_system)
VALUES
    ('admin', 'ผู้ดูแลระบบ', 'สิทธิ์สูงสุด เข้าถึงและจัดการได้ทุกส่วนของระบบ', '["*"]'::jsonb, true),
    ('auditor', 'ผู้ตรวจสอบภายใน (กตน.)', 'สิทธิ์สำหรับตรวจสอบข้อมูล ภาพรวม รายงาน และการแจ้งเตือน', '["/dashboard", "/overview", "/all-bills", "/services", "/bill-tracking", "/reports", "/reports/budget", "/reports/utility", "/reports/pending", "/all-notifications", "/audits"]'::jsonb, false),
    ('central_staff', 'เจ้าหน้าที่ส่วนกลาง', 'สิทธิ์เจ้าหน้าที่ส่วนกลาง ดูแลบิล จัดการหน่วยงานและรายงาน', '["/dashboard", "/bills", "/all-bills", "/services", "/bill-tracking", "/reports", "/reports/budget", "/reports/utility", "/reports/pending", "/notifications", "/departments"]'::jsonb, false),
    ('regional_staff', 'เจ้าหน้าที่ภูมิภาค', 'สิทธิ์เจ้าหน้าที่ภูมิภาค บันทึกบิล ติดตามสถานะและดูรายงาน', '["/dashboard", "/bills", "/services", "/bill-tracking", "/reports", "/reports/budget", "/reports/utility", "/reports/pending", "/notifications"]'::jsonb, false),
    ('user', 'ผู้ใช้งานทั่วไป', 'สิทธิ์พื้นฐานสำหรับดูและบันทึกบิลของหน่วยงานตนเอง', '["/dashboard", "/bills", "/services", "/notifications"]'::jsonb, false)
ON CONFLICT (id) DO NOTHING;

