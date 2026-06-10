-- V021 (003 US1): AI 추론 로그 + 비용 가드 카운터
-- FR-001/FR-002(실 AI 연동·100% 폴백), SC-006(폴백 시 사용자 오류 미노출).
-- 모든 AI 기능 호출 1건당 ai_inference_log 1행. 결과 페이로드는 저장하지 않고 참조·관측 메타만 기록.

CREATE TABLE ai_inference_log (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  feature        VARCHAR(24) NOT NULL,
  subject_ref    VARCHAR(120) NULL,
  model          VARCHAR(80) NULL,
  source         VARCHAR(16) NOT NULL,
  fallback_reason VARCHAR(20) NOT NULL DEFAULT 'none',
  input_tokens   INT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens  INT UNSIGNED NOT NULL DEFAULT 0,
  latency_ms     INT UNSIGNED NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ai_feature CHECK (feature IN ('diagnosis','roadmap','document','mission_feedback')),
  CONSTRAINT chk_ai_source CHECK (source IN ('ai','fallback_rule')),
  CONSTRAINT chk_ai_reason CHECK (fallback_reason IN ('none','error','timeout','budget','no_credentials')),
  INDEX idx_ai_feature_time (feature, created_at),
  INDEX idx_ai_source (source, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 비용 가드: 기간(window_key)별 누적 토큰. 일 상한 초과 시 신규 AI 호출은 폴백 경로로 라우팅(FR-002).
CREATE TABLE ai_budget_counter (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  period       VARCHAR(8) NOT NULL,
  window_key   VARCHAR(16) NOT NULL,
  tokens_used  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_budget_period CHECK (period IN ('day','month')),
  UNIQUE KEY uq_budget_window (period, window_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
