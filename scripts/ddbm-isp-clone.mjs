#!/usr/bin/env node
// DDBM(abc.sumzip.com) ISP 캔버스 복제 — 루프별 스냅샷 보존용
//
// 목적: 003 작업 전, 002 시점 캔버스(#60)를 그대로 보존하기 위해 새 ISP 캔버스로 복제한다.
//   권장 운용: #60 = 002 스냅샷(동결), 새 캔버스(#61) = 003 작업본 → #61에서 갭분석/이행과제/로드맵 블록만 수정.
//
// 사용법:
//   # 1) 읽기 전용 미리보기 (실제 생성·저장 없음) — 먼저 이걸로 #60 구조 확인
//   DDBM_MEMBER_ID=.. DDBM_MEMBER_PW=.. DDBM_SOURCE_CANVAS_ID=60 node scripts/ddbm-isp-clone.mjs
//
//   # 2) 실제 복제 실행
//   DDBM_MEMBER_ID=.. DDBM_MEMBER_PW=.. DDBM_SOURCE_CANVAS_ID=60 APPLY=1 \
//     DDBM_NEW_TITLE="AI 진로 로드맵 ISP (003 작업본)" node scripts/ddbm-isp-clone.mjs
//
// 인증: 세션 쿠키 방식(withCredentials). 로그인 응답 Set-Cookie를 모든 요청에 재전송.

const BASE = process.env.DDBM_BASE || 'https://abc.sumzip.com/api/v1';
const MEMBER_ID = process.env.DDBM_MEMBER_ID;
const MEMBER_PW = process.env.DDBM_MEMBER_PW;
const SOURCE_ID = process.env.DDBM_SOURCE_CANVAS_ID || '60';
const NEW_TITLE = process.env.DDBM_NEW_TITLE || 'AI 진로 로드맵 ISP (사본)';
const APPLY = process.env.APPLY === '1'; // 미설정 시 DRY_RUN(읽기 전용)
const ISP_TYPE_ID = Number(process.env.DDBM_ISP_TYPE_ID || 8); // 정보전략계획(ISP) 캔버스

let cookie = '';
async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((c) => c.split(';')[0]).join('; ');
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// 저장된 블록 내용 추출: DDBM은 canvas.blocks 를 { key: contentString } 객체 맵으로 반환한다.
function readBlockContent(block, canvas) {
  const map = canvas?.blocks;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    const v = map[block.key];
    if (typeof v === 'string') return v;
    if (v && typeof v.content === 'string') return v.content; // 방어적: 값이 객체인 변형 스키마 대비
  }
  if (typeof block.content === 'string') return block.content;
  return null;
}

async function main() {
  if (!MEMBER_ID || !MEMBER_PW) {
    console.error('❌ DDBM_MEMBER_ID, DDBM_MEMBER_PW 환경변수가 필요합니다.');
    process.exit(1);
  }
  console.log(`모드: ${APPLY ? '🟢 APPLY (실제 복제)' : '🔵 DRY_RUN (읽기 전용 미리보기)'}`);

  console.log('🔐 멤버 로그인...');
  const loginRes = await call('POST', '/auth/member/login', { member_id: MEMBER_ID, password: MEMBER_PW });
  const member = loginRes?.data?.member || loginRes?.member || {};
  console.log('   로그인 성공');

  let teamId = Number(process.env.DDBM_TEAM_ID) || member.teamId || member.memberships?.[0]?.teamId;
  if (!teamId) { console.error('❌ teamId 미확인 — DDBM_TEAM_ID 지정 필요. member=' + JSON.stringify(member)); process.exit(1); }
  console.log(`   팀 #${teamId}`);

  console.log(`\n📖 원본 캔버스 #${SOURCE_ID} 조회...`);
  const srcRes = await call('GET', `/canvases/${SOURCE_ID}`);
  const src = srcRes?.data || srcRes;
  const blocks = src?.canvas_type?.block_schema?.blocks || [];
  console.log(`   "${src.title}"  (type=${src.canvas_type_id})  블록 ${blocks.length}개`);

  // 모든 블록 내용 수집
  const copied = [];
  for (const block of blocks) {
    const content = readBlockContent(block, src);
    const label = block.label || block.title || block.key;
    if (content == null) { console.log(`   ⚠️  내용 못읽음: [${block.key}] ${label}`); continue; }
    console.log(`   • [${block.key}] ${label} — ${content.length}자 :: ${content.replace(/\n/g, ' ').slice(0, 50)}...`);
    copied.push({ key: block.key, content });
  }
  console.log(`\n   읽은 블록: ${copied.length}/${blocks.length}`);

  if (!APPLY) {
    console.log(`\n(DRY_RUN) 여기까지 읽기만 했습니다. 실제 복제하려면 APPLY=1 을 붙여 다시 실행하세요.`);
    console.log(`         생성될 새 캔버스 제목: "${NEW_TITLE}" (type=${ISP_TYPE_ID})`);
    return;
  }

  console.log(`\n🆕 새 ISP 캔버스 생성: "${NEW_TITLE}" (type=${ISP_TYPE_ID})...`);
  const created = await call('POST', `/teams/${teamId}/canvases`, { canvas_type_id: ISP_TYPE_ID, title: NEW_TITLE });
  const newId = (created?.data || created)?.id;
  console.log(`   생성됨: #${newId}`);

  let saved = 0;
  for (const b of copied) {
    await call('PUT', `/canvases/${newId}/blocks/${b.key}`, { content: b.content });
    console.log(`   ✅ 복사: [${b.key}] (${b.content.length}자)`);
    saved++;
  }
  console.log(`\n완료 — 새 캔버스 #${newId} 에 ${saved}/${copied.length} 블록 복제됨.`);
  console.log(`다음: #${newId} 의 gap_analysis / migration_tasks / roadmap 블록을 003 내용으로 수정하세요.`);
  console.log(`(원본 #${SOURCE_ID} 은 002 스냅샷으로 그대로 둡니다.)`);
}

main().catch((e) => { console.error('💥', e.message); process.exit(1); });
