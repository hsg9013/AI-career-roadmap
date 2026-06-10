import { describe, it, expect, afterAll } from 'vitest';
import { runInference } from './infer.js';
import { getPool, closePool } from '../../db/pool.js';

// 003 US1(T021/T050): AI 폴백 경로 회귀.
// 테스트 환경엔 LLM_API_KEY 가 없으므로 모든 호출이 fallback_rule/no_credentials 로 폴백하고
// ai_inference_log 에 1행이 기록되어야 한다(SC-006: 사용자에겐 오류 미노출, 관측은 일관).

afterAll(async () => {
  await closePool();
});

describe('runInference (자격증명 없음 → 폴백)', () => {
  it('source=fallback_rule, reason=no_credentials, text=null 을 반환한다', async () => {
    const res = await runInference({
      feature: 'roadmap',
      subjectRef: 'test-subject',
      system: 'sys',
      user: 'usr',
    });
    expect(res.source).toBe('fallback_rule');
    expect(res.fallbackReason).toBe('no_credentials');
    expect(res.text).toBeNull();
  });

  it('호출마다 ai_inference_log 에 1행을 기록한다', async () => {
    const pool = getPool();
    const [before] = await pool.query(
      `SELECT COUNT(*) AS c FROM ai_inference_log WHERE feature = 'diagnosis' AND subject_ref = 'log-probe'`,
    );
    const c0 = Number((before as Array<{ c: number | string }>)[0]!.c);

    await runInference({ feature: 'diagnosis', subjectRef: 'log-probe', system: 's', user: 'u' });

    const [after] = await pool.query(
      `SELECT source, fallback_reason FROM ai_inference_log
       WHERE feature = 'diagnosis' AND subject_ref = 'log-probe' ORDER BY id DESC LIMIT 1`,
    );
    const [cnt] = await pool.query(
      `SELECT COUNT(*) AS c FROM ai_inference_log WHERE feature = 'diagnosis' AND subject_ref = 'log-probe'`,
    );
    const c1 = Number((cnt as Array<{ c: number | string }>)[0]!.c);
    const row = (after as Array<{ source: string; fallback_reason: string }>)[0]!;

    expect(c1).toBe(c0 + 1);
    expect(row.source).toBe('fallback_rule');
    expect(row.fallback_reason).toBe('no_credentials');
  });
});
