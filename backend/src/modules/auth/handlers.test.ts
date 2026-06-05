import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { buildScopes, verifyAccessToken } from '../../lib/jwt.js';
import { getPool, closePool } from '../../db/pool.js';
import { __internal as svcInternal } from './service.js';
import { __internal as handlerInternal } from './handlers.js';

// T046: 인증 단위/통합 테스트
//   • buildScopes 회귀 (role × universityScope 매트릭스)
//   • 회원가입 → 로그인 → refresh 회전 → reuse 차단 → logout
//   • 5회 실패 잠금
//
// 본 테스트는 로컬 docker compose 의 mariadb/redis 가 떠 있을 때만 의미가 있다.

const TEST_EMAIL = `vitest-auth-${Date.now()}@uni.ac.kr`;
const TEST_PASSWORD = 'vitest-strong-1';

let app: Express;

async function cleanupTestUser(): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [TEST_EMAIL]);
  const arr = rows as Array<{ id: number }>;
  if (arr.length === 0) return;
  const id = arr[0]!.id;
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [id]);
  await pool.query('DELETE FROM students WHERE user_id = ?', [id]);
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
}

beforeAll(async () => {
  app = createApp();
  await cleanupTestUser();
  await svcInternal.clearLockout(svcInternal.normalizeEmail(TEST_EMAIL));
});

beforeEach(async () => {
  await svcInternal.clearLockout(svcInternal.normalizeEmail(TEST_EMAIL));
});

afterAll(async () => {
  await cleanupTestUser();
  await svcInternal.clearLockout(svcInternal.normalizeEmail(TEST_EMAIL));
  await svcInternal.getRedis().quit();
  await closePool();
});

describe('buildScopes — 권한 매트릭스 회귀 방지', () => {
  it('student 는 scope 비어 있다 (라우터에서 처리)', () => {
    expect(buildScopes({ role: 'student' })).toEqual([]);
  });

  it('mentor 는 read/write 둘 다', () => {
    expect(buildScopes({ role: 'mentor' })).toEqual(['mentor:read', 'mentor:write']);
  });

  it('admin 은 moderation/billing 둘 다', () => {
    expect(buildScopes({ role: 'admin' })).toEqual(['admin:moderation', 'admin:billing']);
  });

  it('university aggregate_only', () => {
    expect(buildScopes({ role: 'university', universityScope: 'aggregate_only' })).toEqual([
      'university:aggregate',
    ]);
  });

  it('university aggregate_and_individual', () => {
    expect(
      buildScopes({ role: 'university', universityScope: 'aggregate_and_individual' }),
    ).toEqual(['university:aggregate', 'university:individual']);
  });

  it('university 동의 없음(null) 은 비어있음', () => {
    expect(buildScopes({ role: 'university', universityScope: null })).toEqual([]);
  });

  it('enterprise 는 라우터 단 권한 — scope 비어있음', () => {
    expect(buildScopes({ role: 'enterprise' })).toEqual([]);
  });
});

describe('auth flow — register → login → refresh → logout', () => {
  it('학생 회원가입 201', async () => {
    const res = await request(app)
      .post('/v1/auth/register/student')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        university: '테스트대학',
        major: '컴퓨터공학',
        year_in_school: 3,
      });
    expect(res.status).toBe(201);
    expect(res.body.user_id).toBeGreaterThan(0);
    expect(res.body.email_verification_sent).toBe(false);
  });

  it('중복 이메일 회원가입 409', async () => {
    const res = await request(app)
      .post('/v1/auth/register/student')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        university: '테스트대학',
        major: '컴퓨터공학',
        year_in_school: 3,
      });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('잘못된 비밀번호 401 + 5회 누적 후 423', async () => {
    for (let i = 0; i < 5; i += 1) {
      const r = await request(app)
        .post('/v1/auth/login')
        .send({ email: TEST_EMAIL, password: 'wrongpass' });
      expect(r.status).toBe(401);
    }
    const sixth = await request(app)
      .post('/v1/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrongpass' });
    expect(sixth.status).toBe(423);
    expect(sixth.body.code).toBe('ACCOUNT_LOCKED');
    // 잠긴 상태에서는 정답 비밀번호도 423
    const locked = await request(app)
      .post('/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(locked.status).toBe(423);
  });

  it('성공 로그인 시 access_token 발급 + role=student + scopes 비어있음 + refresh 쿠키 세팅', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('student');
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.expires_in).toBeGreaterThan(0);

    const claims = verifyAccessToken(res.body.access_token);
    expect(claims.role).toBe('student');
    expect(claims.scopes).toEqual([]);

    const setCookie = res.headers['set-cookie'];
    const cookieHeaders = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const refreshCookie = cookieHeaders.find((c) =>
      c.startsWith(`${handlerInternal.REFRESH_COOKIE_NAME}=`),
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/v1/auth');
  });

  it('refresh 회전 + 재사용 시 family revoke', async () => {
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const cookies = loginRes.headers['set-cookie'];
    const firstCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c) =>
      String(c).startsWith(`${handlerInternal.REFRESH_COOKIE_NAME}=`),
    ) as string;
    expect(firstCookie).toBeDefined();

    const rotated = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', firstCookie.split(';')[0]!);
    expect(rotated.status).toBe(200);
    expect(typeof rotated.body.access_token).toBe('string');

    // 같은(이미 회전된) 쿠키 재사용 → 401
    const reused = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', firstCookie.split(';')[0]!);
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe('REFRESH_REUSED');
  });

  it('logout 은 쿠키 없어도 204', async () => {
    const res = await request(app).post('/v1/auth/logout');
    expect(res.status).toBe(204);
  });
});
