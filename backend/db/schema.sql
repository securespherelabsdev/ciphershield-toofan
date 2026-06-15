/*
 * ZERO PII SCHEMA
 *
 * Every column in this schema must be justifiable on privacy grounds.
 * If a column could identify a reporter, it must not exist.
 * This schema is the enforcement layer of CipherShield's privacy guarantee.
 *
 * Audit note: area_desc_enc, details_enc, and ai_summary_enc are stored
 * as AES-256-GCM ciphertext. The plaintext is never written to disk.
 * created_at is fuzzed to the nearest 6-hour block before insertion.
 */

CREATE DATABASE IF NOT EXISTS ciphershield CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ciphershield;

CREATE TABLE IF NOT EXISTS reports (
  id               CHAR(36)         NOT NULL,
  token_hash       CHAR(64)         NOT NULL,          -- SHA-256 of one-time token
  report_type      VARCHAR(60)      NOT NULL,
  district         VARCHAR(60)      DEFAULT NULL,
  area_desc_enc    TEXT             DEFAULT NULL,      -- AES-256-GCM ciphertext
  geo_location_enc TEXT             DEFAULT NULL,      -- AES-256-GCM ciphertext (lat/lng JSON)
  time_observed    VARCHAR(30)      DEFAULT NULL,
  details_enc      TEXT             DEFAULT NULL,      -- AES-256-GCM ciphertext
  confidence_raw   VARCHAR(40)      DEFAULT NULL,
  fp_score         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ai_summary_enc   TEXT             DEFAULT NULL,      -- AI summary, encrypted at dispatch
  score_flags_json TEXT             DEFAULT NULL,      -- JSON: {breakdown, flags[]} — NOT sensitive
  status           ENUM(
                     'QUARANTINE',
                     'REVIEW',
                     'DISPATCH',
                     'ACTIONED',
                     'NO_FINDING',
                     'ESCALATED'
                   )                NOT NULL DEFAULT 'REVIEW',
  assigned_to      VARCHAR(20)      DEFAULT NULL,      -- KERALA_POLICE | EXCISE | CYBERDOME
  created_at       DATETIME         NOT NULL,          -- Fuzzed to nearest 6-hour block
  dispatched_at    DATETIME         DEFAULT NULL,
  outcome_at       DATETIME         DEFAULT NULL,
  outcome_note     VARCHAR(500)     DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_hash (token_hash),
  KEY idx_status (status),
  KEY idx_district_type (district, report_type),
  KEY idx_created_at (created_at),
  KEY idx_assigned_to (assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_notes (
  id              CHAR(36)         NOT NULL,
  report_id       CHAR(36)         NOT NULL,
  agency_user_id  CHAR(36)         NOT NULL,
  agency          VARCHAR(20)      NOT NULL,
  note            TEXT             NOT NULL,
  created_at      DATETIME         NOT NULL,
  PRIMARY KEY (id),
  KEY idx_report_id (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agency_users (
  id              CHAR(36)         NOT NULL,
  email           VARCHAR(100)     NOT NULL,
  password_hash   VARCHAR(255)     NOT NULL,          -- bcrypt, 12 rounds
  agency          ENUM(
                    'KERALA_POLICE',
                    'EXCISE',
                    'CYBERDOME'
                  )                NOT NULL,
  last_login      DATETIME         DEFAULT NULL,
  created_at      DATETIME         NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id              CHAR(36)         NOT NULL,
  agency_user_id  CHAR(36)         NOT NULL,
  action          VARCHAR(50)      NOT NULL,
  note            VARCHAR(500)     DEFAULT NULL,
  report_id       CHAR(36)         NOT NULL,
  actioned_at     DATETIME         NOT NULL,
  PRIMARY KEY (id),
  KEY idx_report_id (report_id),
  KEY idx_user_id (agency_user_id),
  KEY idx_actioned_at (actioned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
