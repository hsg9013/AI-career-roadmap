import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getPool, closePool } from '../../db/pool.js';
import { __internal as authInternal } from '../auth/service.js';

// T047 통합 테스트: 인증 후 프로필 조회/갱신 + target-jobs 일괄 갱신 (최대 3, 우선순위/직무 중복 거부)

const TEST_EMAIL = `vitest-students-${Date.now()}@uni.ac.kr`;
const TEST_PASSWORD = 'vitest-strong-2';

let app: Express;
let accessToken: string;

async function bootstrapTestUser(app: Express): Promise<string> {
  await request(app)
    .post('/v1/auth/register/student')
    .send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      university: '테스트대학교',
      major: '컴퓨터공학과',
      year_in_school: 2,
    })
    .expect(201);

  const loginRes = await request(app)
    .post('/v1/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
    .expect(200);

  return loginRes.body.access_token as string;
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
    await pool.query('DELETE FROM target_jobs WHERE student_id = ?', [stArr[0].id]);
  }
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  await pool.query('DELETE FROM students WHERE user_id = ?', [userId]);
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
}

beforeAll(async () => {
  app = createApp();
  await cleanup();
  await authInternal.clearLockout(authInternal.normalizeEmail(TEST_EMAIL));
  accessToken = await bootstrapTestUser(app);
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

describe('GET/PUT /v1/students/me', () => {
  it('미인증 401', async () => {
    const res = await request(app).get('/v1/students/me');
    expect(res.status).toBe(401);
  });

  it('프로필 조회', async () => {
    const res = await request(app).get('/v1/students/me').set(authed());
    expect(res.status).toBe(200);
    expect(res.body.university).toBe('테스트대학교');
    expect(res.body.major).toBe('컴퓨터공학과');
    expect(res.body.year_in_school).toBe(2);
    expect(res.body.school_email_verified).toBe(false);
  });

  it('빈 body 는 400', async () => {
    const res = await request(app).put('/v1/students/me').set(authed()).send({});
    expect(res.status).toBe(400);
  });

  it('잘못된 학년은 400', async () => {
    const res = await request(app)
      .put('/v1/students/me')
      .set(authed())
      .send({ year_in_school: 9 });
    expect(res.status).toBe(400);
  });

  it('부분 업데이트 정상', async () => {
    const res = await request(app)
      .put('/v1/students/me')
      .set(authed())
      .send({ year_in_school: 4, expected_grad_at: '2027-02-28' });
    expect(res.status).toBe(200);
    expect(res.body.year_in_school).toBe(4);
    expect(res.body.expected_grad_at).toBe('2027-02-28');
    expect(res.body.university).toBe('테스트대학교'); // 안 건드린 값 유지
  });

  it('expected_grad_at null 처리', async () => {
    const res = await request(app)
      .put('/v1/students/me')
      .set(authed())
      .send({ expected_grad_at: null });
    expect(res.status).toBe(200);
    expect(res.body.expected_grad_at).toBeNull();
  });
});

describe('PUT /v1/students/me/target-jobs', () => {
  it('초기 목록 비어있음', async () => {
    const res = await request(app).get('/v1/students/me/target-jobs').set(authed());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('3개 일괄 등록', async () => {
    const res = await request(app)
      .put('/v1/students/me/target-jobs')
      .set(authed())
      .send([
        { industry_code: 'IT', job_role_code: 'backend', priority: 1 },
        { industry_code: 'IT', job_role_code: 'data', priority: 2 },
        { industry_code: 'FIN', job_role_code: 'quant', priority: 3 },
      ]);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].priority).toBe(1);
  });

  it('4개 등록 시도 400', async () => {
    const res = await request(app)
      .put('/v1/students/me/target-jobs')
      .set(authed())
      .send([
        { industry_code: 'IT', job_role_code: 'a', priority: 1 },
        { industry_code: 'IT', job_role_code: 'b', priority: 2 },
        { industry_code: 'IT', job_role_code: 'c', priority: 3 },
        { industry_code: 'IT', job_role_code: 'd', priority: 1 },
      ]);
    expect(res.status).toBe(400);
  });

  it('우선순위 중복 400', async () => {
    const res = await request(app)
      .put('/v1/students/me/target-jobs')
      .set(authed())
      .send([
        { industry_code: 'IT', job_role_code: 'x', priority: 1 },
        { industry_code: 'IT', job_role_code: 'y', priority: 1 },
      ]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DUPLICATE_PRIORITY');
  });

  it('직무 중복 400', async () => {
    const res = await request(app)
      .put('/v1/students/me/target-jobs')
      .set(authed())
      .send([
        { industry_code: 'IT', job_role_code: 'same', priority: 1 },
        { industry_code: 'IT', job_role_code: 'same', priority: 2 },
      ]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DUPLICATE_JOB');
  });

  it('빈 배열로 전체 클리어', async () => {
    const res = await request(app).put('/v1/students/me/target-jobs').set(authed()).send([]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
