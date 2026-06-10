-- V018 (003 US2): 직무 요구역량 사전 확충 (5 → 50직무)
-- FR-005/SC-007: 각 활성 직무가 핵심 역량 키워드를 보유 → 갭 진단이 더 많은 학생에게 적용.
-- 기존 V006의 5직무(IT/backend,frontend,data,ml + FIN/quant)는 유지하고, 신규 45직무를 추가한다.
-- 개발/시연용 초기값 — 운영에서는 어드민 큐레이션으로 갱신.

INSERT INTO job_requirements (industry_code, job_role_code, keywords_json, notes) VALUES
  ('IT','devops', JSON_OBJECT('linux',0.8,'docker',0.8,'kubernetes',0.8,'terraform',0.7,'aws',0.8,'ci-cd',0.7,'monitoring',0.6,'networking',0.6,'bash',0.5), 'DevOps·인프라'),

  ('FIN','ib', JSON_OBJECT('finance',0.9,'accounting',0.8,'valuation',0.8,'excel',0.8,'financial-modeling',0.8,'m-and-a',0.6,'powerpoint',0.6,'english',0.6), '투자은행'),
  ('FIN','risk', JSON_OBJECT('statistics',0.8,'finance',0.8,'credit',0.7,'sql',0.6,'excel',0.7,'regulation',0.7,'risk-modeling',0.7,'python',0.5), '리스크·심사'),
  ('FIN','fintech-dev', JSON_OBJECT('java',0.7,'spring',0.7,'sql',0.7,'rest-api',0.7,'security',0.7,'payments',0.7,'aws',0.6,'finance',0.5), '핀테크 개발'),
  ('FIN','accounting', JSON_OBJECT('accounting',0.9,'ifrs',0.7,'tax',0.7,'excel',0.8,'erp',0.6,'audit',0.6,'finance',0.7), '회계·재무'),

  ('MFG','mechanical', JSON_OBJECT('cad',0.9,'solidworks',0.7,'catia',0.6,'mechanics',0.8,'tolerance',0.6,'gd-t',0.6,'materials',0.6), '기계 설계'),
  ('MFG','electrical', JSON_OBJECT('circuit',0.8,'pcb',0.7,'altium',0.6,'embedded',0.7,'signal',0.6,'power',0.6,'matlab',0.5), '전기·전자 설계'),
  ('MFG','production', JSON_OBJECT('process',0.8,'lean',0.7,'six-sigma',0.7,'mes',0.6,'safety',0.6,'scheduling',0.6,'excel',0.6), '생산·공정 관리'),
  ('MFG','quality', JSON_OBJECT('quality',0.9,'spc',0.7,'iso9001',0.7,'inspection',0.7,'root-cause',0.6,'measurement',0.6), '품질 관리'),
  ('MFG','scm', JSON_OBJECT('scm',0.9,'procurement',0.8,'inventory',0.7,'logistics',0.7,'erp',0.6,'negotiation',0.6,'excel',0.6), '구매·SCM'),

  ('BIO','rnd-bio', JSON_OBJECT('molecular-biology',0.9,'cell-culture',0.7,'pcr',0.7,'assay',0.7,'lab',0.7,'data-analysis',0.6), '바이오 R&D'),
  ('BIO','clinical', JSON_OBJECT('clinical-trial',0.9,'gcp',0.8,'protocol',0.7,'monitoring',0.7,'regulation',0.6,'medical',0.6), '임상 연구'),
  ('BIO','regulatory', JSON_OBJECT('regulatory-affairs',0.9,'mfds',0.7,'fda',0.6,'documentation',0.7,'compliance',0.7,'medical',0.6), '인허가'),
  ('BIO','bioinformatics', JSON_OBJECT('python',0.8,'r',0.7,'genomics',0.8,'ngs',0.7,'statistics',0.7,'linux',0.6,'sql',0.5), '생명정보'),
  ('BIO','qa-bio', JSON_OBJECT('gmp',0.8,'quality',0.8,'validation',0.7,'sop',0.7,'audit',0.6,'documentation',0.6), '바이오 품질보증'),

  ('GAME','game-client', JSON_OBJECT('unity',0.8,'unreal',0.7,'cpp',0.7,'csharp',0.7,'graphics',0.6,'optimization',0.6,'math',0.6), '게임 클라이언트'),
  ('GAME','game-server', JSON_OBJECT('cpp',0.7,'java',0.6,'networking',0.8,'database',0.7,'redis',0.6,'concurrency',0.7,'aws',0.5), '게임 서버'),
  ('GAME','game-design', JSON_OBJECT('game-design',0.9,'level-design',0.7,'balancing',0.7,'storytelling',0.6,'documentation',0.6,'analytics',0.5), '게임 기획'),
  ('GAME','tech-art', JSON_OBJECT('shader',0.8,'unity',0.7,'unreal',0.7,'3d',0.7,'pipeline',0.6,'python',0.5), '테크니컬 아티스트'),
  ('GAME','game-pm', JSON_OBJECT('project-management',0.8,'analytics',0.6,'live-ops',0.7,'communication',0.7,'scheduling',0.6,'game-design',0.5), '게임 PM'),

  ('COMMERCE','md', JSON_OBJECT('merchandising',0.9,'sourcing',0.7,'pricing',0.7,'excel',0.7,'trend',0.6,'negotiation',0.6,'data-analysis',0.6), '상품기획'),
  ('COMMERCE','ecommerce-ops', JSON_OBJECT('ecommerce',0.9,'operations',0.7,'cs',0.6,'excel',0.7,'analytics',0.6,'marketing',0.5), '이커머스 운영'),
  ('COMMERCE','logistics', JSON_OBJECT('logistics',0.9,'wms',0.7,'inventory',0.7,'fulfillment',0.7,'scm',0.6,'excel',0.6), '물류·풀필먼트'),
  ('COMMERCE','category-mgmt', JSON_OBJECT('category',0.8,'pricing',0.7,'data-analysis',0.7,'excel',0.7,'vendor',0.6,'planning',0.6), '카테고리 관리'),
  ('COMMERCE','retail-marketing', JSON_OBJECT('marketing',0.8,'promotion',0.7,'crm',0.6,'analytics',0.6,'branding',0.6,'sns',0.6), '리테일 마케팅'),

  ('MEDIA','content-planning', JSON_OBJECT('content-planning',0.9,'storytelling',0.7,'editing',0.6,'sns',0.6,'analytics',0.5,'trend',0.6), '콘텐츠 기획'),
  ('MEDIA','video-edit', JSON_OBJECT('premiere',0.8,'aftereffects',0.7,'editing',0.8,'storytelling',0.6,'color',0.5,'sound',0.5), '영상 편집'),
  ('MEDIA','journalist', JSON_OBJECT('writing',0.9,'interview',0.7,'research',0.7,'editing',0.7,'fact-check',0.6,'media',0.6), '기자·에디터'),
  ('MEDIA','ux-writer', JSON_OBJECT('writing',0.9,'ux',0.7,'microcopy',0.7,'localization',0.5,'figma',0.5,'research',0.5), 'UX 라이터'),
  ('MEDIA','social-media', JSON_OBJECT('sns',0.9,'content',0.7,'analytics',0.6,'community',0.7,'copywriting',0.6,'trend',0.6), '소셜미디어 운영'),

  ('MARKETING','performance', JSON_OBJECT('google-ads',0.8,'meta-ads',0.8,'ga4',0.7,'sql',0.6,'analytics',0.8,'ab-test',0.6,'excel',0.6), '퍼포먼스 마케터'),
  ('MARKETING','brand', JSON_OBJECT('branding',0.9,'campaign',0.7,'communication',0.7,'market-research',0.6,'storytelling',0.6), '브랜드 마케터'),
  ('MARKETING','crm', JSON_OBJECT('crm',0.9,'marketing-automation',0.7,'sql',0.7,'segmentation',0.7,'analytics',0.7,'email',0.6), 'CRM 마케터'),
  ('MARKETING','content-marketing', JSON_OBJECT('content',0.9,'seo',0.7,'copywriting',0.7,'analytics',0.6,'sns',0.6,'planning',0.6), '콘텐츠 마케터'),
  ('MARKETING','growth', JSON_OBJECT('growth',0.8,'ab-test',0.7,'analytics',0.8,'sql',0.7,'funnel',0.7,'product',0.6), '그로스 마케터'),

  ('DESIGN','ux-ui', JSON_OBJECT('figma',0.9,'ui',0.8,'ux',0.8,'prototyping',0.7,'design-system',0.7,'research',0.6), 'UX·UI 디자이너'),
  ('DESIGN','graphic', JSON_OBJECT('photoshop',0.8,'illustrator',0.8,'typography',0.7,'layout',0.7,'branding',0.6), '그래픽 디자이너'),
  ('DESIGN','product-design', JSON_OBJECT('figma',0.8,'ux',0.8,'product',0.7,'prototyping',0.7,'research',0.7,'design-system',0.6), '프로덕트 디자이너'),
  ('DESIGN','motion', JSON_OBJECT('aftereffects',0.9,'motion',0.8,'animation',0.8,'3d',0.5,'storytelling',0.6), '모션 디자이너'),
  ('DESIGN','brand-design', JSON_OBJECT('branding',0.9,'identity',0.8,'typography',0.7,'illustrator',0.7,'layout',0.6), '브랜드 디자이너'),

  ('PUBLIC','admin-officer', JSON_OBJECT('administration',0.8,'policy',0.6,'document',0.7,'communication',0.7,'law',0.6,'excel',0.6), '행정직'),
  ('PUBLIC','policy-research', JSON_OBJECT('research',0.9,'policy',0.8,'statistics',0.7,'writing',0.7,'economics',0.6,'data-analysis',0.6), '정책 연구'),
  ('PUBLIC','public-data', JSON_OBJECT('sql',0.8,'python',0.7,'data-analysis',0.8,'statistics',0.7,'visualization',0.6,'gis',0.5), '공공 데이터'),
  ('PUBLIC','social-welfare', JSON_OBJECT('social-welfare',0.9,'counseling',0.7,'community',0.7,'casework',0.6,'communication',0.7), '사회복지'),
  ('PUBLIC','public-relations', JSON_OBJECT('pr',0.9,'writing',0.7,'media',0.7,'communication',0.8,'sns',0.6,'event',0.5), '공공 홍보');
