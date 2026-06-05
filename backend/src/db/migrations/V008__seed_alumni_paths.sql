-- V008: 선배 합격 경로 초기 시드 (002-intent-specify T071, FR-019)
-- 개발/파일럿용 익명 데이터. anonymized_id 는 합성 시드 문자열의 해시이며 실제 인물과 무관.
-- IT/backend · y4plus : 6명 → k≥5 충족(코호트 기반 추천)
-- IT/frontend · y4plus : 3명 → k<5 (폴백 경로 시연)

INSERT INTO alumni_paths (anonymized_id, industry_code, job_role_code, major_field, grade_band, success_year) VALUES
  (SHA2('seed:be-1',256), 'IT', 'backend',  'engineering', 'y4plus', 2024),
  (SHA2('seed:be-2',256), 'IT', 'backend',  'engineering', 'y4plus', 2024),
  (SHA2('seed:be-3',256), 'IT', 'backend',  'engineering', 'y4plus', 2025),
  (SHA2('seed:be-4',256), 'IT', 'backend',  'engineering', 'y4plus', 2025),
  (SHA2('seed:be-5',256), 'IT', 'backend',  'engineering', 'y4plus', 2025),
  (SHA2('seed:be-6',256), 'IT', 'backend',  'engineering', 'y4plus', 2024),
  (SHA2('seed:fe-1',256), 'IT', 'frontend', 'engineering', 'y4plus', 2024),
  (SHA2('seed:fe-2',256), 'IT', 'frontend', 'engineering', 'y4plus', 2025),
  (SHA2('seed:fe-3',256), 'IT', 'frontend', 'engineering', 'y4plus', 2025);

INSERT INTO alumni_path_activities (alumni_path_id, period, activity_type, detail, skill_tag) VALUES
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-1',256)), 'Y2', 'project',     'DB 설계 기반 사이드 프로젝트',        'sql'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-1',256)), 'Y3', 'internship',  '백엔드 인턴 — Spring API 개발',       'spring'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-1',256)), 'Y3', 'project',     'Docker 컨테이너화 배포 경험',         'docker'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-1',256)), 'Y4', 'contest',     '알고리즘 대회 입상',                  'algorithm'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-2',256)), 'Y2', 'course',      'DB 시스템 수강 + 쿼리 튜닝 과제',     'sql'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-2',256)), 'Y3', 'project',     'Spring 기반 팀 프로젝트',             'spring'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-2',256)), 'Y4', 'internship',  'AWS 인프라 운영 인턴',                'aws'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-2',256)), 'Y3', 'project',     'REST API 설계 프로젝트',              'rest-api'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-3',256)), 'Y1', 'course',      '자료구조/알고리즘 기초',              'algorithm'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-3',256)), 'Y3', 'project',     'Spring Boot 서비스 구축',             'spring'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-3',256)), 'Y4', 'project',     'Docker Compose 멀티서비스',           'docker'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-3',256)), 'Y4', 'contest',     '데이터 모델링 해커톤',                'sql'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-4',256)), 'Y2', 'project',     'Spring MVC 게시판',                   'spring'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-4',256)), 'Y3', 'internship',  '백엔드 인턴 — 쿼리 최적화',           'sql'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-4',256)), 'Y4', 'project',     'REST API 게이트웨이 구현',            'rest-api'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-4',256)), 'Y3', 'certification','AWS 자격증 취득',                    'aws'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-5',256)), 'Y3', 'project',     'Docker 기반 CI 파이프라인',           'docker'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-5',256)), 'Y4', 'internship',  'Spring 마이크로서비스 인턴',          'spring'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-5',256)), 'Y2', 'contest',     '코딩 테스트 대비 캠프',               'algorithm'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-5',256)), 'Y3', 'project',     '대용량 SQL 집계 프로젝트',            'sql'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-6',256)), 'Y2', 'course',      'Java 객체지향 프로그래밍',            'java'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-6',256)), 'Y3', 'project',     'Spring Security 인증 구현',           'spring'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-6',256)), 'Y4', 'project',     'Kubernetes 배포 실습',                'kubernetes'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:be-6',256)), 'Y3', 'internship',  'DB 마이그레이션 인턴',                'sql'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:fe-1',256)), 'Y2', 'project',     'React 컴포넌트 라이브러리',           'react'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:fe-1',256)), 'Y3', 'internship',  '프론트 인턴 — TypeScript 전환',       'typescript'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:fe-2',256)), 'Y3', 'project',     'Vue SPA 대시보드',                    'vue'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:fe-2',256)), 'Y4', 'project',     '웹 접근성 개선 프로젝트',             'a11y'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:fe-3',256)), 'Y2', 'course',      '웹 프론트엔드 기초',                  'javascript'),
  ((SELECT id FROM alumni_paths WHERE anonymized_id=SHA2('seed:fe-3',256)), 'Y4', 'internship',  'React 기반 서비스 인턴',              'react');
