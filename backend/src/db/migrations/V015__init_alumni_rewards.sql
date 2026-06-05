-- V015: 선배 데이터 기부 보상 (US9 / data-model §16, FR-018)
-- 합격 경로(alumni_paths, V007)는 익명화 저장. 기부자 보상은 사용자 식별로 지급.

CREATE TABLE alumni_rewards (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alumni_user_id  BIGINT UNSIGNED NOT NULL,
  reward_type     VARCHAR(20) NOT NULL,
  amount          INT NULL,
  alumni_path_id  BIGINT UNSIGNED NULL,
  granted_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alumni_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (alumni_path_id) REFERENCES alumni_paths(id) ON DELETE SET NULL,
  CONSTRAINT chk_reward_type CHECK (reward_type IN ('cash','credit','badge')),
  INDEX idx_reward_user (alumni_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
