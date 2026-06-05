#!/usr/bin/env node
// DDBM '시스템 의도' — 풀어쓴(prose) ISP 명세로 단계별 의도를 덮어쓰고 Speckit 폴더에 재저장
//   DDBM_MEMBER_ID=abc0119 DDBM_MEMBER_PW=pioneer26 node scripts/ddbm-intent-save-v2.mjs
//   옵션: DRY_RUN=1
//
// 동작: 각 단계(specify/plan/tasks/implement)에서 기존 '[ISP 기반' 레코드를 찾으면 PUT으로 덮어쓰고,
//       없으면 POST로 추가. 이후 전체 레코드로 Intent-*.md를 만들어 Speckit 폴더에 덮어쓴다.

const BASE = process.env.DDBM_BASE || 'https://abc.sumzip.com/api/v1';
const MEMBER_ID = process.env.DDBM_MEMBER_ID;
const MEMBER_PW = process.env.DDBM_MEMBER_PW;
const DRY_RUN = process.env.DRY_RUN === '1';
const SPECKIT_FOLDER = process.env.DDBM_SPECKIT_FOLDER || '/Users/pioneer16/mis2601/specs/001-ai-career-roadmap';
const MARKER = '[ISP 기반';

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

// ── 풀어쓴 단계별 의도(명세) ──
const SPECIFY = `## [ISP 기반 시스템 명세] AI 기반 커리어 로드맵·포트폴리오 관리 서비스

### 무엇을 만드는가
대학생이 자신의 진로를 데이터에 근거해 설계하고 취업 준비 과정을 자동으로 관리받을 수 있도록 돕는 플랫폼을 만듭니다. 기존 채용 서비스가 공고를 단순히 나열하는 데 그쳤다면, 이 서비스는 실제로 취업에 성공한 선배들의 (개인정보를 지운) 합격 경로 데이터와 현직자의 직접 피드백을 인공지능으로 결합하여, 학생 한 명 한 명에게 맞는 진로 방향과 준비 계획을 제시합니다.

### 누가 사용하는가
이용자는 네 부류입니다. 진로를 준비하는 학생(주 사용자), 학생을 관리하려는 대학교 취업지원센터(B2G), 인재를 찾는 기업과 멘토링하려는 현직자(B2B), 그리고 자신의 합격 경로 데이터를 제공하는 선배입니다. 운영자를 포함하면 다섯 종류의 역할이 있습니다.

### 어떤 기능을 제공하는가
핵심 가치는 네 가지 활동으로 나뉩니다. 첫째, 학생의 현재 역량과 목표 직무가 요구하는 역량의 차이를 진단합니다. 둘째, 선배들의 경로를 바탕으로 시기별 합격 로드맵을 설계합니다. 셋째, 실무 과제(미션)와 인공지능·현직자의 결합 피드백으로 실전 역량을 키웁니다. 넷째, 학생의 활동 기록을 자동으로 정리해 이력서·자기소개서·포트폴리오로 만들어 주고 진척 상황을 점검합니다.

이 밖에도 진척 점검과 알림, 개인정보 보호와 동의 관리, 대학용·기업용 기능, 결제와 보상, 외부 채용·자격증 데이터 수집, 운영자 관리 기능을 포함해 모두 열두 묶음(세부 요구사항 52개)으로 구성됩니다.

### 무엇을 목표로 하는가
처음 정보를 입력하고 첫 진단 결과를 받기까지 평균 15분 이내를 목표로 합니다. 가입 7일 안에 핵심 행동 세 가지를 모두 해 보는 학생이 절반 이상, 추천 로드맵을 하나라도 완료하는 학생이 70% 이상이 되도록 합니다. 자동 생성한 포트폴리오를 실제로 활용하는 학생은 90% 이상, 무료 사용자가 90일 안에 결제로 이어지는 비율은 8% 이상을 지향합니다.

### 무엇을 지켜야 하는가
한국의 개인정보보호법과 정보통신망법을 반드시 준수합니다. 선배 데이터는 같은 조건의 사람이 최소 5명 이상 모여야만 추천에 사용하며(익명화 기준), 정보 유출 사고는 0건을 유지합니다. 미션 검수는 5영업일 안에 이루어져야 하고, 네트워크 표준값은 변경하지 않으며, 초기에는 한국어만 지원합니다. 인재 매칭 시 성별·나이·출신 학교 같은 민감 정보는 사용하지 않습니다.`;

