-- 005: 제휴 배너 타겟팅 — 학생 목표 산업·직무에 맞춰 노출
-- NULL = 타겟 없음(전체 노출). industry만 지정 시 해당 산업 전체, job까지 지정 시 정확 매칭.
ALTER TABLE partner_banner
  ADD COLUMN industry_code VARCHAR(40) NULL AFTER discount_text,
  ADD COLUMN job_role_code VARCHAR(80) NULL AFTER industry_code;

CREATE INDEX idx_banner_target ON partner_banner (active, industry_code, job_role_code);
