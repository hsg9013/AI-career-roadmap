#!/usr/bin/env node
// DDBM '시스템 의도' — ISP 캔버스 기반 명세를 단계별 의도에 추가하고 Speckit 폴더에 저장
//
//   DDBM_MEMBER_ID=abc0119 DDBM_MEMBER_PW=pioneer26 node scripts/ddbm-intent-save.mjs
//   옵션: DRY_RUN=1 (레코드 추가/저장 없이 미리보기), SKIP_OPTIONAL=1 (specify만)

const BASE = process.env.DDBM_BASE || 'https://abc.sumzip.com/api/v1';
const MEMBER_ID = process.env.DDBM_MEMBER_ID;
const MEMBER_PW = process.env.DDBM_MEMBER_PW;
const DRY_RUN = process.env.DRY_RUN === '1';
const SKIP_OPTIONAL = process.env.SKIP_OPTIONAL === '1';
const SPECKIT_FOLDER = process.env.DDBM_SPECKIT_FOLDER || '/Users/pioneer16/mis2601/specs/001-ai-career-roadmap';

let cookie = '';
async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((c) => c.split(';')[0]).join('; ');
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// ── ISP 캔버스 기반 단계별 의도(명세) 레코드 ──
const SPECIFY = `## [ISP 기반 시스템 명세] AI 기반 커리어 로드맵·포트폴리오 관리 서비스

### 비전·목표
선배 합격 데이터와 현직자 피드백을 결합한 데이터 기반 맞춤형 커리어 설계·포트폴리오 자동화 플랫폼.
4대 목표: ①역량 갭 진단 ②합격 로드맵 설계 ③실무 미션·하이브리드 피드백 ④이력 자동화·진척 점검.
수익 4채널: B2C(멤버십·단건) / B2B·B2G(대학 SaaS·기업 수수료) / 광고 / 제휴.

### 대상 사용자 (5종 역할)
학생(1차) · 현직자 멘토 · 기업 HR · 대학 관리자 · 운영자.

### 핵심 기능 명세 (FR 52건 / 12그룹)
1. 계정·권한: 5종 역할, 이메일·소셜 로그인, .ac.kr 검증, 재직 검수, 데이터 4권한(열람·수정·내보내기·삭제).
2. 프로필·진단: 통합 프로필(키워드+자유), 갭 진단 시각화(레이더), 목표 직무 최대 3개.
3. 합격 로드맵: 선배 경로 분석, 시계열 추천+근거, 완료/건너뛰기 재계산, 표본부족(k<5) 명시, 편향 속성 배제.
4. 활동·문서 자동화: 활동 자동 태깅, 이력서·자소서·포트폴리오 생성, 인용 추적, PDF/공유링크, 템플릿 전환.
5. 미션·피드백: 현직자 미션, AI 1차 분석, 통합 피드백, 5영업일 SLA 재할당/AI 대체, 멘토 품질지표.
6. 진척·알림: 연 4회 정기 리포트, 3채널 알림(인앱/이메일/푸시+fallback), 채널·빈도 설정.
7. 데이터 보호: k-익명성 k≥5, 권한 기반 접근·감사, 5종 통합 동의, PIPA 준수.
8. 대학 인터페이스: 집계/개인 이중 모드, 필터·익명 내보내기, 라이선스 청구 기초자료.
9. 기업 인터페이스: 직무 등록·익명 집계, 공고 노출, 컨택→수락 식별 공개, 성사 3단계, 광고 구분.
10. 결제·인센티브: 멤버십·단건, 권한 즉시 활성, 갱신·해지·환불, 멘토 정산(정액/수수료), 선배 기부 인센티브.
11. 외부 데이터: 일 단위 채용·자격증 갱신, 노후화 표시, 제휴 추적.
12. 운영·관리: 검수·승인·반려, 신고 큐, 운영 지표 대시보드.

### 성공 지표 (핵심 KPI)
입력→첫진단 15분내, 7일내 3대행동 50%+, 로드맵 완료 70%+, 추천 거부율 ≤30%,
포트폴리오 활용 90%+, 피드백 5영업일 80%+, k-익명성 100%, 유출 0건,
90일 결제전환 8%+, 월 해지율 ≤5%, 학기말 재방문 60%+.

### 제약·거버넌스
한국 PIPA·정보통신망법 준수, k-익명성 k≥5 강제, 미션 검수 SLA 5영업일,
네트워크 표준값(p16.sumzip.com / 9516·9536·3306·6379·9000) 불변, 초기 한국어 단일, 매칭 시 민감속성 배제.`;

