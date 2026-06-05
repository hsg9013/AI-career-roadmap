-- V002: students 테이블 + university_consent_scope (R-7 차등 동의)

CREATE TABLE students (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id                  BIGINT UNSIGNED NOT NULL UNIQUE,
  university               VARCHAR(120) NOT NULL,
  university_id            BIGINT UNSIGNED NULL,
  major                    VARCHAR(120) NOT NULL,
  year_in_school           TINYINT NOT NULL,
  expected_grad_at         DATE NULL,
  school_email_verified    TINYINT(1) NOT NULL DEFAULT 0,
  university_consent_scope VARCHAR(20) NOT NULL DEFAULT 'aggregate_only',
  created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_students_year CHECK (year_in_school BETWEEN 1 AND 6),
  CONSTRAINT chk_students_consent CHECK (university_consent_scope IN ('none','aggregate_only','individual')),
  INDEX idx_students_university (university_id),
  INDEX idx_students_consent_scope (university_consent_scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
