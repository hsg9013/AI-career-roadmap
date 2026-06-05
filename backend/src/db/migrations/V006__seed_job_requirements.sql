-- V006: job_requirements 시드 데이터
-- FR-007 갭 진단의 기준이 되는 직무별 핵심 키워드/가중치 사전.
-- 실제 운영에서는 별도 어드민 큐레이션으로 갱신 — 본 시드는 개발/테스트용 초기값.

INSERT INTO job_requirements (industry_code, job_role_code, keywords_json, notes) VALUES
  ('IT', 'backend', JSON_OBJECT(
    'java', 0.8, 'spring', 0.8, 'kotlin', 0.6,
    'nodejs', 0.7, 'typescript', 0.7, 'express', 0.5,
    'sql', 0.9, 'mysql', 0.7, 'postgres', 0.6, 'redis', 0.5,
    'docker', 0.7, 'kubernetes', 0.5, 'aws', 0.7, 'gcp', 0.5,
    'git', 0.6, 'rest-api', 0.7, 'oop', 0.5, 'algorithm', 0.5
  ), '백엔드 개발자 — 서버/DB/인프라 핵심 역량');

INSERT INTO job_requirements (industry_code, job_role_code, keywords_json, notes) VALUES
  ('IT', 'frontend', JSON_OBJECT(
    'javascript', 0.9, 'typescript', 0.9,
    'react', 0.8, 'vue', 0.8, 'nextjs', 0.6,
    'html', 0.6, 'css', 0.6, 'tailwind', 0.5,
    'webpack', 0.4, 'vite', 0.5,
    'figma', 0.4, 'rest-api', 0.6, 'git', 0.6, 'a11y', 0.5
  ), '프론트엔드 개발자');

INSERT INTO job_requirements (industry_code, job_role_code, keywords_json, notes) VALUES
  ('IT', 'data', JSON_OBJECT(
    'python', 0.9, 'sql', 0.9, 'pandas', 0.7, 'numpy', 0.6,
    'spark', 0.6, 'airflow', 0.6, 'dbt', 0.5, 'bigquery', 0.6,
    'tableau', 0.5, 'statistics', 0.7, 'experimentation', 0.5
  ), '데이터 엔지니어/분석가');

INSERT INTO job_requirements (industry_code, job_role_code, keywords_json, notes) VALUES
  ('IT', 'ml', JSON_OBJECT(
    'python', 0.9, 'pytorch', 0.8, 'tensorflow', 0.6,
    'pandas', 0.7, 'numpy', 0.7, 'sklearn', 0.7,
    'mlops', 0.5, 'docker', 0.5, 'cuda', 0.4,
    'statistics', 0.7, 'linear-algebra', 0.5, 'paper-reading', 0.4
  ), 'ML 엔지니어/연구');

INSERT INTO job_requirements (industry_code, job_role_code, keywords_json, notes) VALUES
  ('FIN', 'quant', JSON_OBJECT(
    'python', 0.8, 'cpp', 0.6, 'sql', 0.6,
    'statistics', 0.9, 'probability', 0.9, 'time-series', 0.7,
    'backtest', 0.7, 'finance', 0.8, 'derivatives', 0.6,
    'pandas', 0.7, 'numpy', 0.7
  ), '퀀트/리서치')
