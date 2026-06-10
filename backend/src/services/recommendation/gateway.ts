import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { runInference, type FallbackReason } from '../ai/infer.js';
import { stripForbidden } from '../../lib/privacy/index.js';

// T051: 추천 LLM Gateway
//
// 정책:
//   • 모든 입력은 anonymize 후에만 외부로 전달 (PII 제로 보장)
//   • 동일 입력은 Redis 캐시 TTL 24h
//   • LLM_API_KEY 미설정 또는 외부 호출 실패 시 → 룰 기반 fallback 으로 graceful degrade
//
// 현 단계는 갭 진단의 보조 narrative 만 호출(R-1). 로드맵 생성·미션 매칭 등은 별도 호출 지점에서 사용.

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const CACHE_PREFIX = 'reco:cache:';

let redis: Redis | null = null;
function getRedis(): Redis {
  if (redis) return redis;
  redis = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 });
  return redis;
}

export interface GapInsightInput {
  job_role: string;        // 'IT/backend' 같이 식별값만 — 사용자 고유 정보 X
  fulfilled: string[];
  missing: string[];
  priority_to_improve: string[];
  score: number;
}

export interface GapInsight {
  source: 'llm' | 'rule' | 'cache';
  narrative: string;
  suggestions: string[];
  model_version: string;
  // 003 US1(T021): 룰 폴백 시 사유 노출(none=AI 정상). 사용자에겐 오류로 노출하지 않는다(SC-006).
  fallback_reason?: FallbackReason;
}

// 003 G1(T021a): PII + 민감 인구통계 속성 제거를 공유 프라이버시 가드(SSOT)에 위임.
// 성별·나이·출신학교 등은 stripForbidden 에서 함께 제거되어 LLM 으로 전달되지 않는다(FR-019).
export function anonymize<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  return stripForbidden(input) as Record<string, unknown>;
}

function cacheKey(input: GapInsightInput): string {
  const canon = JSON.stringify({
    ...anonymize(input as unknown as Record<string, unknown>),
    fulfilled: [...input.fulfilled].sort(),
    missing: [...input.missing].sort(),
    priority_to_improve: [...input.priority_to_improve],
  });
  return CACHE_PREFIX + createHash('sha256').update(canon).digest('hex');
}

function ruleBasedInsight(input: GapInsightInput): GapInsight {
  const top = input.priority_to_improve.slice(0, 3);
  const narrative =
    input.score >= 75
      ? `${input.job_role} 직무에 핵심 역량이 잘 갖춰져 있습니다(점수 ${input.score}). 부족한 영역(${top.join(', ') || '없음'})을 단기 보완하면 강한 지원자 프로파일이 됩니다.`
      : input.score >= 40
        ? `${input.job_role} 직무의 ${input.score}% 역량을 충족합니다. 우선 ${top.join(', ') || '핵심 역량'} 보완에 집중하세요.`
        : `${input.job_role} 직무 진입을 위해 추가 학습이 필요합니다(점수 ${input.score}). ${top.join(', ') || '기초'} 부터 단계적으로 채워가는 로드맵을 권장합니다.`;
  const suggestions = top.map((kw) => `${kw} 관련 프로젝트 또는 자격증으로 보강하세요.`);
  return {
    source: 'rule',
    narrative,
    suggestions,
    model_version: 'rule-1.0',
  };
}

// 003 US1(T016/T021): 실제 Claude 호출(runInference 경유 — 예산 가드·로그 일원화).
// 입력은 anonymize 후 키워드만 전달(PII 제로). 성공 시 GapInsight, 그 외엔 폴백 사유를 돌려준다.
// 파싱 실패는 사유 'error' 로 처리해 호출부가 룰 기반으로 폴백한다.
type LlmInsightOutcome = { insight: GapInsight } | { reason: FallbackReason };

async function callExternalLlm(input: GapInsightInput): Promise<LlmInsightOutcome> {
  const safe = anonymize(input as unknown as Record<string, unknown>);
  const system =
    '당신은 한국 대학생의 취업 역량 진단을 돕는 코치입니다. ' +
    '입력으로 받은 직무·충족/미충족 역량 키워드와 점수만 근거로, ' +
    '한국어로 격려와 실행 가능한 보완 방향을 제시하세요. ' +
    '반드시 아래 JSON 형식만 출력하세요: ' +
    '{"narrative": string, "suggestions": string[] }. suggestions 는 최대 3개.';
  const user = JSON.stringify(safe);

  const res = await runInference({
    feature: 'diagnosis',
    subjectRef: input.job_role,
    system,
    user,
    maxTokens: env.LLM_MAX_TOKENS,
  });
  if (res.source !== 'ai' || !res.text) return { reason: res.fallbackReason };

  try {
    const jsonStart = res.text.indexOf('{');
    const jsonEnd = res.text.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) return { reason: 'error' };
    const parsed = JSON.parse(res.text.slice(jsonStart, jsonEnd + 1)) as {
      narrative?: unknown;
      suggestions?: unknown;
    };
    const narrative = typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '';
    if (!narrative) return { reason: 'error' };
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
      : [];
    return {
      insight: { source: 'llm', narrative, suggestions, model_version: res.model ?? 'claude', fallback_reason: 'none' },
    };
  } catch (err) {
    logger.warn({ err }, '[reco] LLM response parse failed — fallback');
    return { reason: 'error' };
  }
}

export async function getGapInsight(input: GapInsightInput): Promise<GapInsight> {
  const key = cacheKey(input);
  const r = getRedis();

  try {
    const cached = await r.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as GapInsight;
      return { ...parsed, source: 'cache' };
    }
  } catch (err) {
    logger.warn({ err }, '[reco] cache read failed — falling through');
  }

  // 자격증명 유무와 무관하게 runInference 를 거친다 — 무키 환경도 1행 로그(no_credentials)로 일관 관측.
  let result: GapInsight;
  const llm = await callExternalLlm(input);
  if ('insight' in llm) {
    result = llm.insight;
  } else {
    result = { ...ruleBasedInsight(input), fallback_reason: llm.reason };
  }

  try {
    await r.set(key, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, '[reco] cache write failed');
  }

  return result;
}

export const __internal = { cacheKey, ruleBasedInsight, getRedis, CACHE_PREFIX } as const;