const PLAN = `## [ISP 기반 계획 의도] TO-BE 데이터·애플리케이션·기술 아키텍처

### 시스템 구조
pnpm 모노레포 5워크스페이스: backend / frontend-web(Vite+Vue3.4) / frontend-mobile(Capacitor6+Ionic) / frontend-shared / shared/types(OpenAPI→TS). nginx 단일 도메인 라우팅(p16.sumzip.com).

### 기술 결정 (R-1 ~ R-8)
R-1 LLM+룰 하이브리드 추천 / R-2 MinIO(S3) / R-3 PortOne(결제·Payouts) / R-4 NaverCloud+FCM·APNs /
R-5 JWT 액세스+DB refresh 회전+scope / R-6 Capacitor6+Ionic / R-7 대학 집계·개인 분리+차등동의 / R-8 멘토 하이브리드 정산.

### 데이터 아키텍처
저장: MariaDB10(관계형·35엔티티) / MinIO(파일·presigned) / Redis7(세션·BullMQ·rate-limit).
보호: 선배데이터 k≥5(미달분 풀 제외), 민감컬럼 AES-GCM 암호화, 5종 동의 이력 적재, 대학공유 3단계 차등, 졸업+1년 후 자동 익명화·파기.

### 성능 목표
로드맵 생성 p95<2.0s, 일반 CRUD p95<200ms, 모바일 콜드스타트<3s, 푸시 도달 p95<5s.`;

const TASKS = `## [ISP 기반 과제 의도] 이행 과제·우선순위·로드맵

### 단계별 우선순위
전제: Phase1 Setup ✅ → Phase2 Foundational(인증·DB·미들웨어)
P1: Phase3 US1 갭 진단(MVP)
P2: Phase4~5 US2 로드맵 · US3 문서
P3: Phase6~9 US4 미션 · US5 알림 · US6 멘토 정산 · US7 대학 이중모드
P4: Phase10~12 US8 기업 · US9 결제 · US10 선배 데이터
보강: Phase13 analyze 보강 → Phase14 Polish(E2E·deploy).

### 의존성
US9(결제)는 US6의 R-8 정산 마이그레이션(V021)에 의존. P1→P2→P3→P4 순, 이전 단계 안정화 후 진입.

### 이행 로드맵
현재(2026-05) Setup완료·Foundational착수(태스크 27/194) → Foundational 완료 → P1 MVP → P2 로드맵·문서 →
P3 미션·알림·멘토·대학 → P4 기업·결제·선배데이터 → Phase13 보강 → Phase14 Polish(prod deploy·롤백).`;

const IMPLEMENT = `## [ISP 기반 구현 의도] 현황·표준·위험 관리

### 구현 현황 (AS-IS)
Setup(모노레포·인프라·CI) 완료 ✅ / Foundational(인증·DB·미들웨어) 착수 🔄 / User Story 미구현. 정량 진척 27/194(≈14%).

### 네트워크 표준 (불변)
운영 도메인 p16.sumzip.com(HTTPS), API /api/v1, 로컬 웹 9516 / API 9536 / MariaDB 3306 / Redis 6379 / MinIO 9000·9001.

### 위험·완화
콜드스타트→선배 기부 인센티브 / 추천편향→거부 학습·민감속성 배제 / 유출→권한·감사·AES-GCM /
DB SPOF→replica 예정 / SLA초과→재할당·AI 대체 / 데이터 노후→"최신 아님" 표시.

### 거버넌스
운영자 검수 큐, 운영지표 대시보드, 개인정보 처리방침·보존기간 명시·재동의, constitution 명문화 예정.`;

