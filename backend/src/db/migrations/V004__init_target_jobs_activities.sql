-- V004: target_jobs + activities + activity_tags + job_requirements (data-model.md §P1)
-- FR-009: 학생당 목표 직무 최대 3
-- FR-016: 활동 자동/수동 태그

CREATE TABLE target_jobs (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  industry_code     VARCHAR(40) NOT NULL,
  job_role_code     VARCHAR(80) NOT NULL,
  priority          TINYINT NOT NULL DEFAULT 1,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT chk_target_priority CHECK (priority BETWEEN 1 AND 3),
  UNIQUE KEY uk_target_student_pri (student_id, priority),
  UNIQUE KEY uk_target_student_role (student_id, industry_code, job_role_code),
  INDEX idx_target_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activities (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  category          VARCHAR(40) NOT NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT NULL,
  started_at        DATE NOT NULL,
  ended_at          DATE NULL,
  outcome           TEXT NULL,
  source            VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT chk_activity_category CHECK (category IN
    ('course','project','club','volunteer','contest','external','internship','award','certification')),
  CONSTRAINT chk_activity_source CHECK (source IN ('manual','import','partner')),
  INDEX idx_activity_student (student_id),
  INDEX idx_activity_category (category),
  INDEX idx_activity_started (started_at),
  INDEX idx_activity_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_tags (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activity_id   BIGINT UNSIGNED NOT NULL,
  tag           VARCHAR(80) NOT NULL,
  source        VARCHAR(20) NOT NULL DEFAULT 'auto',
  weight        DECIMAL(4,3) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_activity_tag (activity_id, tag),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  CONSTRAINT chk_tag_source CHECK (source IN ('auto','user')),
  INDEX idx_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_requirements (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  industry_code   VARCHAR(40) NOT NULL,
  job_role_code   VARCHAR(80) NOT NULL,
  keywords_json   JSON NOT NULL,
  notes           TEXT NULL,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_job (industry_code, job_role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
