-- V010: 실무 미션 + 결합 피드백 (US4 / data-model §8, FR-010~012)

CREATE TABLE missions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  industry_code   VARCHAR(40) NULL,
  job_role_code   VARCHAR(80) NULL,
  brief           TEXT NOT NULL,
  created_by      BIGINT UNSIGNED NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_mission_status CHECK (status IN ('open','closed')),
  INDEX idx_mission_role (industry_code, job_role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE submissions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mission_id    BIGINT UNSIGNED NOT NULL,
  student_id    BIGINT UNSIGNED NOT NULL,
  storage_key   VARCHAR(300) NULL,
  content       TEXT NULL,
  state         VARCHAR(20) NOT NULL DEFAULT 'submitted',
  submitted_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT chk_sub_state CHECK (state IN
    ('submitted','ai_reviewed','assigned','mentor_reviewed','reassigned','ai_fallback')),
  INDEX idx_sub_student (student_id),
  INDEX idx_sub_mission (mission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE feedbacks (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL,
  kind          VARCHAR(10) NOT NULL,
  mentor_id     BIGINT UNSIGNED NULL,
  content       TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT chk_fb_kind CHECK (kind IN ('ai','mentor')),
  INDEX idx_fb_submission (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review_assignments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL UNIQUE,
  mentor_id     BIGINT UNSIGNED NULL,
  deadline      DATETIME NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT chk_ra_status CHECK (status IN ('pending','completed','reassigned','ai_fallback')),
  INDEX idx_ra_deadline (deadline, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO missions (title, industry_code, job_role_code, brief) VALUES
  ('백엔드 REST API 설계 미션', 'IT', 'backend', '주어진 요구사항으로 REST API를 설계하고 ERD와 엔드포인트 명세를 제출하세요.'),
  ('프론트엔드 컴포넌트 미션', 'IT', 'frontend', '재사용 가능한 폼 컴포넌트를 구현하고 접근성(a11y)을 고려한 설계를 설명하세요.');