const PHASE_LABEL = { specify: 'Specify', plan: 'Plan', tasks: 'Tasks', implement: 'Implement', clarify: 'Clarify', report: 'Report' };
const ADDITIONS = SKIP_OPTIONAL
  ? { specify: SPECIFY }
  : { specify: SPECIFY, plan: PLAN, tasks: TASKS, implement: IMPLEMENT };

async function main() {
  if (!MEMBER_ID || !MEMBER_PW) { console.error('❌ DDBM_MEMBER_ID/DDBM_MEMBER_PW 필요'); process.exit(1); }

  console.log('🔐 멤버 로그인...');
  const login = await call('POST', '/auth/member/login', { member_id: MEMBER_ID, password: MEMBER_PW });
  const member = login?.data?.member || {};
  const teamId = member.teamId;
  console.log(`   ${member.name} / 팀 #${teamId}`);

  // 1) 단계별 레코드 추가
  console.log('\n📝 시스템 의도 레코드 추가:');
  for (const [phase, content] of Object.entries(ADDITIONS)) {
    if (DRY_RUN) { console.log(`   (dry) ${phase}: +${content.length}자`); continue; }
    await call('POST', `/teams/${teamId}/records`, { phase, content });
    console.log(`   ✅ ${phase} 단계에 추가 (+${content.length}자)`);
  }

  // 2) speckit 폴더 설정
  console.log(`\n📁 speckit 폴더 설정: ${SPECKIT_FOLDER}`);
  if (!DRY_RUN) await call('PUT', '/auth/member/speckit-folder', { speckit_folder: SPECKIT_FOLDER });

  // 3) 전체 레코드 → Intent-*.md (프론트엔드와 동일 포맷)
  const grouped = (await call('GET', `/teams/${teamId}/records/grouped`))?.data || {};
  const files = Object.entries(PHASE_LABEL).map(([phase, label]) => {
    const recs = grouped[phase] || [];
    let content = `# Intent - ${label}\n\n`;
    if (recs.length === 0) content += '*이 단계의 기록이 없습니다.*\n';
    else content += recs.map((r) => r.content).join('\n\n---\n\n') + '\n';
    return { filename: `Intent-${label}.md`, content };
  });
  console.log('\n📄 생성될 파일:');
  for (const f of files) console.log(`   ${f.filename}  (${f.content.length}자)`);

  // 4) Speckit 폴더에 저장 (SSH: defaultServer 192.168.0.19, team account)
  if (DRY_RUN) { console.log('\n(DRY RUN — 저장 생략)'); return; }
  const settings = (await call('GET', '/system-settings'))?.data || {};
  const srv = settings.servers?.find((s) => s.isDefault) || settings.servers?.[0];
  const host = srv.internalIp || srv.externalDomain;
  const port = srv.sshPort || 22;
  const username = (await call('GET', `/teams/${teamId}`))?.data?.account;
  const password = settings.studentAccount?.password;
  console.log(`\n💾 Speckit 폴더에 저장 (ssh ${username}@${host}:${port} → ${SPECKIT_FOLDER})`);
  const res = await call('POST', '/system-settings/save-intent-files', {
    host, port, username, password, projectFolder: SPECKIT_FOLDER, files,
  });
  if (res?.success) {
    console.log('   ✅ 저장 완료');
    if (res.backedUpFiles?.length) console.log('   백업:', res.backedUpFiles.join(', '));
  } else {
    throw new Error(res?.message || '저장 실패');
  }
}

main().catch((e) => { console.error('💥', e.message); process.exit(1); });
