import { describe, it, expect, afterAll } from 'vitest';
import { runInference } from './ai/infer.js';
import { collectOpsMetrics } from './metrics.js';
import { closePool } from '../db/pool.js';

// 003 Polish(T050/T053): AI 폴백 경로가 관측에 반영되는지 통합 검증.
// 테스트 환경엔 LLM 키가 없으므로 runInference 는 fallback_rule/no_credentials 로 기록되고,
// collectOpsMetrics 의 폴백률·byReason 에 집계되어야 한다.

afterAll(async () => {
  await closePool();
});

describe('관측 메트릭 (T053) + AI 폴백 경로 (T050)', () => {
  it('AI 폴백이 ai_inference_log → fallbackRate 로 집계된다', async () => {
    await runInference({ feature: 'roadmap', subjectRef: 'metrics-probe', system: 's', user: 'u' });
    await runInference({ feature: 'document', subjectRef: 'metrics-probe', system: 's', user: 'u' });

    const m = await collectOpsMetrics();
    expect(m.ai.total).toBeGreaterThanOrEqual(2);
    expect(m.ai.fallback).toBeGreaterThanOrEqual(2);
    expect(m.ai.fallbackRate).not.toBeNull();
    expect((m.ai.fallbackRate as number)).toBeGreaterThan(0);
    expect(m.ai.byReason.no_credentials).toBeGreaterThanOrEqual(2);
  });

  it('메트릭 응답이 모든 관측 섹션을 포함한다', async () => {
    const m = await collectOpsMetrics();
    expect(m).toHaveProperty('payments.successRate');
    expect(m).toHaveProperty('notifications.successRate');
    expect(m).toHaveProperty('feeds.successRate');
    expect(m).toHaveProperty('availability.openCriticalAlerts');
    expect(typeof m.availability.openCriticalAlerts).toBe('number');
    expect(m.kpi).toBeTypeOf('object');
  });
});