const PLAN = `## [ISP 기반 계획 의도] 데이터·애플리케이션·기술 아키텍처

### 전체 구조
하나의 저장소 안에 다섯 개의 작업 공간을 둡니다. 서버(백엔드), 웹 화면, 모바일 앱, 웹과 앱이 함께 쓰는 공통 부품, 그리고 화면과 서버가 주고받는 데이터 형식 정의입니다. 웹은 Vue로 만들고, 모바일 앱은 같은 화면 코드를 Capacitor로 감싸 iOS와 안드로이드에 함께 올립니다. 덕분에 같은 기능을 두 번 만들 필요가 없습니다. 외부 접속은 nginx가 받아 하나의 도메인에서 안전하게 연결해 줍니다.

### 주요 기술 선택
추천 엔진은 인공지능과 규칙 기반을 함께 사용하고, 파일은 MinIO에 저장하며, 결제와 정산은 PortOne을, 메일과 푸시 알림은 네이버 클라우드와 FCM·APNs를 사용합니다. 로그인은 보안 토큰 방식을 채택하고, 대학 기능은 통계용과 개인용 권한을 분리하며, 멘토 보상은 정액과 수수료 두 방식을 모두 지원합니다.

### 데이터 저장과 보호
데이터는 성격에 따라 세 곳에 나누어 저장합니다. 서로 연결된 핵심 데이터는 MariaDB에, 이력서·미션 제출물 같은 파일은 MinIO에, 빠른 조회용 임시 데이터와 작업 대기열은 Redis에 둡니다. 보호 측면에서는 선배 데이터를 익명화하고, 계좌번호·주민번호처럼 민감한 항목은 암호화해 저장하며, 동의 내역은 바꿀 때마다 기록을 새로 남깁니다. 대학 공유 동의는 '공유 안 함 / 통계만 / 개인 단위'의 세 단계로 세분화합니다.

### 성능 목표
로드맵 생성은 2초 안에, 일반 조회는 0.2초 안에 응답하도록 합니다. 모바일 앱은 3초 안에 켜지고, 푸시 알림은 5초 안에 도착하도록 합니다.`;

const TASKS = `## [ISP 기반 과제 의도] 이행 과제·우선순위와 일정

### 해야 할 일의 순서
먼저 토대를 다집니다. 저장소·인프라·배포 설정을 마련하는 준비 단계는 이미 끝났고, 지금은 로그인·데이터베이스·공통 기능 같은 기반 단계를 진행하고 있습니다. 이 기반이 완성되어야 본격적인 기능 개발을 시작할 수 있습니다.

그다음은 우선순위에 따라 단계적으로 만듭니다. 1순위로 역량 갭 진단을 만들어 최소 기능 제품을 내놓습니다. 2순위로 합격 로드맵 추천과 문서 자동화를 더합니다. 3순위로 실무 미션과 피드백, 진척 알림, 멘토 보상 정산, 대학용 기능을 붙입니다. 마지막 4순위로 기업 인재 매칭, 결제 기능, 선배 데이터 기부 기능을 완성합니다.

### 일정의 큰 그림
현재(2026년 5월)는 준비 단계를 마치고 기반 단계를 진행 중이며, 전체 194개 작업 중 27개를 완료했습니다. 앞으로 기반 완성 → 1순위 갭 진단 출시 → 2순위 로드맵·문서 → 3순위 미션·알림·멘토·대학 → 4순위 기업·결제·선배데이터 → 품질 보강과 마무리(자동 테스트, 실서비스 배포, 성능·접근성 개선) 순으로 진행합니다.

### 유의할 점
한 번에 다 만들지 않고 검증 가능한 단위로 나누어 차례대로 내놓으며, 각 단계는 앞 단계가 안정된 뒤 시작합니다. 결제 기능은 멘토 정산 기능의 데이터 구조에 기대고 있으므로 그 순서를 함께 고려해야 합니다.`;

const IMPLEMENT = `## [ISP 기반 구현 의도] 현황·표준·위험 관리

### 현재 구축 현황
저장소 구조와 인프라(데이터베이스·캐시·파일저장소), 자동 배포 설정을 마련하는 준비 단계는 완료했습니다. 현재는 로그인·인증, 데이터베이스 구조, 공통 기능 같은 토대를 만드는 단계입니다. 실제 사용자 기능은 아직 개발 전이며, 전체 194개 작업 중 27개를 완료해 약 14% 진행되었습니다.

### 네트워크 표준 (변경하지 않음)
운영 도메인은 p16.sumzip.com이며 보안 연결(HTTPS)을 사용합니다. 화면과 서버가 주고받는 통로(API)는 /api/v1 경로를 씁니다. 개발 환경의 접속 포트는 웹 9516, 서버 9536, 데이터베이스 3306, 캐시 6379, 파일저장소 9000·9001로 고정합니다.

### 위험과 대비
초기에 선배 데이터가 없는 문제는 데이터 제공자에게 보상을 주어 모읍니다. 추천이 인기 직무로 쏠리는 편향은 거부 이력을 학습하고 민감 정보를 추천에서 빼서 줄입니다. 정보 유출은 권한 관리·접근 기록·암호화로 막고, 데이터베이스가 한 대뿐이라 생기는 장애 위험은 예비 서버로 보완합니다. 현직자 피드백이 늦어지면 다른 멘토에게 재배정하거나 인공지능 피드백으로 대체하고, 채용 정보가 오래되면 '최신 아님'을 표시합니다.

### 운영 규칙
미션·공고·신고 등을 운영자가 검수하는 절차를 두고, 주요 운영 지표를 대시보드로 관리합니다. 개인정보 처리방침과 보존 기간을 명시하고, 변경 시 다시 동의를 받습니다.`;

