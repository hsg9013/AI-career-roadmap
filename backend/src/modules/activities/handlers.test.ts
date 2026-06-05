import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getPool, closePool } from '../../db/pool.js';
import { __internal as authInternal } from '../auth/service.js';

const TEST_EMAIL = `vitest-act-${Date.now()}@uni.ac.kr`;
const TEST_PASSWORD = 'vitest-strong-3';

let app: Express;
let accessToken: string;

async function bootstrap(app: Express): Promise<string> {
  await request(app)
    .post('/v1/auth/register/student')
    .send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      university: '활동대학교',
      major: '활동학과',
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
  const userId = arr[0]!.id;
  const [stRows] = await pool.query('SELECT id FROM students WHERE user_id = ?', [userId]);
  const stArr = stRows as Array<{ id: number }>;
  if (stArr[0]) {
    const [actRows] = await pool.query('SELECT id FROM activities WHERE student_id = ?', [
      stArr[0].id,
    ]);
    const ids = (actRows as Array<{ id: number }>).map((r) => r.id);
    if (ids.length) {
      await pool.query(
        `DELETE FROM activity_tags WHERE activity_id IN (${ids.map(() => '?').join(',')})`,
        ids,
      );
    }
    await pool.query('DELETE FROM activities WHERE student_id = ?', [stArr[0].id]);
  }
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  await pool.query('DELETE FROM students WHERE user_id = ?', [userId]);
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
}

beforeAll(async () => {
  app = createApp();
  await cleanup();
  await authInternal.clearLockout(authInternal.normalizeEmail(TEST_EMAIL));
  accessToken = await bootstrap(app);
});

afterAll(async () => {
  await cleanup();
  await authInternal.clearLockout(authInternal.normalizeEmail(TEST_EMAIL));
  await authInternal.getRedis().quit();
  await closePool();
});

function authed() {
  return { Authorization: `Bearer ${accessToken}` };
}

describe('/v1/activities CRUD', () => {
  let createdId: number;

  it('미인증 401', async () => {
    const res = await request(app).get('/v1/activities');
    expect(res.status).toBe(401);
  });

  it('초기 목록 빈 페이지', async () => {
    const res = await request(app).get('/v1/activities').set(authed());
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.pagination).toEqual({ page: 1, page_size: 20, total: 0 });
  });

  it('잘못된 category 400', async () => {
    const res = await request(app)
      .get('/v1/activities')
      .set(authed())
      .query({ category: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('활동 등록 201 + 수동 태그 반영', async () => {
    const res = await request(app)
      .post('/v1/activities')
      .set(authed())
      .send({
        category: 'project',
        title: '캡스톤 프로젝트',
        description: 'Vue + Express',
        started_at: '2026-03-01',
        ended_at: '2026-06-30',
        outcome: '교내 우수상',
        manual_tags: ['vue', 'express', 'fullstack'],
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('캡스톤 프로젝트');
    expect(res.body.started_at).toBe('2026-03-01');
    expect(res.body.ended_at).toBe('2026-06-30');
    expect(res.body.tags).toHaveLength(3);
    expect(res.body.tags.every((t: { source: string }) => t.source === 'user')).toBe(true);
    createdId = res.body.id;
  });

  it('잘못된 started_at 400', async () => {
    const res = await request(app)
      .post('/v1/activities')
      .set(authed())
      .send({ category: 'course', title: '강의', started_at: '2026/03/01' });
    expect(res.status).toBe(400);
  });

  it('목록에 등록한 활동 포함', async () => {
    const res = await request(app).get('/v1/activities').set(authed());
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.items[0].id).toBe(createdId);
  });

  it('category 필터', async () => {
    const a = await request(app).get('/v1/activities').set(authed()).query({ category: 'project' });
    expect(a.body.pagination.total).toBe(1);
    const b = await request(app).get('/v1/activities').set(authed()).query({ category: 'course' });
    expect(b.body.pagination.total).toBe(0);
  });

  it('PATCH 로 부분 갱신 (수동 태그 교체 포함)', async () => {
    const res = await request(app)
      .patch(`/v1/activities/${createdId}`)
      .set(authed())
      .send({ outcome: '최우수상', manual_tags: ['vue', 'typescript'] });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('최우수상');
    expect(res.body.tags.map((t: { tag: string }) => t.tag).sort()).toEqual(['typescript', 'vue']);
  });

  it('빈 PATCH body 400', async () => {
    const res = await request(app).patch(`/v1/activities/${createdId}`).set(authed()).send({});
    expect(res.status).toBe(400);
  });

  it('다른 학생 활동 PATCH/DELETE 는 404 처리 — 존재하지 않는 id', async () => {
    const res = await request(app)
      .patch(`/v1/activities/999999999`)
      .set(authed())
      .send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE 204 + 이후 목록에서 사라짐', async () => {
    const del = await request(app).delete(`/v1/activities/${createdId}`).set(authed());
    expect(del.status).toBe(204);
    const list = await request(app).get('/v1/activities').set(authed());
    expect(list.body.pagination.total).toBe(0);
  });

  it('DELETE 두 번째 호출 404', async () => {
    const del = await request(app).delete(`/v1/activities/${createdId}`).set(authed());
    expect(del.status).toBe(404);
  });

  it('페이지 사이즈 경계 — page_size=200 은 400', async () => {
    const res = await request(app).get('/v1/activities').set(authed()).query({ page_size: 200 });
    expect(res.status).toBe(400);
  });
});
