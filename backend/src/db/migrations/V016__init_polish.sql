-- V016: 운영/정책/지표 (Polish) — 채용 공고 신선도(FR-024), 신고 검수(FR-023),
--       제품 이벤트 트래킹(SC-002~010, T072), 처리방침 버전(FR-025, T073)

CREATE TABLE job_postings (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source        VARCHAR(40) NOT NULL,
  external_id   VARCHAR(120) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  company       VARCHAR(120) NULL,
  industry_code VARCHAR(40) NULL,
  job_role_code VARCHAR(80) NULL,
  url           VARCHAR(400) NULL,
  collected_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  freshness     VARCHAR(10) NOT NULL DEFAULT 'fresh',
  CONSTRAINT chk_jp_freshness CHECK (freshness IN ('fresh','stale')),
  UNIQUE KEY uk_jp_source_ext (source, external_id),
  INDEX idx_jp_role (industry_code, job_role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reports (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_user_id  BIGINT UNSIGNED NULL,
  target_kind       VARCHAR(40) NOT NULL,
  target_id         BIGINT UNSIGNED NOT NULL,
  reason            VARCHAR(200) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution        VARCHAR(200) NULL,
  reviewed_by       BIGINT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_report_status CHECK (status IN ('open','reviewing','resolved','rejected')),
  INDEX idx_report_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_events (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  event       VARCHAR(60) NOT NULL,
  props_json  JSON NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ae_event (event, occurred_at),
  INDEX idx_ae_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE privacy_policies (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version       VARCHAR(20) NOT NULL UNIQUE,
  body          TEXT NOT NULL,
  is_current    TINYINT(1) NOT NULL DEFAULT 1,
  published_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO job_postings (source, external_id, title, company, industry_code, job_role_code, url, freshness) VALUES
  ('seed', 'jp-1', '신입 백엔드 개발자 채용', '샘플테크', 'IT', 'backend', 'https://example.com/jp-1', 'fresh'),
  ('seed', 'jp-2', '주니어 프론트엔드 채용', '데모소프트', 'IT', 'frontend', 'https://example.com/jp-2', 'fresh');

INSERT INTO privacy_policies (version, body, is_current) VALUES
  ('2026.06', '개인정보 처리방침 초기 버전 — 수집 항목, 보존 기간, 제3자 제공, 이용자 권리를 명시합니다.', 1);
