#!/usr/bin/env node
// DDBM(abc.sumzip.com) ISP 캔버스 자동 입력 스크립트
//
// 사용법:
//   DDBM_MEMBER_ID=내아이디 DDBM_MEMBER_PW=내비번 node scripts/ddbm-isp-fill.mjs
//     → 로그인 후 내 캔버스 목록 출력 (어떤 canvasId 인지 확인)
//   DDBM_MEMBER_ID=... DDBM_MEMBER_PW=... DDBM_CANVAS_ID=12 node scripts/ddbm-isp-fill.mjs
//     → 해당 캔버스의 13개 블록을 ISP 내용으로 채움
//   ... DDBM_CANVAS_ID=12 DRY_RUN=1 node scripts/ddbm-isp-fill.mjs
//     → 실제 저장 없이 매칭 결과만 미리보기
//
// 인증: 세션 쿠키 방식(withCredentials). 로그인 응답의 Set-Cookie를 모든 요청에 재전송.

const BASE = process.env.DDBM_BASE || 'https://abc.sumzip.com/api/v1';
const MEMBER_ID = process.env.DDBM_MEMBER_ID;
const MEMBER_PW = process.env.DDBM_MEMBER_PW;
const CANVAS_ID = process.env.DDBM_CANVAS_ID;
const DRY_RUN = process.env.DRY_RUN === '1';

