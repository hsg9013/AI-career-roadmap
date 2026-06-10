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

export interface ClaudeCallResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export function hasClaudeCredentials(): boolean {
  return env.LLM_PROVIDER === 'anthropic' && env.LLM_API_KEY.length > 0;
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

  const timeoutMs = opts.timeoutMs ?? env.LLM_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.LLM_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
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
