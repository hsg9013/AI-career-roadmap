-- V017 (003 US2): 직무·산업 사전 카탈로그
-- FR-004/FR-005: 회원가입 관심 산업·희망 직무 선택지 + 진단 기준의 SSOT.
-- 기존 job_requirements(keywords_json)는 그대로 역량 사전으로 사용하고,
-- 여기서는 "산업/직무 표시 메타"(선택지 노출용)를 정규화 저장한다.

CREATE TABLE industries (
  code        VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_roles (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  industry_code  VARCHAR(40) NOT NULL,
  code           VARCHAR(80) NOT NULL,
  name           VARCHAR(120) NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_jobrole (industry_code, code),
  FOREIGN KEY (industry_code) REFERENCES industries(code) ON DELETE CASCADE,
  INDEX idx_jobrole_industry (industry_code, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 산업 10개 ──
INSERT INTO industries (code, name, sort_order) VALUES
  ('IT',     'IT·소프트웨어',     1),
  ('FIN',    '금융',             2),
  ('MFG',    '제조·엔지니어링',   3),
  ('BIO',    '바이오·헬스케어',   4),
  ('GAME',   '게임',             5),
  ('COMMERCE','커머스·유통',      6),
  ('MEDIA',  '미디어·콘텐츠',     7),
  ('MARKETING','마케팅',         8),
  ('DESIGN', '디자인',           9),
  ('PUBLIC', '공공·행정',        10);

-- ── 직무 50개 (산업당 5) ──
INSERT INTO job_roles (industry_code, code, name, sort_order) VALUES
  ('IT','backend','백엔드 개발자',1),
  ('IT','frontend','프론트엔드 개발자',2),
  ('IT','data','데이터 엔지니어·분석가',3),
  ('IT','ml','ML 엔지니어',4),
  ('IT','devops','DevOps·인프라 엔지니어',5),

  ('FIN','quant','퀀트·리서치',1),
  ('FIN','ib','투자은행(IB)',2),
  ('FIN','risk','리스크·심사',3),
  ('FIN','fintech-dev','핀테크 개발',4),
  ('FIN','accounting','회계·재무',5),

  ('MFG','mechanical','기계 설계',1),
  ('MFG','electrical','전기·전자 설계',2),
  ('MFG','production','생산·공정 관리',3),
  ('MFG','quality','품질 관리(QA·QC)',4),
  ('MFG','scm','구매·SCM',5),

  ('BIO','rnd-bio','바이오 R&D',1),
  ('BIO','clinical','임상 연구(CRA)',2),
  ('BIO','regulatory','인허가(RA)',3),
  ('BIO','bioinformatics','생명정보(Bioinformatics)',4),
  ('BIO','qa-bio','바이오 품질보증',5),

  ('GAME','game-client','게임 클라이언트',1),
  ('GAME','game-server','게임 서버',2),
  ('GAME','game-design','게임 기획',3),
  ('GAME','tech-art','테크니컬 아티스트',4),
  ('GAME','game-pm','게임 PM',5),

  ('COMMERCE','md','상품기획(MD)',1),
  ('COMMERCE','ecommerce-ops','이커머스 운영',2),
  ('COMMERCE','logistics','물류·풀필먼트',3),
  ('COMMERCE','category-mgmt','카테고리 관리',4),
  ('COMMERCE','retail-marketing','리테일 마케팅',5),

  ('MEDIA','content-planning','콘텐츠 기획',1),
  ('MEDIA','video-edit','영상 편집·제작',2),
  ('MEDIA','journalist','기자·에디터',3),
  ('MEDIA','ux-writer','UX 라이터',4),
  ('MEDIA','social-media','소셜미디어 운영',5),

  ('MARKETING','performance','퍼포먼스 마케터',1),
  ('MARKETING','brand','브랜드 마케터',2),
  ('MARKETING','crm','CRM·마케팅 자동화',3),
  ('MARKETING','content-marketing','콘텐츠 마케터',4),
  ('MARKETING','growth','그로스 마케터',5),

  ('DESIGN','ux-ui','UX·UI 디자이너',1),
  ('DESIGN','graphic','그래픽 디자이너',2),
  ('DESIGN','product-design','프로덕트 디자이너',3),
  ('DESIGN','motion','모션 디자이너',4),
  ('DESIGN','brand-design','브랜드 디자이너',5),

  ('PUBLIC','admin-officer','행정직',1),
  ('PUBLIC','policy-research','정책 연구',2),
  ('PUBLIC','public-data','공공 데이터',3),
  ('PUBLIC','social-welfare','사회복지',4),
  ('PUBLIC','public-relations','공공 홍보',5);
