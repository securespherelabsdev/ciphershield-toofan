-- CipherShield v2 migration
-- Run once on live DB. Safe to re-run (IF NOT EXISTS / IF col not exists guards).

USE ciphershield;

-- Add geo_location_enc if missing
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='ciphershield' AND TABLE_NAME='reports' AND COLUMN_NAME='geo_location_enc');
SET @sql = IF(@col = 0,
  'ALTER TABLE reports ADD COLUMN geo_location_enc TEXT DEFAULT NULL AFTER area_desc_enc',
  'SELECT "geo_location_enc already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add score_flags_json if missing
SET @col2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='ciphershield' AND TABLE_NAME='reports' AND COLUMN_NAME='score_flags_json');
SET @sql2 = IF(@col2 = 0,
  'ALTER TABLE reports ADD COLUMN score_flags_json TEXT DEFAULT NULL AFTER ai_summary_enc',
  'SELECT "score_flags_json already exists" AS msg');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- Add assigned_to if missing
SET @col3 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='ciphershield' AND TABLE_NAME='reports' AND COLUMN_NAME='assigned_to');
SET @sql3 = IF(@col3 = 0,
  'ALTER TABLE reports ADD COLUMN assigned_to VARCHAR(20) DEFAULT NULL AFTER status',
  'SELECT "assigned_to already exists" AS msg');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

-- Add note column to audit_log if missing
SET @col4 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='ciphershield' AND TABLE_NAME='audit_log' AND COLUMN_NAME='note');
SET @sql4 = IF(@col4 = 0,
  'ALTER TABLE audit_log ADD COLUMN note VARCHAR(500) DEFAULT NULL AFTER action',
  'SELECT "audit_log.note already exists" AS msg');
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

-- report_notes table
CREATE TABLE IF NOT EXISTS report_notes (
  id              CHAR(36)  NOT NULL,
  report_id       CHAR(36)  NOT NULL,
  agency_user_id  CHAR(36)  NOT NULL,
  agency          VARCHAR(20) NOT NULL,
  note            TEXT      NOT NULL,
  created_at      DATETIME  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_report_id (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
