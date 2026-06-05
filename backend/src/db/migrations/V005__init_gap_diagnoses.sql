-- V005: gap_diagnoses 스냅샷 테이블 (data-model.md §P1, FR-007)

CREATE TABLE gap_diagnoses (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  target_job_id     BIGINT UNSIGNED NOT NULL,
  computed_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  overall_score     DECIMAL(5,2) NOT NULL,
  payload_json      JSON NOT NULL,
  model_version     VARCHAR(40) NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (target_job_id) REFERENCES target_jobs(id) ON DELETE CASCADE,
  CONSTRAINT chk_gap_score CHECK (overall_score >= 0 AND overall_score <= 100),
  INDEX idx_gap_student (student_id),
  INDEX idx_gap_computed (computed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
