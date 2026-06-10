import { getPool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { callClaude } from './claude.js';

// 003 US1(T006/T021): AI 추론 SSOT 헬퍼.
//
// 모든 AI 기능(diagnosis/roadmap/document/mission_feedback)은 이 함수를 거친다.
//   1) 일일 토큰 예산 가드(AI_DAILY_TOKEN_BUDGET>0) — 초과 시 호출 없이 폴백(reason=budget).
//   2) Claude 호출 — 성공/타임아웃/오류/자격증명없음 구분.
//   3) ai_inference_log 1행 기록 + 성공 시 ai_budget_counter 누적.
// 반환의 source/fallbackReason 으로 호출부가 폴백 여부를 판단하고 사용자에게 오류를 노출하지 않는다(SC-006).

export type AiFeature = 'diagnosis' | 'roadmap' | 'document' | 'mission_feedback';
export type AiSource = 'ai' | 'fallback_rule';
export type FallbackReason = 'none' | 'error' | 'timeout' | 'budget' | 'no_credentials';

export interface InferRequest {
  feature: AiFeature;
  subjectRef?: string | number | null;
  system: string;
  user: string;
  maxTokens?: number;
}

export interface InferResult {
  source: AiSource;
  fallbackReason: FallbackReason;
  /** source=ai 일 때만 모델 원문 텍스트. 폴백 시 null. */
  text: string | null;
  model: string | null;
}

function dayWindowKey(): string {
  // UTC 일자 키. ai_budget_counter.window_key 와 매핑.
  return new Date().toISOString().slice(0, 10);
}

async function isOverDailyBudget(): Promise<boolean> {
  if (env.AI_DAILY_TOKEN_BUDGET <= 0) return false;
  try {
    const [rows] = await getPool().query(
      `SELECT tokens_used FROM ai_budget_counter WHERE period = 'day' AND window_key = ? LIMIT 1`,
      [dayWindowKey()],
    );
    const used = Number((rows as Array<{ tokens_used: number | string }>)[0]?.tokens_used ?? 0);
    return used >= env.AI_DAILY_TOKEN_BUDGET;
  } catch (err) {
    // 카운터 조회 실패는 가드를 막지 않는다(연동 안정성 우선) — 로그만.
    logger.warn({ err }, '[ai] budget counter read failed — proceeding');
    return false;
  }
}

async function addBudgetTokens(tokens: number): Promise<void> {
  if (env.AI_DAILY_TOKEN_BUDGET <= 0 || tokens <= 0) return;
  try {
    await getPool().query(
      `INSERT INTO ai_budget_counter (period, window_key, tokens_used) VALUES ('day', ?, ?)
       ON DUPLICATE KEY UPDATE tokens_used = tokens_used + VALUES(tokens_used)`,
      [dayWindowKey(), tokens],
    );
  } catch (err) {
    logger.warn({ err }, '[ai] budget counter update failed (non-blocking)');
  }
}

async function recordLog(args: {
  feature: AiFeature;
  subjectRef?: string | number | null;
  model: string | null;
  source: AiSource;
  fallbackReason: FallbackReason;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO ai_inference_log
         (feature, subject_ref, model, source, fallback_reason, input_tokens, output_tokens, latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        args.feature,
        args.subjectRef == null ? null : String(args.subjectRef),
        args.model,
        args.source,
        args.fallbackReason,
        args.inputTokens,
        args.outputTokens,
        args.latencyMs,
      ],
    );
  } catch (err) {
    // 로그 적재 실패가 사용자 응답을 막아선 안 된다.
    logger.warn({ err, feature: args.feature }, '[ai] inference log write failed (non-blocking)');
  }
}

/**
 * AI 호출 + 관측·예산 기록을 한 번에 수행. throw 하지 않고 항상 InferResult 를 돌려준다.
 * source=fallback_rule 이면 호출부가 자체 규칙 기반 결과를 사용해야 한다.
 */
export async function runInference(req: InferRequest): Promise<InferResult> {
  if (await isOverDailyBudget()) {
    await recordLog({
      feature: req.feature,
      subjectRef: req.subjectRef,
      model: null,
      source: 'fallback_rule',
      fallbackReason: 'budget',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    });
    return { source: 'fallback_rule', fallbackReason: 'budget', text: null, model: null };
  }

  const outcome = await callClaude(req.system, req.user, { maxTokens: req.maxTokens });

  if (outcome.ok) {
    const r = outcome.result;
    await Promise.all([
      recordLog({
        feature: req.feature,
        subjectRef: req.subjectRef,
        model: r.model,
        source: 'ai',
        fallbackReason: 'none',
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        latencyMs: r.latencyMs,
      }),
      addBudgetTokens(r.inputTokens + r.outputTokens),
    ]);
    return { source: 'ai', fallbackReason: 'none', text: r.text, model: r.model };
  }

  await recordLog({
    feature: req.feature,
    subjectRef: req.subjectRef,
    model: null,
    source: 'fallback_rule',
    fallbackReason: outcome.reason,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
  });
  return { source: 'fallback_rule', fallbackReason: outcome.reason, text: null, model: null };
}
