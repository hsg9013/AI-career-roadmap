-- V019 (003 US8): 운영 안정성 메타 — 백업 이력 + 모니터링 경보
-- FR-015(일일 백업·24h 복구), FR-017(장애 감지·경보).

CREATE TABLE backup_run (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  started_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at  TIMESTAMP NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'running',
  location     VARCHAR(500) NULL,
  size_bytes   BIGINT UNSIGNED NULL,
  error        TEXT NULL,
  CONSTRAINT chk_backup_status CHECK (status IN ('running','success','failed')),
  INDEX idx_backup_status_time (status, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE monitor_alert (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  component    VARCHAR(40) NOT NULL,
  severity     VARCHAR(20) NOT NULL DEFAULT 'warning',
  message      VARCHAR(500) NOT NULL,
  raised_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at  TIMESTAMP NULL,
  CONSTRAINT chk_alert_severity CHECK (severity IN ('warning','critical')),
  INDEX idx_alert_open (component, resolved_at),
  INDEX idx_alert_time (raised_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
