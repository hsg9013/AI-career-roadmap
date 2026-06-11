import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getPool, closePool } from '../../db/pool.js';
import { isAcKrEmail } from './schoolEmail.js';

// 003 US6: 학교 이메일 검증(.ac.kr 게이트). 메일은 dev 콘솔, verify 는 devToken 노출.
// (네이버 소셜 로그인은 기획 방향에 따라 제거됨)

const RUN = Date.now();
const EXISTING_EMAIL = `vitest-us6-${RUN}@uni.ac.kr`;
const PASSWORD = 'vitest-strong-us6';

let app: Express;
const createdEmails: string[] = [EXISTING_EMAIL];

beforeAll(async () => {
  app = createApp();
});

afterAll(async () => {
  for (const e of createdEmails) await getPool().query('DELETE FROM users WHERE email = ?', [e]);
  await closePool();
});

describe('isAcKrEmail', () => {
  it('.ac.kr 만 허용', () => {
    expect(isAcKrEmail('a@snu.ac.kr')).toBe(true);
    expect(isAcKrEmail('a@dept.korea.ac.kr')).toBe(true);
    expect(isAcKrEmail('a@gmail.com')).toBe(false);
    expect(isAcKrEmail('a@ac.kr.evil.com')).toBe(false);
  });
});

describe('학교 이메일 검증 (.ac.kr)', () => {
  let token: string;

  beforeAll(async () => {
    await request(app)
      .post('/v1/auth/register/student')
      .send({ email: EXISTING_EMAIL, password: PASSWORD, university: 'US6대', major: 'CS', year_in_school: 2 })
      .expect(201);
    const login = await request(app).post('/v1/auth/login').send({ email: EXISTING_EMAIL, password: PASSWORD }).expect(200);
    token = login.body.access_token as string;
  });

  it('.ac.kr 요청 → 202 pending + devToken', async () => {
    const res = await request(app)
      .post('/v1/auth/school-email/verify')
      .set({ Authorization: `Bearer ${token}` })
      .send({ email: `verify-${RUN}@yonsei.ac.kr` })
      .expect(202);
    expect(res.body.status).toBe('pending');
    expect(res.body.devToken).toBeTruthy();

    // confirm → verified + students 플래그 갱신
    const confirm = await request(app)
      .post('/v1/auth/school-email/confirm')
      .send({ token: res.body.devToken })
      .expect(200);
    expect(confirm.body.status).toBe('verified');

    const status = await request(app)
      .get('/v1/auth/school-email/status')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(status.body.status).toBe('verified');
  });

  it('비-.ac.kr 요청 → 422 거부', async () => {
    await request(app)
      .post('/v1/auth/school-email/verify')
      .set({ Authorization: `Bearer ${token}` })
      .send({ email: `verify-${RUN}@gmail.com` })
      .expect(422);
  });

  it('인증 없이는 401', async () => {
    await request(app)
      .post('/v1/auth/school-email/verify')
      .send({ email: `x-${RUN}@snu.ac.kr` })
      .expect(401);
  });
});
