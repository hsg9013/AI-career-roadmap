import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.js';
import { closePool } from './db/pool.js';

// 003 Polish(T052): 조회 경로 응답성 스모크. 운영 p95 목표(조회 <200ms)는 quickstart 에 문서화하고,
// 여기선 회귀 방지용으로 관대한 상한(<2s)만 강제 — CI 부하에 따른 flaky 를 피한다. 실측 median 은 로그로 노출.

let app: Express;
beforeAll(() => { app = createApp(); });
afterAll(async () => { await closePool(); });

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

describe('T052 조회 응답성 스모크', () => {
  it('GET /v1/catalog/industries — median 측정 + 관대한 상한', async () => {
    const N = 10;
    const samples: number[] = [];
    for (let i = 0; i < N; i += 1) {
      const t0 = Date.now();
      await request(app).get('/v1/catalog/industries').expect(200);
      samples.push(Date.now() - t0);
    }
    const med = median(samples);
    // 회귀 방지용 상한(local DB 조회는 보통 <50ms). 운영 p95<200ms 목표는 별도 부하 측정.
    expect(med).toBeLessThan(2000);
    // 가시성: 실측 median 로그(테스트 reporter 에 표시).
    // eslint-disable-next-line no-console
    console.log(`[perf] catalog/industries median=${med}ms over ${N} reqs`);
  });
});
