import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import type { Express } from 'express';
import { createApp } from './app.js';
import { getPool, closePool } from './db/pool.js';

// 005 T043: 성능 점검 — plan Performance Goals / SC 대응.
//   • 조회 API(활동/스펙·매칭·노출 목록) p95 < 200ms
//   • POST /roadmap(생성, Claude 호출 포함·미설정 시 폴백) p95 < 2.0s
// 공유 MariaDB 기동 필요. 로컬 조회는 보통 <50ms 이나, p95 로 측정해 회귀를 잡는다.

const SUF = `${Date.now()}`;
const PW = 'vitest-strong-4';
const STU = `vitest-perf-stu-${SUF}@uni.ac.kr`;
const ENT = `vitest-perf-ent-${SUF}@p16.local`;
const EMAILS = [STU, ENT];

const READ_P95_MS = 200;
const ROADMAP_P95_MS = 2000;

let app: Express;
const token: Record<string, string> = {};
const bearer = (e: string) => ({ Authorization: `Bearer ${token[e]}` });

function p95(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(0.95 * s.length) - 1);
  return s[idx] ?? 0;
}

async function loginToken(email: string): Promise<string> {
  const res = await request(app).post('/v1/auth/login').send({ email, password: PW }).expect(200);
  return res.body.access_token as string;
}

beforeAll(async () => {
  app = createApp();
  // 학생 — 목표 직무(IT/backend) + 활동 1건(조회/매칭/로드맵 표본).
  await request(app)
    .post('/v1/auth/register/student')
    .send({ email: STU, password: PW, university: '성능대', major: '컴공', year_in_school: 4 })
    .expect(201);
  token[STU] = await loginToken(STU);
  await request(app)
    .put('/v1/students/me/target-jobs')
    .set(bearer(STU))
    .send([{ industry_code: 'IT', job_role_code: 'backend', priority: 1 }])
    .expect(200);
  await request(app)
    .post('/v1/activities')
    .set(bearer(STU))
    .send({ category: 'project', title: '성능 표본 프로젝트', started_at: '2025-03-01', manual_tags: ['spring'] })
    .expect(201);
  // 매칭 노출 동의(기업 후보 검색 대상이 되도록).
  await request(app).put('/v1/students/me/match-consent').set(bearer(STU)).send({ opted_in: true }).expect(204);

  // 기업 — 후보(매칭) 조회용.
  const hash = await bcrypt.hash(PW, 10);
  await getPool().query(
    'INSERT INTO users (email, password_hash, role, email_verified, is_active) VALUES (?, ?, ?, 1, 1)',
    [ENT, hash, 'enterprise'],
  );
  token[ENT] = await loginToken(ENT);
});

afterAll(async () => {
  for (const e of EMAILS) await getPool().query('DELETE FROM users WHERE email = ?', [e]);
  await closePool();
});

async function measure(label: string, n: number, call: () => Promise<unknown>): Promise<number> {
  // 워밍업 1회(커넥션·플랜 캐시) 후 측정.
  await call();
  const samples: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t0 = Date.now();
    await call();
    samples.push(Date.now() - t0);
  }
  const v = p95(samples);
  const med = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 0;
  // eslint-disable-next-line no-console
  console.log(`[perf] ${label}: n=${n} median=${med}ms p95=${v}ms`);
  return v;
}

describe('T043 조회 API p95 < 200ms', () => {
  it('GET /v1/activities (활동/스펙 목록)', async () => {
    const v = await measure('GET /activities', 30, () =>
      request(app).get('/v1/activities').set(bearer(STU)).expect(200),
    );
    expect(v).toBeLessThan(READ_P95_MS);
  });

  it('GET /v1/job-postings (직무 맞춤 노출 목록)', async () => {
    const v = await measure('GET /job-postings', 30, () =>
      request(app).get('/v1/job-postings?industry_code=IT&job_role_code=backend').set(bearer(STU)).expect(200),
    );
    expect(v).toBeLessThan(READ_P95_MS);
  });

  it('GET /v1/companies/candidates (기업 매칭 검색)', async () => {
    const v = await measure('GET /companies/candidates', 30, () =>
      request(app)
        .get('/v1/companies/candidates?industry_code=IT&job_role_code=backend')
        .set(bearer(ENT))
        .expect(200),
    );
    expect(v).toBeLessThan(READ_P95_MS);
  });
});

describe('T043 POST /v1/roadmap(생성) p95 < 2.0s', () => {
  it('로드맵 생성 — Claude 미설정 시 폴백 포함', async () => {
    const jobs = await request(app).get('/v1/students/me/target-jobs').set(bearer(STU)).expect(200);
    const targetJobId = jobs.body[0].id as number;
    const v = await measure('POST /roadmap', 10, () =>
      request(app).post('/v1/roadmap').set(bearer(STU)).send({ target_job_id: targetJobId }).expect(200),
    );
    expect(v).toBeLessThan(ROADMAP_P95_MS);
  });
});
