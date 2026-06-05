import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.js';
import { getPool, closePool } from './db/pool.js';

// T070: quickstart.md 엔드투엔드 검증 — 학생 핵심 여정(가입→프로필→진단→로드맵→문서→미션→알림)을
// 단일 happy-path 로 통과시켜 P1~P5 흐름이 살아있음을 보증.

const EMAIL = `vitest-e2e-${Date.now()}@uni.ac.kr`;
const PASSWORD = 'vitest-strong-4';

let app: Express;
let token: string;

function auth() {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  app = createApp();
});

afterAll(async () => {
  await getPool().query('DELETE FROM users WHERE email = ?', [EMAIL]);
  await closePool();
});

describe('T070 quickstart E2E happy path', () => {
  it('가입→프로필→목표직무→활동→진단→로드맵→문서→미션→알림 전 과정 통과', async () => {
    // 1) 가입 + 로그인 (year 4 → y4plus 코호트)
    await request(app)
      .post('/v1/auth/register/student')
      .send({ email: EMAIL, password: PASSWORD, university: 'E2E대', major: '컴공', year_in_school: 4 })
      .expect(201);
    const login = await request(app).post('/v1/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    token = login.body.access_token as string;

    // 2) 목표 직무 (IT/backend)
    await request(app)
      .put('/v1/students/me/target-jobs')
      .set(auth())
      .send([{ industry_code: 'IT', job_role_code: 'backend', priority: 1 }])
      .expect(200);
    const jobs = await request(app).get('/v1/students/me/target-jobs').set(auth()).expect(200);
    const targetJobId = jobs.body[0].id as number;

    // 3) 활동 1건
    await request(app)
      .post('/v1/activities')
      .set(auth())
      .send({ category: 'project', title: 'Spring API 프로젝트', started_at: '2025-03-01', manual_tags: ['spring', 'sql'] })
      .expect(201);

    // 4) 갭 진단 (P1)
    const diag = await request(app).post('/v1/gap-diagnosis').set(auth()).send({ target_job_id: targetJobId }).expect(200);
    expect(diag.body.overall_score).toBeGreaterThanOrEqual(0);

    // 5) 로드맵 (P2) — backend y4plus 코호트(시드 6) → cohort
    const roadmap = await request(app).post('/v1/roadmap').set(auth()).send({ target_job_id: targetJobId }).expect(200);
    expect(roadmap.body.items.length).toBeGreaterThan(0);

    // 6) 문서 (P2)
    const doc = await request(app).post('/v1/documents').set(auth()).send({ doc_type: 'resume' }).expect(201);
    expect(doc.body.version).toBe(1);

    // 7) 미션 + AI 피드백 (P3)
    const missions = await request(app).get('/v1/missions').set(auth()).expect(200);
    const sub = await request(app)
      .post(`/v1/missions/${missions.body[0].id}/submissions`)
      .set(auth())
      .send({ content: '제출물 내용입니다. '.repeat(20) })
      .expect(201);
    expect(sub.body.ai_feedback).toBeTruthy();

    // 8) 알림 (P3)
    const noti = await request(app).get('/v1/notifications').set(auth()).expect(200);
    expect(Array.isArray(noti.body)).toBe(true);
  });
});
