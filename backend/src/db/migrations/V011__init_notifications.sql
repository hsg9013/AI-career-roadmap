-- V011: 알림 (US5 / data-model §14, FR-013)

CREATE TABLE notifications (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  type          VARCHAR(40) NOT NULL,
  channel       VARCHAR(20) NOT NULL DEFAULT 'in_app',
  title         VARCHAR(200) NOT NULL,
  payload_json  JSON NULL,
  sent_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at       TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_noti_channel CHECK (channel IN ('in_app','push','email')),
  INDEX idx_noti_user (user_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
