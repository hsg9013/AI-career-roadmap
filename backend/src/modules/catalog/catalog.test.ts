import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { closePool } from '../../db/pool.js';

// 003 US2: 직무·산업 사전 공개 API 계약 테스트.
// SC-007: 산업 10개·각 직무가 핵심 역량 키워드 보유. (시드 V017/V018 선적용 전제)

describe('catalog (US2)', () => {
  let app: Express;
  beforeAll(() => {
    app = createApp();
  });
  afterAll(async () => {
    await closePool();
  });

  it('GET /v1/catalog/industries — 인증 없이 산업 10개 반환', async () => {
    const res = await request(app).get('/v1/catalog/industries');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(10);
    expect(res.body.items[0]).toHaveProperty('code');
    expect(res.body.items[0]).toHaveProperty('name');
  });

  it('GET /v1/catalog/industries/IT/jobs — 직무가 핵심 역량 키워드 보유', async () => {
    const res = await request(app).get('/v1/catalog/industries/IT/jobs');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(5);
    for (const job of res.body.items) {
      expect(job).toHaveProperty('code');
      expect(Array.isArray(job.competencies)).toBe(true);
      expect(job.competencies.length).toBeGreaterThan(0);
    }
  });

  it('GET /v1/catalog/industries/UNKNOWN/jobs — 없는 산업은 404', async () => {
    const res = await request(app).get('/v1/catalog/industries/NOPE/jobs');
    expect(res.status).toBe(404);
  });
});
