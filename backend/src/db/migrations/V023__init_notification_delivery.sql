-- V023 (003 US4): 알림 발송 채널별 상태/재시도 + 푸시 디바이스 토큰.
-- FR-008(3채널 발송), FR-009(채널 설정 반영). data-model §4: notification_delivery.
-- 멱등 작성(IF NOT EXISTS).

-- 알림 1건 × 채널별 발송 상태. in_app 은 항상 sent 보장. push/email 실패는 재시도 후 누락 기록.
CREATE TABLE IF NOT EXISTS notification_delivery (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  notification_id BIGINT UNSIGNED NOT NULL,
  channel         VARCHAR(20) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'queued',
  retry_count     INT UNSIGNED NOT NULL DEFAULT 0,
  last_error      VARCHAR(500) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT chk_delivery_channel CHECK (channel IN ('in_app','push','email')),
  CONSTRAINT chk_delivery_status CHECK (status IN ('queued','sent','failed','skipped')),
  -- 알림×채널 1행(멱등 — 재시도는 같은 행 갱신).
  UNIQUE KEY uq_delivery_channel (notification_id, channel),
  INDEX idx_delivery_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 푸시 대상 디바이스 토큰(FCM/APNs). 토큰 단위 unique — 재등록은 소유자 갱신.
CREATE TABLE IF NOT EXISTS device_token (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  platform    VARCHAR(10) NOT NULL,
  token       VARCHAR(512) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_device_platform CHECK (platform IN ('ios','android','web')),
  UNIQUE KEY uq_device_token (token),
  INDEX idx_device_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
