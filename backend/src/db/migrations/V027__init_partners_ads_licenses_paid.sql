-- V027 (004 US5/US6/US7/US8/US9): 파트너·광고·제휴·라이선스·실무 단건 과금 테이블.
-- 모두 추가형(기존 데이터 영향 없음). 광고/제휴는 자체 슬롯·집계(외부 정산 연동 범위 외).

-- 실무 단건 과금 항목(US6 T029)
CREATE TABLE paid_service (
  code        VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  fee         INT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO paid_service (code, name, fee) VALUES
  ('coverletter_review', 'AI 자소서 첨삭', 5000),
  ('resume_feedback',    '이력서 피드백',   5000),
  ('mentoring',          '현직자 멘토링',   30000),
  ('assignment_eval',    '실전 과제 평가',  15000);

CREATE TABLE paid_service_order (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id    BIGINT UNSIGNED NOT NULL,
  service_code  VARCHAR(40) NOT NULL,
  payment_id    BIGINT UNSIGNED NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_pso_student (student_id),
  CONSTRAINT chk_pso_status CHECK (status IN ('pending','paid','canceled','refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 파트너(US5) — 운영자 수동 등록
CREATE TABLE partner (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type           VARCHAR(20) NOT NULL,
  name           VARCHAR(160) NOT NULL,
  consent_scope  VARCHAR(20) NOT NULL DEFAULT 'stats',
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  registered_by  BIGINT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_partner_type CHECK (type IN ('university','company','mentor_org','edu_platform','tech_partner')),
  CONSTRAINT chk_partner_scope CHECK (consent_scope IN ('none','stats','individual'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE partner_account (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  partner_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  role        VARCHAR(40) NOT NULL DEFAULT 'partner_admin',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES partner(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_partner_user (partner_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 타겟 채용 광고(US7) — 자체 슬롯
CREATE TABLE job_ad (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id     BIGINT UNSIGNED NULL,
  title          VARCHAR(200) NOT NULL,
  industry_code  VARCHAR(40) NOT NULL,
  job_role_code  VARCHAR(80) NOT NULL,
  budget         INT NOT NULL DEFAULT 0,
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  starts_on      DATE NULL,
  ends_on        DATE NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_jobad_target (industry_code, job_role_code, status),
  CONSTRAINT chk_jobad_status CHECK (status IN ('active','paused','ended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_ad_impression (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_ad_id   BIGINT UNSIGNED NOT NULL,
  student_id  BIGINT UNSIGNED NULL,
  shown_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_ad_id) REFERENCES job_ad(id) ON DELETE CASCADE,
  INDEX idx_jobad_imp (job_ad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 외부 교육 제휴 배너(US8)
CREATE TABLE partner_banner (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  partner_id     BIGINT UNSIGNED NULL,
  title          VARCHAR(200) NOT NULL,
  image_url      VARCHAR(400) NULL,
  landing_url    VARCHAR(400) NOT NULL,
  discount_text  VARCHAR(120) NULL,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_banner_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE banner_conversion (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  partner_banner_id BIGINT UNSIGNED NOT NULL,
  student_id        BIGINT UNSIGNED NULL,
  event             VARCHAR(20) NOT NULL,
  occurred_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_banner_id) REFERENCES partner_banner(id) ON DELETE CASCADE,
  INDEX idx_banner_conv (partner_banner_id),
  CONSTRAINT chk_banner_event CHECK (event IN ('click','convert'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- B2B/B2G 라이선스(US9)
CREATE TABLE license_contract (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  partner_id      BIGINT UNSIGNED NOT NULL,
  type            VARCHAR(20) NOT NULL,
  scope           VARCHAR(20) NULL,
  seats           INT NULL,
  fee_year        INT NULL,
  commission_rate DECIMAL(5,2) NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  started_on      DATE NULL,
  ends_on         DATE NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES partner(id) ON DELETE CASCADE,
  CONSTRAINT chk_license_type CHECK (type IN ('university_saas','company_recruit')),
  CONSTRAINT chk_license_scope CHECK (scope IS NULL OR scope IN ('stats','individual'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
