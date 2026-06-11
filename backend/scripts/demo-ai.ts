import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 발표용 AI 데모 토글 — 플래그 파일 생성/삭제(재시작 불필요, 런타임 반영).
//   on  : 구독 OAuth 토큰으로 Claude 실연동(LLM_API_KEY 비어 있을 때)
//   off : 규칙 기반 폴백(기본)
//   상태: 인자 없거나 'status'
// 실행: pnpm --filter backend exec tsx scripts/demo-ai.ts on|off|status

const FLAG =
  process.env.DEMO_AI_FLAG_FILE ||
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.run', 'demo-ai.on');

const arg = (process.argv[2] ?? 'status').toLowerCase();

if (arg === 'on') {
  mkdirSync(dirname(FLAG), { recursive: true });
  writeFileSync(FLAG, `on @ ${new Date().toISOString()}\n`);
  console.log(`✅ 데모 AI ON — ${FLAG}\n   (LLM_API_KEY 미설정 시 구독 OAuth 토큰으로 실연동. 재시작 불필요)`);
} else if (arg === 'off') {
  rmSync(FLAG, { force: true });
  console.log(`⛔ 데모 AI OFF — 플래그 제거됨 (${FLAG})\n   규칙 기반 폴백으로 동작합니다.`);
} else {
  console.log(`데모 AI 상태: ${existsSync(FLAG) ? 'ON ✅' : 'OFF ⛔'}  (${FLAG})`);
}
