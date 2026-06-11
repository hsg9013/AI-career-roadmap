import { existsSync, mkdirSync, writeFileSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 발표용 AI 데모 토글 — 플래그 파일 생성/삭제(재시작 불필요, 런타임 반영).
//   on  : 구독 OAuth 토큰으로 Claude 실연동(LLM_API_KEY 비어 있을 때)
//   off : 규칙 기반 폴백(기본)
//   상태: 인자 없거나 'status'
//   안전장치: 켠 뒤 TTL(기본 2시간) 경과 시 자동 만료 — 끄는 걸 잊어도 자동 OFF.
// 실행: pnpm --filter backend exec tsx scripts/demo-ai.ts on|off|status

const FLAG =
  process.env.DEMO_AI_FLAG_FILE ||
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.run', 'demo-ai.on');
const TTL_MS = Number(process.env.DEMO_AI_TTL_MS) > 0 ? Number(process.env.DEMO_AI_TTL_MS) : 2 * 60 * 60 * 1000;

// 만료된 플래그면 정리하고 false. 유효하면 남은 ms 반환.
function activeRemainingMs(): number | null {
  if (!existsSync(FLAG)) return null;
  const ageMs = Date.now() - statSync(FLAG).mtimeMs;
  if (ageMs > TTL_MS) {
    try { unlinkSync(FLAG); } catch { /* ignore */ }
    return null;
  }
  return TTL_MS - ageMs;
}

const arg = (process.argv[2] ?? 'status').toLowerCase();
const mins = (ms: number): number => Math.round(ms / 60000);

if (arg === 'on') {
  mkdirSync(dirname(FLAG), { recursive: true });
  writeFileSync(FLAG, `on @ ${new Date().toISOString()}\n`);
  console.log(
    `✅ 데모 AI ON — ${FLAG}\n` +
      `   구독 OAuth 토큰으로 실연동(LLM_API_KEY 미설정 시). 재시작 불필요.\n` +
      `   ⏰ ${mins(TTL_MS)}분(약 ${(TTL_MS / 3600000).toFixed(1)}시간) 후 자동 종료 — 끄는 걸 잊어도 안전. 다시 켜면 시간 연장.`,
  );
} else if (arg === 'off') {
  rmSync(FLAG, { force: true });
  console.log(`⛔ 데모 AI OFF — 플래그 제거됨 (${FLAG})\n   규칙 기반 폴백으로 동작합니다.`);
} else {
  const rem = activeRemainingMs();
  if (rem === null) console.log(`데모 AI 상태: OFF ⛔  (${FLAG})`);
  else console.log(`데모 AI 상태: ON ✅  (자동 종료까지 약 ${mins(rem)}분 남음)  (${FLAG})`);
}