let cookie = '';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(',').map((c) => c.split(';')[0]).join('; ');
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// ── 13개 ISP 섹션 내용 (캔버스용 압축본, mis2601 AI 진로 로드맵 프로젝트 기준) ──
// 각 항목의 match: 블록 라벨/키에서 찾을 키워드. 첫 매칭 우선.
const SECTIONS = [
  { match: ['비전', 'vision', 'objective', '목표'], content:
`【비전】 선배 합격 데이터 + 현직자 피드백을 결합한 데이터 기반 맞춤형 커리어 설계·포트폴리오 자동화 플랫폼.
【4대 목표】 ①역량 갭 진단 ②합격 로드맵 설계 ③실무 미션·하이브리드 피드백 ④이력 자동화·진척 점검
【수익 4채널】 B2C(멤버십·단건) / B2B·B2G(대학 SaaS·기업 수수료) / 광고 / 제휴 수수료` },

  { match: ['동인', 'driver', '환경', 'environment'], content:
`【시장 동인】 진로 정보 비대칭, 포트폴리오 수기 반복, 검증된 피드백 부재, 대학 취업률 KPI, 기업 조기 인재 발굴 수요.
【세그먼트】 학생(1차) / 대학 취업지원센터(B2G) / 기업HR·현직자(B2B+멘토) / 선배(데이터 공급자).
【규제·기술】 한국 PIPA·정보통신망법 준수. 웹+모바일(iOS15+/Android9+) 동시 출시. 외부 의존: PortOne·NaverCloud·FCM/APNs.` },

  { match: ['as-is', 'asis', '현황', 'current feature', '기능 현황'], content:
`【시장 현행(대체 대상)】 채용포털·후기로 산발 탐색, 자가 역량 판단, 워드 수기 포트폴리오, 단발 첨삭, 개인 메모 진척관리.
【구축 진척】 Setup(모노레포·인프라·CI) 완료 ✅ / Foundational(인증·DB·미들웨어) 착수 🔄 / User Story 미구현.
정량 진척: 태스크 27/194 (≈14%).` },

  { match: ['문제', 'pain', 'limit', '한계'], content:
`【사용자】 학생 입력 번거로움, 추천 알고리즘 부재(인기직무 쏠림), 비표준 피드백, 민감정보 보안 공백, 채용정보 노후화.
【구축 리스크】 데이터 콜드스타트(선배 데이터 0건), MariaDB 단일 장애점, 테스트 우선원칙 부분 적용, 거버넌스(constitution) 미문서화.` },

  { match: ['데이터·기술', '데이터 현황', '기술 현황', 'data & tech', 'current data'], content:
`【데이터】 운영 데이터 미축적(신규). 35개 엔티티 DDL 설계완료, 마이그레이션 적재 전.
【기술자산】 MariaDB10·Redis7·MinIO 컨테이너, Node20+Express4 백엔드(/healthz 가동), Vite5+Vue3.4 웹, Capacitor6+Ionic 모바일, nginx, GitLab CI 골격.
【네트워크 표준(불변)】 p16.sumzip.com / API /api/v1 / 로컬 9516·9536·3306·6379·9000.` },

  { match: ['갭', 'gap', '개선 기회', 'opportunit'], content:
`【핵심 갭→기회】
G1 시계열 합격경로 부재 → 선배 데이터 로드맵(US2)
G2 정량 진단 불가 → 갭 진단 시각화(US1)
G3 포트폴리오 수기 → 활동 자동분류·문서 생성(US3)
G4 단발 피드백 → AI+현직자 하이브리드(US4)
G6 콜드스타트 → 선배 기부 인센티브(US10)
G7~G8 대학·기업 채널, G9 보안·규제(k-익명성·암호화·동의).` },

  { match: ['to-be 목표', 'tobe 목표', 'target feature', '목표 기능'], content:
`【기능 12그룹 / FR 52건】 계정·권한 / 프로필·진단 / 합격로드맵 / 활동·문서자동화 / 미션·피드백 / 진척·알림 / 데이터보호 / 대학 인터페이스 / 기업 인터페이스 / 결제·인센티브 / 외부데이터 / 운영관리.
【단계】 P1 US1(진단) → P2 US2·US3(로드맵·문서) → P3 US4~US7(미션·알림·멘토·대학) → P4 US8~US10(기업·결제·선배데이터).` },

  { match: ['데이터 아키텍처', 'data architecture', 'tobe 데이터', 'to-be 데이터'], content:
`【저장 계층】 MariaDB10(관계형·35엔티티) / MinIO(파일·presigned) / Redis7(세션·BullMQ·rate-limit).
【도메인】 학생·추천엔진·미션피드백·알림일정·파트너·결제정산·동의감사.
【보호】 선배데이터 k-익명성 k≥5(미달분 풀 제외), 민감컬럼 AES-GCM 암호화, 5종 동의 이력 적재, 대학공유 3단계 차등, 졸업+1년 후 자동 익명화·파기.` },

  { match: ['애플리케이션', '기술 아키텍처', 'app & tech', 'application', 'tobe 애플', 'to-be 애플'], content:
`【구조】 pnpm 모노레포 5워크스페이스: backend / frontend-web(Vite+Vue) / frontend-mobile(Capacitor+Ionic) / frontend-shared / shared/types(OpenAPI→TS). nginx 단일 도메인 라우팅.
【기술결정 R-1~R-8】 LLM+룰 추천 / MinIO / PortOne(결제·Payouts) / NaverCloud+FCM·APNs / JWT+refresh회전+scope / Capacitor6 / 대학 집계·개인 분리 / 멘토 하이브리드 정산.
【성능】 로드맵 p95<2s, CRUD p95<200ms, 콜드스타트<3s, 푸시<5s.` },

  { match: ['기대효과', '성공지표', 'kpi', 'benefit', 'expected'], content:
`【핵심 KPI(SC)】 입력→첫진단 15분내 / 7일내 3대행동 50%+ / 로드맵 완료 70%+ / 추천 거부율 ≤30% / 포트폴리오 활용 90%+ / 피드백 5영업일 80%+ / k-익명성 100% / 유출 0건 / 90일 결제전환 8%+ / 월 해지율 ≤5% / 학기말 재방문 60%+ / 완료vs거부 매칭점수차 ≥20%p.` },

  { match: ['이행 과제', '우선순위', 'migration task', 'priority'], content:
`【우선순위/단계】
전제: Phase1 Setup✅ → Phase2 Foundational🔄(인증·DB·미들웨어)
P1: Phase3 US1 갭진단(MVP)
P2: Phase4~5 US2 로드맵·US3 문서
P3: Phase6~9 US4 미션·US5 알림·US6 멘토정산·US7 대학
P4: Phase10~12 US8 기업·US9 결제·US10 선배데이터
보강: Phase13 analyze 보강 → Phase14 Polish(E2E·deploy).
의존성: US9 결제는 US6 R-8 마이그레이션(V021)에 의존.` },

  { match: ['로드맵', 'roadmap', '이행 로드맵', 'implementation roadmap'], content:
`【타임라인】 현재(2026-05) Setup완료·Foundational착수(27/194) →
[1] Foundational 완료 → [2] P1 US1 MVP 출시 → [3] P2 로드맵·문서 →
[4] P3 미션·알림·멘토정산·대학 → [5] P4 기업·결제·선배데이터 →
[6] Phase13 보강 → Phase14 Polish(prod deploy·롤백).
증분 인도: 각 User Story 독립 검증 슬라이스로 순차 출시. 모바일 E2E는 P3 도입.` },

  { match: ['위험', '제약', '거버넌스', 'risk', 'constraint', 'governance'], content:
`【위험·완화】 콜드스타트→선배 인센티브 / 추천편향→거부학습·민감속성 배제 / 유출→권한·감사·AES-GCM / DB SPOF→replica예정 / SLA초과→재할당·AI대체 / 데이터노후→"최신아님" 표시.
【제약】 PIPA·정보통신망법, k-익명성 k≥5, 검수 SLA 5영업일, 네트워크 표준값 불변, 초기 한국어 단일, 매칭시 민감속성 배제.
【거버넌스】 운영자 검수 큐, 운영지표 대시보드, 처리방침·보존기간 명시·재동의, constitution 명문화 예정.` },
];

