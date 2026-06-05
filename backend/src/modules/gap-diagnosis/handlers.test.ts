import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getPool, closePool } from '../../db/pool.js';
import { __internal as authInternal } from '../auth/service.js';
import { __internal as recoInternal } from '../../services/recommendation/gateway.js';

const TEST_EMAIL = `vitest-gap-${Date.now()}@uni.ac.kr`;
const TEST_PASSWORD = 'vitest-strong-4';

let app: Express;
let accessToken: string;
let backendTargetId: number;

async function bootstrap(app: Express): Promise<string> {
  await request(app)
    .post('/v1/auth/register/student')
    .send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      university: '갭대학교',
      major: '컴공',
      year_in_school: 3,
    })
    .expect(201);
  const r = await request(app)
    .post('/v1/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
    .expect(200);
  return r.body.access_token as string;
}

async function cleanup(): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [TEST_EMAIL]);
  const arr = rows as Array<{ id: number }>;
  if (arr.length === 0) return;
  const uid = arr[0]!.id;
  const [stRows] = await pool.query('SELECT id FROM students WHERE user_id = ?', [uid]);
  const stArr = stRows as Array<{ id: number }>;
  if (stArr[0]) {
    const sid = stArr[0].id;
    await pool.query('DELETE FROM gap_diagnoses WHERE student_id = ?', [sid]);
    const [actRows] = await pool.query('SELECT id FROM activities WHERE student_id = ?', [sid]);
    const ids = (actRows as Array<{ id: number }>).map((r) => r.id);
    if (ids.length) {
      await pool.query(
        `DELETE FROM activity_tags WHERE activity_id IN (${ids.map(() => '?').join(',')})`,
        ids,
      );
    }
    await pool.query('DELETE FROM activities WHERE student_id = ?', [sid]);
    await pool.query('DELETE FROM target_jobs WHERE student_id = ?', [sid]);
  }
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [uid]);
  await pool.query('DELETE FROM students WHERE user_id = ?', [uid]);
  await pool.query('DELETE FROM users WHERE id = ?', [uid]);
}

async function clearRecoCache(): Promise<void> {
  const r = recoInternal.getRedis();
  const keys = await r.keys(`${recoInternal.CACHE_PREFIX}*`);
  if (keys.length) await r.del(...keys);
}

beforeAll(async () => {
  app = createApp();
  await cleanup();
  await authInternal.clearLockout(authInternal.normalizeEmail(TEST_EMAIL));
  accessToken = await bootstrap(app);

  // 목표 직무 IT/backend 등록
  const tjRes = await request(app)
    .put('/v1/students/me/target-jobs')
    .set({ Authorization: `Bearer ${accessToken}` })
    .send([{ industry_code: 'IT', job_role_code: 'backend', priority: 1 }])
    .expect(200);
  backendTargetId = tjRes.body[0].id;
});

beforeEach(async () => {
  await clearRecoCache();
});

afterAll(async () => {
  await cleanup();
  await clearRecoCache();
  await authInternal.clearLockout(authInternal.normalizeEmail(TEST_EMAIL));
  await authInternal.getRedis().quit();
  await recoInternal.getRedis().quit();
  await closePool();
});

function authed() {
  return { Authorization: `Bearer ${accessToken}` };
}

describe('/v1/gap-diagnosis', () => {
  it('미인증 401', async () => {
    const res = await request(app).post('/v1/gap-diagnosis').send({ target_job_id: 1 });
    expect(res.status).toBe(401);
  });

  it('다른 사람 target_job_id 는 404', async () => {
    const res = await request(app)
      .post('/v1/gap-diagnosis')
      .set(authed())
      .send({ target_job_id: 999999999 });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TARGET_JOB_NOT_FOUND');
  });

  it('활동 0개 — overall_score=0, missing 에 backend 전체 키워드', async () => {
    const res = await request(app)
      .post('/v1/gap-diagnosis')
      .set(authed())
      .send({ target_job_id: backendTargetId });
    expect(res.status).toBe(200);
    expect(res.body.overall_score).toBe(0);
    expect(res.body.payload.fulfilled).toEqual([]);
    expect(res.body.payload.missing.length).toBeGreaterThan(0);
    expect(res.body.payload.priority_to_improve.length).toBeGreaterThan(0);
    expect(res.body.insight.source).toBe('rule');
    expect(typeof res.body.insight.narrative).toBe('string');
  });

  it('활동 등록 후 점수 상승', async () => {
    // backend 직무에 매치되는 키워드를 활동 태그로 등록
    await request(app)
      .post('/v1/activities')
      .set(authed())
      .send({
        category: 'project',
        title: 'API 프로젝트',
        started_at: '2026-03-01',
        manual_tags: ['java', 'spring', 'sql', 'mysql', 'docker', 'git'],
      })
      .expect(201);

    const res = await request(app)
      .post('/v1/gap-diagnosis')
      .set(authed())
      .send({ target_job_id: backendTargetId });
    expect(res.status).toBe(200);
    expect(res.body.overall_score).toBeGreaterThan(0);
    // 시드(backend) 의 핵심 키워드 일부는 fulfilled 에 들어가야 한다
    expect(res.body.payload.fulfilled).toEqual(
      expect.arrayContaining(['java', 'spring', 'sql', 'mysql', 'docker', 'git']),
    );
  });

  it('두 번째 호출은 캐시 hit (insight.source=cache)', async () => {
    await request(app)
      .post('/v1/gap-diagnosis')
      .set(authed())
      .send({ target_job_id: backendTargetId })
      .expect(200);
    const second = await request(app)
      .post('/v1/gap-diagnosis')
      .set(authed())
      .send({ target_job_id: backendTargetId })
      .expect(200);
    expect(second.body.insight.source).toBe('cache');
  });

  it('GET /latest 가 최신 스냅샷을 반환', async () => {
    const res = await request(app)
      .get('/v1/gap-diagnosis/latest')
      .set(authed())
      .query({ target_job_id: backendTargetId });
    expect(res.status).toBe(200);
    expect(res.body.target_job_id).toBe(backendTargetId);
    expect(res.body.model_version).toBe('rule-1.0');
  });

  it('target_job_id 누락 — 400', async () => {
    const res = await request(app).get('/v1/gap-diagnosis/latest').set(authed());
    expect(res.status).toBe(400);
  });
});
