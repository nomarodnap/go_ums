-- 00012_add_manual_anomaly_detail_to_audits.sql
ALTER TABLE audits ADD COLUMN IF NOT EXISTS manual_anomaly_detail TEXT;

