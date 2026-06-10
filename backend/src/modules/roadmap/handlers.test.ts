import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getPool, closePool } from '../../db/pool.js';

// US2 로드맵 통합 테스트 — DB 기동 필요 (V007/V008 적용 + 선배 시드 전제).
//   • IT/backend · y4plus 코호트(시드 6명 ≥5) → source='cohort'
//   • IT/frontend · y4plus(시드 3명 <5)        → source='fallback' + notice
//   • 추천 거부 후 재생성 시 해당 item_ref 제외 (FR-006)

const EMAIL = `vitest-roadmap-${Date.now()}@uni.ac.kr`;
const PASSWORD = 'vitest-strong-4';

let app: Express;
let token: string;

async function setTargetJobs(): Promise<void> {
  await request(app)
    .put('/v1/students/me/target-jobs')
    .set('Authorization', `Bearer ${token}`)
    .send([
      { industry_code: 'IT', job_role_code: 'backend', priority: 1 },
      { industry_code: 'IT', job_role_code: 'frontend', priority: 2 },
      { industry_code: 'IT', job_role_code: 'data', priority: 3 },
    ])
    .expect(200);
}

async function targetJobId(role: string): Promise<number> {
  const r = await request(app)
    .get('/v1/students/me/target-jobs')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const job = (r.body as Array<{ id: number; job_role_code: string }>).find((j) => j.job_role_code === role);
  if (!job) throw new Error(`target job ${role} not found`);
  return job.id;
}

beforeAll(async () => {
  app = createApp();
  await request(app)
    .post('/v1/auth/register/student')
    .send({ email: EMAIL, password: PASSWORD, university: '로드맵대', major: '컴공', year_in_school: 4 })
    .expect(201);
  const login = await request(app).post('/v1/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
  token = login.body.access_token as string;
  await setTargetJobs();
});

afterAll(async () => {
  const pool = getPool();
  // users → students → (roadmaps/target_jobs/rejections...) 모두 ON DELETE CASCADE
  await pool.query('DELETE FROM users WHERE email = ?', [EMAIL]);
  await closePool();
});

describe('POST /v1/roadmap (cohort path)', () => {
  it('IT/backend y4plus 코호트(≥5)로 로드맵을 생성한다', async () => {
    const id = await targetJobId('backend');
    const res = await request(app)
      .post('/v1/roadmap')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_job_id: id })
      .expect(200);

    expect(res.body.source).toBe('cohort');
    expect(res.body.cohort_size).toBeGreaterThanOrEqual(5);
    expect(res.body.cohort_key).toBe('IT/backend/y4plus');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    // period 오름차순 보장
    const periods = res.body.items.map((i: { period: string }) => i.period);
    expect([...periods]).toEqual([...periods].sort());
  });
});

describe('POST /v1/roadmap (fallback path)', () => {
  it('학년 코호트 표본 부족(<5) 직무는 폴백 + 안내문구를 반환한다', async () => {
    // 004: 표본 시드(G6)는 직무당 10건을 3개 학년대로 분산하므로, 갓 채워진 직무(IT/data)의
    // y4plus 코호트는 <5(부족) → 직무 전체 경로로 폴백. 공유 데이터 변경 없이 결정적 검증.
    const id = await targetJobId('data');
    const res = await request(app)
      .post('/v1/roadmap')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_job_id: id })
      .expect(200);

    expect(res.body.source).toBe('fallback');
    expect(res.body.notice).toBeTruthy();
  });
});

describe('POST /v1/roadmap/items/:itemId/reject (FR-006)', () => {
  it('거부한 항목은 재생성 시 제외된다', async () => {
    const id = await targetJobId('backend');
    const first = await request(app)
      .post('/v1/roadmap')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_job_id: id })
      .expect(200);

    const target = first.body.items[0];
    await request(app)
      .post(`/v1/roadmap/items/${target.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '관심 없음' })
      .expect(204);

    const second = await request(app)
      .post('/v1/roadmap')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_job_id: id })
      .expect(200);

    const refs = second.body.items.map((i: { item_ref: string }) => i.item_ref);
    expect(refs).not.toContain(target.item_ref);
  });
});
