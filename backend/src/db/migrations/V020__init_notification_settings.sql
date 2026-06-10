-- V020 (003 US4): 채널별 알림 설정 (FR-009)
-- push/email 채널 on·off 를 사용자별 저장. in_app 은 항상 on(미저장).

CREATE TABLE user_notification_setting (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  channel     VARCHAR(20) NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_noti_setting_channel CHECK (channel IN ('push','email')),
  UNIQUE KEY uk_user_channel (user_id, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
