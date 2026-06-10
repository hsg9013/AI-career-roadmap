-- V024 (003 US6): 소셜 로그인 연결 + 학교 이메일 검증.
-- FR-012(네이버 소셜 로그인 생성·연결·로그인), FR-013(.ac.kr 학교 이메일 검증, 비-.ac.kr 거부).
-- data-model §6: social_identity, school_email_verification. 멱등 작성.

-- 소셜 계정 연결. provider 내 provider_uid 는 unique — 동일 소셜 계정은 1 user 에만 연결.
CREATE TABLE IF NOT EXISTS social_identity (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  provider     VARCHAR(20) NOT NULL,
  provider_uid VARCHAR(191) NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_social_provider CHECK (provider IN ('naver')),
  UNIQUE KEY uq_social_provider_uid (provider, provider_uid),
  INDEX idx_social_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 학교 이메일 검증. .ac.kr 만 허용, 비-.ac.kr 은 rejected 기록. 토큰 해시로 확인 링크 검증.
CREATE TABLE IF NOT EXISTS school_email_verification (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  email        VARCHAR(255) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  token_hash   CHAR(64) NULL,
  expires_at   TIMESTAMP NULL,
  verified_at  TIMESTAMP NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_school_status CHECK (status IN ('pending','verified','rejected')),
  INDEX idx_school_user (user_id, status),
  INDEX idx_school_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
