import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { getPool, closePool } from '../db/pool.js';

// US3/US4/US5/US9 + 처리방침(T073) 학생 플로우 통합 테스트 — DB 기동 필요.

const EMAIL = `vitest-p2p4-${Date.now()}@uni.ac.kr`;
const PASSWORD = 'vitest-strong-4';

let app: Express;
let token: string;

function auth() {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  app = createApp();
  await request(app)
    .post('/v1/auth/register/student')
    .send({ email: EMAIL, password: PASSWORD, university: 'P2P4대', major: '컴공', year_in_school: 4 })
    .expect(201);
  const login = await request(app).post('/v1/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
  token = login.body.access_token as string;
  // 문서 생성을 위한 활동 1건
  await request(app)
    .post('/v1/activities')
    .set(auth())
    .send({ category: 'project', title: 'Spring 사이드 프로젝트', started_at: '2025-03-01', outcome: 'API 10종 구현' })
    .expect(201);
});

afterAll(async () => {
  await getPool().query('DELETE FROM users WHERE email = ?', [EMAIL]);
  await closePool();
});

describe('US3 문서 자동 생성', () => {
  it('포트폴리오를 생성하고 목록·수정한다', async () => {
    const gen = await request(app).post('/v1/documents').set(auth()).send({ doc_type: 'portfolio' }).expect(201);
    expect(gen.body.doc_type).toBe('portfolio');
    expect(gen.body.version).toBe(1);

    const list = await request(app).get('/v1/documents').set(auth()).expect(200);
    expect(list.body.length).toBeGreaterThan(0);

    const upd = await request(app)
      .put(`/v1/documents/${gen.body.id}`)
      .set(auth())
      .send({ status: 'final' })
      .expect(200);
    expect(upd.body.status).toBe('final');
  });
});

describe('US4 미션 제출 + AI 피드백', () => {
  it('미션 목록을 받아 제출하면 AI 1차 피드백이 제공된다', async () => {
    const missions = await request(app).get('/v1/missions').set(auth()).expect(200);
    expect(missions.body.length).toBeGreaterThan(0);
    const missionId = missions.body[0].id;

    const sub = await request(app)
      .post(`/v1/missions/${missionId}/submissions`)
      .set(auth())
      .send({ content: '문제 정의와 접근 방법을 상세히 기술한 제출물입니다.'.repeat(5) })
      .expect(201);
    expect(sub.body.ai_feedback).toContain('AI 1차 분석');
    expect(['assigned', 'ai_reviewed']).toContain(sub.body.state);

    const fb = await request(app).get(`/v1/submissions/${sub.body.submission_id}/feedback`).set(auth()).expect(200);
    expect(fb.body.feedbacks.some((f: { kind: string }) => f.kind === 'ai')).toBe(true);
  });
});

describe('US5 알림', () => {
  it('알림 목록은 배열을 반환한다', async () => {
    const res = await request(app).get('/v1/notifications').set(auth()).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('US9 선배 데이터 기부', () => {
  it('합격 경로를 익명화 저장하고 보상한다', async () => {
    const res = await request(app)
      .post('/v1/alumni/paths')
      .set(auth())
      .send({
        industry_code: 'IT',
        job_role_code: 'backend',
        major_field: 'engineering',
        grade_band: 'y4plus',
        success_year: 2025,
        activities: [{ period: 'Y3', activity_type: 'internship', detail: '백엔드 인턴', skill_tag: 'spring' }],
      })
      .expect(201);
    expect(res.body.anonymized).toBe(true);
    expect(res.body.alumni_path_id).toBeGreaterThan(0);
  });
});

describe('T073 처리방침 재동의', () => {
  it('정책 조회 → 재동의 → needs_consent=false', async () => {
    const before = await request(app).get('/v1/consent/policy').set(auth()).expect(200);
    expect(before.body.needs_consent).toBe(true);
    await request(app).post('/v1/consent/policy/consent').set(auth()).send({ version: before.body.version }).expect(204);
    const after = await request(app).get('/v1/consent/policy').set(auth()).expect(200);
    expect(after.body.needs_consent).toBe(false);
  });
});
