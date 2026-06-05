-- V009: 문서 자동 생성 (US3 / data-model §7, FR-008~009)
-- 활동 기록을 바탕으로 이력서/자소서/포트폴리오를 생성. 본문은 content_json,
-- 외부 파일(PDF 등)은 추후 storage_key(MinIO)로 연결.

CREATE TABLE documents (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id    BIGINT UNSIGNED NOT NULL,
  doc_type      VARCHAR(20) NOT NULL,
  version       INT NOT NULL DEFAULT 1,
  title         VARCHAR(200) NOT NULL,
  content_json  JSON NOT NULL,
  storage_key   VARCHAR(300) NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT chk_doc_type CHECK (doc_type IN ('resume','coverletter','portfolio')),
  CONSTRAINT chk_doc_status CHECK (status IN ('draft','final')),
  INDEX idx_doc_student (student_id, doc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
