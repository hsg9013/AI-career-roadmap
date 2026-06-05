import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

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
}

// PII 제거기: 입력 객체에서 알려진 위험 필드를 제거하고 키워드만 보존.
export function anonymize<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const FORBIDDEN = new Set([
    'email',
    'name',
    'phone',
    'user_id',
    'sub',
    'address',
    'birthday',
    'password',
    'token',
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (FORBIDDEN.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
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

function hasLlmCredentials(): boolean {
  return env.LLM_API_KEY.length > 0;
}

async function callExternalLlm(_input: GapInsightInput): Promise<GapInsight | null> {
  // 실제 LLM 호출 어댑터는 R-1 통합 단계에서 추가.
  // 현 단계는 자격증명 유무로만 분기하고, 자격증명이 있어도 실제 호출은 후속 태스크로 연기한다.
  return null;
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

  let result: GapInsight;
  if (hasLlmCredentials()) {
    try {
      const llm = await callExternalLlm(input);
      result = llm ?? ruleBasedInsight(input);
    } catch (err) {
      logger.warn({ err }, '[reco] LLM call failed — using rule-based fallback');
      result = ruleBasedInsight(input);
    }
  } else {
    result = ruleBasedInsight(input);
  }

  try {
    await r.set(key, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, '[reco] cache write failed');
  }

  return result;
}

export const __internal = { cacheKey, ruleBasedInsight, getRedis, CACHE_PREFIX } as const;
