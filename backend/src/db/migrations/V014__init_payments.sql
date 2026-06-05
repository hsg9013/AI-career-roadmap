-- V014: 결제 + 멘토 보상 정산 (US8 / data-model §9,§13, FR-016~017)
-- 결제는 멘토 정산 데이터 구조에 의존(spec Assumptions). 민감 컬럼은 AES-GCM 암호화 저장.

CREATE TABLE mentors (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL UNIQUE,
  expertise     VARCHAR(120) NULL,
  mentor_track  VARCHAR(20) NOT NULL DEFAULT 'flat',
  verified      TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_mentor_track CHECK (mentor_track IN ('flat','commission'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE commission_rates (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scope       VARCHAR(40) NOT NULL,
  rate        DECIMAL(5,4) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_commission_scope (scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_methods (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  bank            VARCHAR(40) NOT NULL,
  account_no_enc  VARBINARY(255) NOT NULL,
  holder_enc      VARBINARY(255) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pm_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payer_user_id BIGINT UNSIGNED NOT NULL,
  kind          VARCHAR(20) NOT NULL,
  amount        INT NOT NULL,
  pg_tx_id      VARCHAR(80) NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payer_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_pay_kind CHECK (kind IN ('membership','one_time')),
  CONSTRAINT chk_pay_status CHECK (status IN ('pending','paid','failed','refunded')),
  INDEX idx_pay_payer (payer_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE memberships (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id  BIGINT UNSIGNED NOT NULL,
  plan        VARCHAR(40) NOT NULL,
  started_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at     DATETIME NOT NULL,
  auto_renew  TINYINT(1) NOT NULL DEFAULT 1,
  payment_id  BIGINT UNSIGNED NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  INDEX idx_membership_student (student_id, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mentor_payouts (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_id   BIGINT UNSIGNED NOT NULL,
  period      VARCHAR(7) NOT NULL,
  amount      INT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
  CONSTRAINT chk_payout_status CHECK (status IN ('pending','paid','failed')),
  UNIQUE KEY uk_payout_mentor_period (mentor_id, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO commission_rates (scope, rate) VALUES ('mentor_feedback', 0.2000), ('placement_fee', 0.1000);
