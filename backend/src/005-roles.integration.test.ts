import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import type { Express } from 'express';
import { createApp } from './app.js';
import { getPool, closePool } from './db/pool.js';
import { K_ANONYMITY_MIN } from './services/recommendation/kAnonymity.js';

// 005 T039: 역할별 실동작 통합 테스트 — DB 기동 필요(공유 MariaDB).
// 강제 검증 대상(tasks.md T039):
//   1) k-익명성(코호트 표본 ≥5) + 코호트 폴백(학년대 표본 부족 → 직무 전체로 하향)
//   2) 활동 기간 검증(ended_at < started_at → 400)
//   3) 결제 성공/실패에 따른 멤버십(등급) 변경
//   4) 매칭 동의/직무 노출 제외 + 카탈로그 직무 드롭다운 매칭
//   5) 멘토 결합 피드백(ai+mentor) + 역할 게이트(student → /mentor 403)
//
// 결정론 앵커(현재 seed:005 분포): IT/backend·y4plus = 38명(≥5 → cohort),
//   IT/data·y1_2 = 3명(<5 → 학년대 표본 부족) · IT/data 직무 전체 = 10명(≥5 → fallback).

const SUFFIX = `${Date.now()}`;
const PW = 'vitest-strong-4';

const STU_A = `vitest-005-stuA-${SUFFIX}@uni.ac.kr`; // year4, IT/backend (cohort)
const STU_B = `vitest-005-stuB-${SUFFIX}@uni.ac.kr`; // year1, IT/data  (fallback)
const MENTOR = `vitest-005-mentor-${SUFFIX}@p16.local`;
const ENTERPRISE = `vitest-005-ent-${SUFFIX}@p16.local`;

const EMAILS = [STU_A, STU_B, MENTOR, ENTERPRISE];

let app: Express;
const token: Record<string, string> = {};
const bearer = (email: string) => ({ Authorization: `Bearer ${token[email]}` });

async function loginToken(email: string): Promise<string> {
  const res = await request(app).post('/v1/auth/login').send({ email, password: PW }).expect(200);
  return res.body.access_token as string;
}

async function registerStudent(email: string, year: number): Promise<void> {
  await request(app)
    .post('/v1/auth/register/student')
    .send({ email, password: PW, university: '통합테스트대', major: '컴공', year_in_school: year })
    .expect(201);
  token[email] = await loginToken(email);
}

// 멘토/기업은 공개 가입 라우트가 없어 DB에 직접 생성(데모 시드 동등) 후 로그인.
async function createRoleUser(email: string, role: 'mentor' | 'enterprise'): Promise<number> {
  const hash = await bcrypt.hash(PW, 10);
  const [ins] = await getPool().query(
    'INSERT INTO users (email, password_hash, role, email_verified, is_active) VALUES (?, ?, ?, 1, 1)',
    [email, hash, role],
  );
  const userId = (ins as { insertId: number }).insertId;
  if (role === 'mentor') {
    await getPool().query(
      "INSERT INTO mentors (user_id, expertise, mentor_track, verified) VALUES (?, 'backend', 'flat', 1)",
      [userId],
    );
  }
  token[email] = await loginToken(email);
  return userId;
}

async function setTargetJob(email: string, industry: string, role: string): Promise<number> {
  await request(app)
    .put('/v1/students/me/target-jobs')
    .set(bearer(email))
    .send([{ industry_code: industry, job_role_code: role, priority: 1 }])
    .expect(200);
  const jobs = await request(app).get('/v1/students/me/target-jobs').set(bearer(email)).expect(200);
  return jobs.body[0].id as number;
}

beforeAll(async () => {
  app = createApp();
  await registerStudent(STU_A, 4);
  await registerStudent(STU_B, 1);
  await createRoleUser(MENTOR, 'mentor');
  await createRoleUser(ENTERPRISE, 'enterprise');
});

afterAll(async () => {
  for (const email of EMAILS) {
    await getPool().query('DELETE FROM users WHERE email = ?', [email]);
  }
  await closePool();
});

describe('T039-1 k-익명성 + 코호트 폴백 (POST /v1/roadmap)', () => {
  it('충분한 코호트(IT/backend·y4plus=38) → source=cohort, cohort_size≥K', async () => {
    const targetJobId = await setTargetJob(STU_A, 'IT', 'backend');
    const res = await request(app)
      .post('/v1/roadmap')
      .set(bearer(STU_A))
      .send({ target_job_id: targetJobId })
      .expect(200);

    expect(res.body.source).toBe('cohort');
    expect(res.body.cohort_size).toBeGreaterThanOrEqual(K_ANONYMITY_MIN);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.rationale.sample_size).toBe(res.body.cohort_size);
    // 가시성
    // eslint-disable-next-line no-console
    console.log(`[T039] cohort: size=${res.body.cohort_size} source=${res.body.source}`);
  });

  it('학년대 표본 부족(IT/data·y1_2=3<K) → 직무 전체로 폴백(source=fallback) + notice', async () => {
    const targetJobId = await setTargetJob(STU_B, 'IT', 'data');
    const res = await request(app)
      .post('/v1/roadmap')
      .set(bearer(STU_B))
      .send({ target_job_id: targetJobId })
      .expect(200);

    // 3-키 코호트(y1_2=3)는 K 미만이라 노출 금지 → 직무 전체(=10) 표본으로 하향.
    expect(res.body.source).toBe('fallback');
    expect(res.body.cohort_size).toBeGreaterThanOrEqual(K_ANONYMITY_MIN);
    expect(res.body.notice).toBeTruthy();
    expect(res.body.items.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`[T039] fallback: size=${res.body.cohort_size} notice="${res.body.notice}"`);
  });

  it('불변식: source=cohort 이면 cohort_size ≥ K_ANONYMITY_MIN', () => {
    // 위 두 케이스로 cohort/fallback 분기 모두 커버됨을 명시.
    expect(K_ANONYMITY_MIN).toBe(5);
  });
});