// 캔버스 #8(ISP) 블록 키 순서 — SECTIONS 배열과 1:1 정렬
const KEY_ORDER = [
  'vision', 'drivers', 'asis_functions', 'asis_painpoints', 'asis_data_tech',
  'gap_analysis', 'tobe_functions', 'tobe_data', 'tobe_app_tech',
  'benefits_kpi', 'migration_tasks', 'roadmap', 'risks_governance',
];

function pickContentFor(block) {
  // 1순위: 블록 키 정확 매칭
  const idx = KEY_ORDER.indexOf(block.key);
  if (idx >= 0 && SECTIONS[idx]) return SECTIONS[idx];
  // 2순위: 키워드 부분매칭 (스키마가 바뀐 경우 대비) — 단어 경계 우선
  const hay = `${block.label || ''} ${block.title || ''} ${block.name || ''}`.toLowerCase();
  for (const s of SECTIONS) {
    if (s.match.some((m) => hay.includes(m.toLowerCase()))) return s;
  }
  return null;
}

const ISP_TYPE_ID = Number(process.env.DDBM_ISP_TYPE_ID || 8); // "정보전략계획(ISP) 캔버스"
const ISP_TITLE = process.env.DDBM_CANVAS_TITLE || 'AI 진로 로드맵 ISP';

async function main() {
  if (!MEMBER_ID || !MEMBER_PW) {
    console.error('❌ DDBM_MEMBER_ID, DDBM_MEMBER_PW 환경변수가 필요합니다.');
    process.exit(1);
  }

  console.log('🔐 멤버 로그인...');
  const loginRes = await call('POST', '/auth/member/login', { member_id: MEMBER_ID, password: MEMBER_PW });
  const member = loginRes?.data?.member || loginRes?.member || {};
  console.log('   로그인 성공');

  // 팀 결정
  let teamId = Number(process.env.DDBM_TEAM_ID) || member.teamId
    || member.memberships?.[0]?.teamId;
  if (!teamId) {
    console.error('❌ teamId를 찾을 수 없습니다. DDBM_TEAM_ID로 지정하세요. member=' + JSON.stringify(member));
    process.exit(1);
  }
  console.log(`   팀 #${teamId}`);

  let canvasId = CANVAS_ID;

  if (!canvasId) {
    // 팀 캔버스 목록에서 ISP 캔버스 찾기
    const list = await call('GET', `/teams/${teamId}/canvases`);
    const arr = list?.data || list || [];
    console.log(`\n📋 팀 캔버스 ${arr.length}개:`);
    for (const c of arr) console.log(`   id=${c.id}  "${c.title}"  type=${c.canvas_type?.name || c.canvas_type_id}(${c.canvas_type_id})`);
    const isp = arr.find((c) => (c.canvas_type_id === ISP_TYPE_ID) || /isp|정보전략/i.test(c.canvas_type?.name || ''));
    if (isp) {
      canvasId = isp.id;
      console.log(`\n→ 기존 ISP 캔버스 사용: #${canvasId} "${isp.title}"`);
    } else {
      if (DRY_RUN) { console.log('\n(DRY RUN) ISP 캔버스 없음 — 실제 실행 시 생성됩니다.'); return; }
      console.log(`\n🆕 ISP 캔버스 생성 (type=${ISP_TYPE_ID}, title="${ISP_TITLE}")...`);
      const created = await call('POST', `/teams/${teamId}/canvases`, { canvas_type_id: ISP_TYPE_ID, title: ISP_TITLE });
      canvasId = (created?.data || created)?.id;
      console.log(`   생성됨: #${canvasId}`);
    }
  }

  console.log(`\n🎨 캔버스 #${canvasId} 조회...`);
  const canvasRes = await call('GET', `/canvases/${canvasId}`);
  const canvas = canvasRes?.data || canvasRes;
  const blocks = canvas?.canvas_type?.block_schema?.blocks || [];
  console.log(`   "${canvas.title}" — 블록 ${blocks.length}개`);

  let filled = 0, skipped = 0;
  for (const block of blocks) {
    const sec = pickContentFor(block);
    const label = block.label || block.title || block.name || block.key;
    if (!sec) { console.log(`   ⏭️  매칭 없음: [${block.key}] ${label}`); skipped++; continue; }
    if (DRY_RUN) {
      console.log(`   ✅ [${block.key}] ${label}  ← ${sec.content.slice(0, 40)}...`);
      filled++; continue;
    }
    await call('PUT', `/canvases/${canvasId}/blocks/${block.key}`, { content: sec.content });
    console.log(`   ✅ 저장: [${block.key}] ${label}`);
    filled++;
  }
  console.log(`\n완료 — 채움 ${filled} / 건너뜀 ${skipped}${DRY_RUN ? ' (DRY RUN, 실제 저장 안 함)' : ''}`);
}

main().catch((e) => { console.error('💥', e.message); process.exit(1); });
