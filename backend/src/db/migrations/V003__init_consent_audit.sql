-- V003: consent_records + audit_logs
-- FR-031 동의 5종 + FR-019/033/034 감사 로그

CREATE TABLE consent_records (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  consent_type    VARCHAR(40) NOT NULL,
  granted         TINYINT(1) NOT NULL,
  scope_value     VARCHAR(40) NULL,
  policy_version  VARCHAR(20) NULL,
  granted_at      TIMESTAMP NULL,
  revoked_at      TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_consent_user_type (user_id, consent_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id   BIGINT UNSIGNED NULL,
  action          VARCHAR(80) NOT NULL,
  target_kind     VARCHAR(40) NULL,
  target_id       BIGINT UNSIGNED NULL,
  meta_json       JSON NULL,
  ip_address      VARCHAR(45) NULL,
  occurred_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor (actor_user_id),
  INDEX idx_audit_target (target_kind, target_id),
  INDEX idx_audit_time (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