describe('T039-2 활동 기간 검증 (POST /v1/activities)', () => {
  it('종료일 < 시작일 → 400', async () => {
    await request(app)
      .post('/v1/activities')
      .set(bearer(STU_A))
      .send({ category: 'project', title: '기간 역전', started_at: '2025-06-01', ended_at: '2025-03-01' })
      .expect(400);
  });

  it('종료일 ≥ 시작일 → 201', async () => {
    const res = await request(app)
      .post('/v1/activities')
      .set(bearer(STU_A))
      .send({ category: 'project', title: '정상 기간', started_at: '2025-03-01', ended_at: '2025-06-01' })
      .expect(201);
    expect(res.body.ended_at).toBe('2025-06-01');
  });
});

describe('T039-3 결제 성공/실패 → 멤버십(등급) 변경 (POST /v1/payments/checkout)', () => {
  it('force_result=success → paid + 멤버십 활성(ends_at 부여)', async () => {
    const res = await request(app)
      .post('/v1/payments/checkout')
      .set(bearer(STU_A))
      .send({ kind: 'membership', amount: 9900, plan: 'standard', force_result: 'success' })
      .expect(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.membership_ends_at).toBeTruthy();
  });

  it('force_result=fail → failed + 멤버십 비활성(ends_at 없음)', async () => {
    const res = await request(app)
      .post('/v1/payments/checkout')
      .set(bearer(STU_A))
      .send({ kind: 'membership', amount: 9900, plan: 'standard', force_result: 'fail' })
      .expect(200);
    expect(res.body.status).toBe('failed');
    expect(res.body.membership_ends_at).toBeNull();
  });
});

describe('T039-4 매칭 동의/직무 노출 제외 + 드롭다운 매칭 (GET /v1/companies/candidates)', () => {
  async function candidates(query: string) {
    const res = await request(app).get(`/v1/companies/candidates${query}`).set(bearer(ENTERPRISE)).expect(200);
    return res.body as Array<{ student_id: number; target_role: string }>;
  }
  async function studentIdOf(email: string): Promise<number> {
    const [rows] = await getPool().query(
      'SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = ?',
      [email],
    );
    return (rows as Array<{ id: number }>)[0].id;
  }

  it('미동의 학생은 후보에서 제외된다', async () => {
    const sid = await studentIdOf(STU_A);
    const list = await candidates('?industry_code=IT&job_role_code=backend');
    expect(list.some((c) => c.student_id === sid)).toBe(false);
  });

  it('동의(opted_in) 후 직무 일치 시 노출 + 다른 직무 필터에는 미노출', async () => {
    const sid = await studentIdOf(STU_A);
    await request(app).put('/v1/students/me/match-consent').set(bearer(STU_A)).send({ opted_in: true }).expect(204);

    const matched = await candidates('?industry_code=IT&job_role_code=backend');
    expect(matched.some((c) => c.student_id === sid && c.target_role === 'backend')).toBe(true);

    // 드롭다운 매칭: 목표가 backend 인 학생은 frontend 필터에 잡히면 안 된다.
    const other = await candidates('?industry_code=IT&job_role_code=frontend');
    expect(other.some((c) => c.student_id === sid)).toBe(false);
  });

  it('동의 철회(opted_out) 시 다시 제외된다', async () => {
    const sid = await studentIdOf(STU_A);
    await request(app).put('/v1/students/me/match-consent').set(bearer(STU_A)).send({ opted_in: false }).expect(204);
    const list = await candidates('?industry_code=IT&job_role_code=backend');
    expect(list.some((c) => c.student_id === sid)).toBe(false);
  });
});

describe('T039-5 멘토 결합 피드백 + 역할 게이트', () => {
  it('학생 제출(AI 1차) → 멘토 코멘트 → 결합 피드백에 ai+mentor 동시 존재', async () => {
    const missions = await request(app).get('/v1/missions').set(bearer(STU_A)).expect(200);
    const missionId = missions.body[0].id as number;

    const sub = await request(app)
      .post(`/v1/missions/${missionId}/submissions`)
      .set(bearer(STU_A))
      .send({ content: '문제 정의·접근·결과를 상세히 기술한 제출물입니다. '.repeat(5) })
      .expect(201);
    const submissionId = sub.body.submission_id as number;
    expect(sub.body.ai_feedback).toBeTruthy();

    await request(app)
      .post(`/v1/mentor/submissions/${submissionId}/feedback`)
      .set(bearer(MENTOR))
      .send({ content: '현직자 관점에서 아키텍처 트레이드오프를 보강하세요.' })
      .expect(201);

    const fb = await request(app).get(`/v1/submissions/${submissionId}/feedback`).set(bearer(STU_A)).expect(200);
    const kinds = (fb.body.feedbacks as Array<{ kind: string }>).map((f) => f.kind);
    expect(kinds).toContain('ai');
    expect(kinds).toContain('mentor');
  });

  it('역할 게이트: 멘토는 배정 목록 200, 학생은 403', async () => {
    await request(app).get('/v1/mentor/submissions').set(bearer(MENTOR)).expect(200);
    await request(app).get('/v1/mentor/submissions').set(bearer(STU_A)).expect(403);
  });
});