const PHASE_LABEL = { specify: 'Specify', plan: 'Plan', tasks: 'Tasks', implement: 'Implement', clarify: 'Clarify', report: 'Report' };
const NEW = { specify: SPECIFY, plan: PLAN, tasks: TASKS, implement: IMPLEMENT };

async function main() {
  if (!MEMBER_ID || !MEMBER_PW) { console.error('❌ DDBM_MEMBER_ID/DDBM_MEMBER_PW 필요'); process.exit(1); }
  console.log('🔐 멤버 로그인...');
  const login = await call('POST', '/auth/member/login', { member_id: MEMBER_ID, password: MEMBER_PW });
  const teamId = login?.data?.member?.teamId;
  console.log(`   팀 #${teamId}`);

  // 1) 기존 ISP 레코드 찾기 → 덮어쓰기(PUT), 없으면 추가(POST)
  console.log('\n📝 단계별 의도 덮어쓰기:');
  let grouped = (await call('GET', `/teams/${teamId}/records/grouped`))?.data || {};
  for (const [phase, content] of Object.entries(NEW)) {
    const recs = grouped[phase] || [];
    const existing = recs.find((r) => (r.content || '').includes(MARKER));
    if (DRY_RUN) {
      console.log(`   (dry) ${phase}: ${existing ? `덮어쓰기 #${existing.id}` : '신규 추가'} (${content.length}자)`);
      continue;
    }
    if (existing) {
      await call('PUT', `/records/${existing.id}`, { content });
      console.log(`   ✏️  ${phase} 덮어씀 #${existing.id} (${content.length}자)`);
    } else {
      await call('POST', `/teams/${teamId}/records`, { phase, content });
      console.log(`   ➕ ${phase} 추가 (${content.length}자)`);
    }
  }

  // 2) speckit 폴더 보장
  if (!DRY_RUN) await call('PUT', '/auth/member/speckit-folder', { speckit_folder: SPECKIT_FOLDER });

  // 3) 전체 레코드 → Intent-*.md
  grouped = (await call('GET', `/teams/${teamId}/records/grouped`))?.data || {};
  const files = Object.entries(PHASE_LABEL).map(([phase, label]) => {
    const recs = grouped[phase] || [];
    let content = `# Intent - ${label}\n\n`;
    content += recs.length === 0 ? '*이 단계의 기록이 없습니다.*\n'
      : recs.map((r) => r.content).join('\n\n---\n\n') + '\n';
    return { filename: `Intent-${label}.md`, content };
  });
  console.log('\n📄 생성될 파일:');
  for (const f of files) console.log(`   ${f.filename} (${f.content.length}자)`);

  if (DRY_RUN) { console.log('\n(DRY RUN — 저장 생략)'); return; }

  // 4) Speckit 폴더에 덮어쓰기 저장
  const settings = (await call('GET', '/system-settings'))?.data || {};
  const srv = settings.servers?.find((s) => s.isDefault) || settings.servers?.[0];
  const team = (await call('GET', `/teams/${teamId}`))?.data;
  console.log(`\n💾 Speckit 폴더에 덮어쓰기 (ssh ${team.account}@${srv.internalIp} → ${SPECKIT_FOLDER})`);
  const res = await call('POST', '/system-settings/save-intent-files', {
    host: srv.internalIp || srv.externalDomain,
    port: srv.sshPort || 22,
    username: team.account,
    password: settings.studentAccount?.password,
    projectFolder: SPECKIT_FOLDER,
    files,
  });
  if (res?.success) {
    console.log('   ✅ 저장 완료');
    if (res.backedUpFiles?.length) console.log('   백업:', res.backedUpFiles.join(', '));
  } else throw new Error(res?.message || '저장 실패');
}

main().catch((e) => { console.error('💥', e.message); process.exit(1); });
