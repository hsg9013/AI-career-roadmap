-- V012: 대학 관리 기능 B2G (US6 / data-model §10, FR-014)
-- 학생 동의 범위(students.university_consent_scope: none/aggregate_only/individual)와
-- 교직원 권한(scope_grant)의 교집합으로 조회 범위를 서버에서 강제.

CREATE TABLE universities (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  contact     VARCHAR(200) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE university_staff (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL UNIQUE,
  university_id BIGINT UNSIGNED NOT NULL,
  scope_grant   VARCHAR(20) NOT NULL DEFAULT 'aggregate_only',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE,
  CONSTRAINT chk_staff_scope CHECK (scope_grant IN ('aggregate_only','individual'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO universities (name, contact) VALUES ('샘플대학교', 'career@sample.ac.kr');
