import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

// 003 US1(T015): Anthropic Claude 호출 어댑터.
//
// 정책:
//   • SDK 의존 없이 Messages API(https://api.anthropic.com/v1/messages)를 fetch 로 호출 — 신규 패키지 불필요.
//   • LLM_TIMEOUT_MS 초과 시 AbortController 로 중단 → 호출부가 규칙 기반 폴백.
//   • 자격증명(LLM_API_KEY) 미설정 시 즉시 null 반환(호출 자체를 시도하지 않음).
//   • 입력 프롬프트에는 PII가 포함되지 않아야 한다(호출부 gateway 에서 anonymize 후 전달).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const OAUTH_BETA = 'oauth-2025-04-20';

// ── 발표용 AI 데모 토글 (재시작 불필요·런타임 플래그) ──
//   플래그 파일이 존재하고 LLM_API_KEY 가 비어 있으면, 로컬 구독 OAuth 토큰
//   (~/.claude/.credentials.json)을 매 호출 재독취해 임시 실연동한다(파일/.env 저장 안 함).
//   플래그 파일이 없으면(기본) 완전 OFF — 규칙 기반 폴백으로 동작한다.
//   안전장치: 플래그 생성 후 DEMO_TTL_MS(기본 2시간)가 지나면 자동 만료(끄는 걸 잊어도 OK).
//   토글: pnpm demo:on / pnpm demo:off (또는 플래그 파일 생성/삭제).
const DEMO_FLAG_PATH =
  env.DEMO_AI_FLAG_FILE ||
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.run', 'demo-ai.on');
const DEMO_TTL_MS = env.DEMO_AI_TTL_MS > 0 ? env.DEMO_AI_TTL_MS : 2 * 60 * 60 * 1000; // 기본 2시간

function demoActive(): boolean {
  try {
    if (!existsSync(DEMO_FLAG_PATH)) return false;
    // 플래그 생성(=마지막 켜기) 후 TTL 초과 시 자동 만료 — 플래그 파일을 정리하고 OFF 처리.
    const ageMs = Date.now() - statSync(DEMO_FLAG_PATH).mtimeMs;
    if (ageMs > DEMO_TTL_MS) {
      try { unlinkSync(DEMO_FLAG_PATH); } catch { /* 자동 청소 실패 무시 */ }
      logger.info({ ageMs }, '[ai] demo flag expired (auto-off)');
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// 데모 활성 + 무키 환경에서만 구독 OAuth accessToken 을 반환(자동 갱신 반영). 그 외 ''.
function readDemoOAuthToken(): string {
  if (env.LLM_API_KEY.length > 0 || !demoActive()) return '';
  try {
    const raw = readFileSync(join(homedir(), '.claude', '.credentials.json'), 'utf8');
    const json = JSON.parse(raw) as { claudeAiOauth?: { accessToken?: string } };
    return json.claudeAiOauth?.accessToken ?? '';
  } catch {
    return '';
  }
}

export interface ClaudeCallResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export function hasClaudeCredentials(): boolean {
  if (env.LLM_PROVIDER !== 'anthropic') return false;
  return env.LLM_API_KEY.length > 0 || readDemoOAuthToken().length > 0;
}

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

// 폴백 분류용 실패 사유. data-model `ai_inference_log.fallback_reason` 와 매핑.
export type ClaudeFailureReason = 'no_credentials' | 'timeout' | 'error';

export type ClaudeOutcome =
  | { ok: true; result: ClaudeCallResult }
  | { ok: false; reason: ClaudeFailureReason };

/**
 * Claude Messages API 단건 호출(상세판). 성공/실패 사유를 구분해 반환한다.
 * 호출부(runInference)가 fallback_reason 을 결정·기록할 수 있도록 throw 하지 않는다.
 */
export async function callClaude(
  system: string,
  user: string,
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<ClaudeOutcome> {
  if (!hasClaudeCredentials()) return { ok: false, reason: 'no_credentials' };

  // API 키가 있으면 x-api-key, 없으면(데모) 구독 OAuth Bearer 경로.
  const usingApiKey = env.LLM_API_KEY.length > 0;
  const oauthToken = usingApiKey ? '' : readDemoOAuthToken();
  // OAuth 경로는 짧은 타임아웃이면 자주 폴백되므로 최소 30s 로 늘린다.
  const timeoutMs = opts.timeoutMs ?? (usingApiKey ? env.LLM_TIMEOUT_MS : Math.max(env.LLM_TIMEOUT_MS, 30000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: usingApiKey
        ? {
            'content-type': 'application/json',
            'x-api-key': env.LLM_API_KEY,
            'anthropic-version': ANTHROPIC_VERSION,
          }
        : {
            // 데모: 구독 OAuth 토큰 경로.
            'content-type': 'application/json',
            authorization: `Bearer ${oauthToken}`,
            'anthropic-version': ANTHROPIC_VERSION,
            'anthropic-beta': OAUTH_BETA,
          },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        max_tokens: opts.maxTokens ?? env.LLM_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn({ status: res.status, body: body.slice(0, 300) }, '[ai] Claude non-2xx — fallback');
      return { ok: false, reason: 'error' };
    }

    const data = (await res.json()) as AnthropicMessagesResponse;
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
      .trim();

    if (!text) {
      logger.warn('[ai] Claude empty content — fallback');
      return { ok: false, reason: 'error' };
    }

    return {
      ok: true,
      result: {
        text,
        model: env.LLM_MODEL,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    logger.warn({ err, aborted, timeoutMs }, '[ai] Claude call failed/timeout — fallback');
    return { ok: false, reason: aborted ? 'timeout' : 'error' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 하위호환 래퍼: 성공 시 결과, 실패/자격증명 없음/타임아웃 시 null.
 * 사유 구분이 필요 없는 호출부를 위해 유지(neue 코드는 callClaude 사용 권장).
 */
export async function generateText(
  system: string,
  user: string,
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<ClaudeCallResult | null> {
  const outcome = await callClaude(system, user, opts);
  return outcome.ok ? outcome.result : null;
}
