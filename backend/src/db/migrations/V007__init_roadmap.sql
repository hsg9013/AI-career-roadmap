-- V007: 선배 경로 + 합격 로드맵 (002-intent-specify US2 / data-model §3,§5)
-- FR-005 로드맵 생성, FR-006 추천 거부 반영, FR-019 k-익명성(≥5) 게이트
--
-- alumni_paths 는 익명화 전제: 개인 식별자 미저장, anonymized_id(해시)만 보존.
-- 추천은 (industry_code, job_role_code, grade_band) 코호트 표본이 ≥5 일 때만 코호트 기반으로 사용.

CREATE TABLE alumni_paths (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  anonymized_id   CHAR(64) NOT NULL UNIQUE,
  industry_code   VARCHAR(40) NOT NULL,
  job_role_code   VARCHAR(80) NOT NULL,
  major_field     VARCHAR(80) NOT NULL,
  grade_band      VARCHAR(20) NOT NULL,
  success_year    SMALLINT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_alumni_band CHECK (grade_band IN ('y1_2','y3','y4plus')),
  INDEX idx_alumni_cohort (industry_code, job_role_code, grade_band),
  INDEX idx_alumni_role (industry_code, job_role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE alumni_path_activities (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alumni_path_id  BIGINT UNSIGNED NOT NULL,
  period          VARCHAR(40) NOT NULL,
  activity_type   VARCHAR(40) NOT NULL,
  detail          VARCHAR(200) NOT NULL,
  skill_tag       VARCHAR(80) NULL,
  FOREIGN KEY (alumni_path_id) REFERENCES alumni_paths(id) ON DELETE CASCADE,
  CONSTRAINT chk_apa_type CHECK (activity_type IN
    ('course','project','club','volunteer','contest','external','internship','award','certification')),
  INDEX idx_apa_path (alumni_path_id),
  INDEX idx_apa_skill (skill_tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roadmaps (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      BIGINT UNSIGNED NOT NULL,
  target_job_id   BIGINT UNSIGNED NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  source          VARCHAR(20) NOT NULL,
  cohort_key      VARCHAR(160) NULL,
  cohort_size     INT NOT NULL DEFAULT 0,
  generated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  model_version   VARCHAR(40) NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (target_job_id) REFERENCES target_jobs(id) ON DELETE CASCADE,
  CONSTRAINT chk_roadmap_status CHECK (status IN ('draft','active','completed')),
  CONSTRAINT chk_roadmap_source CHECK (source IN ('cohort','fallback')),
  INDEX idx_roadmap_student (student_id),
  INDEX idx_roadmap_generated (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roadmap_items (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  roadmap_id      BIGINT UNSIGNED NOT NULL,
  period          VARCHAR(40) NOT NULL,
  activity_type   VARCHAR(40) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  rationale       VARCHAR(400) NULL,
  target_skill    VARCHAR(80) NULL,
  score           DECIMAL(7,3) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'recommended',
  item_ref        CHAR(64) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  CONSTRAINT chk_item_status CHECK (status IN ('recommended','accepted','rejected','done')),
  INDEX idx_item_roadmap (roadmap_id),
  INDEX idx_item_ref (item_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 거부 이력: 동일 학생이 같은 item_ref 를 다시 추천받지 않도록 + 해당 skill 가중치 하향
CREATE TABLE recommendation_rejections (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      BIGINT UNSIGNED NOT NULL,
  item_ref        CHAR(64) NOT NULL,
  target_skill    VARCHAR(80) NULL,
  reason          VARCHAR(200) NULL,
  rejected_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY uk_rej_student_ref (student_id, item_ref),
  INDEX idx_rej_student (student_id),
  INDEX idx_rej_skill (target_skill)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
