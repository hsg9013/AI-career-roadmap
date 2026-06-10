import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { closePool } from '../../db/pool.js';

// 003 US8: 운영 헬스 엔드포인트 계약. FR-015/FR-017.

describe('ops health (US8)', () => {
  let app: Express;
  beforeAll(() => {
    app = createApp();
  });
  afterAll(async () => {
    await closePool();
  });

  it('GET /v1/ops/health — 인증 없이 상태·구성요소·lastBackupAt 반환', async () => {
    const res = await request(app).get('/v1/ops/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('components');
    expect(res.body.components).toHaveProperty('db');
    expect(res.body.components).toHaveProperty('redis');
    expect(res.body).toHaveProperty('lastBackupAt');
  });
});
