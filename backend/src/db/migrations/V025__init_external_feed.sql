-- V025 (003 US5): 외부 수집 피드(채용·자격증·공모전) + 수집 실행 이력.
-- FR-010(공식 오픈API·제휴 피드만, 크롤링 금지·일 단위 갱신), FR-011(기준 기간 초과 시 '최신 아님').
-- data-model §5: external_feed_item, feed_collection_run. 멱등 작성.

CREATE TABLE IF NOT EXISTS external_feed_item (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind         VARCHAR(20) NOT NULL,
  source       VARCHAR(60) NOT NULL,
  external_id  VARCHAR(191) NOT NULL,
  title        VARCHAR(300) NULL,
  collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  freshness    VARCHAR(10) NOT NULL DEFAULT 'fresh',
  payload      JSON NULL,
  CONSTRAINT chk_feed_kind CHECK (kind IN ('jobposting','certification','contest')),
  CONSTRAINT chk_feed_freshness CHECK (freshness IN ('fresh','stale')),
  UNIQUE KEY uq_feed_source_ext (source, external_id),
  INDEX idx_feed_kind_fresh (kind, freshness, collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feed_collection_run (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source       VARCHAR(60) NOT NULL,
  started_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at  TIMESTAMP NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'running',
  item_count   INT UNSIGNED NOT NULL DEFAULT 0,
  error        VARCHAR(500) NULL,
  CONSTRAINT chk_feed_run_status CHECK (status IN ('running','success','failed')),
  INDEX idx_feed_run_source (source, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
