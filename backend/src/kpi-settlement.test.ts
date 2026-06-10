import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.js';
import { getPool, closePool } from './db/pool.js';
import { donatePath } from './services/alumni.js';

// 003 캔버스 누락 보강 검증:
//   #1 성공지표(KPI) 이벤트 발화 — signup·revisit 가 analytics_events 에 기록.
//   #2 선배 정산 — donatePath 가 settlement 원장(basis=fixed)에 적립.

const RUN = Date.now();
const EMAIL = `vitest-kpi-${RUN}@uni.ac.kr`;
const PASSWORD = 'vitest-strong-kpi';

let app: Express;
let userId: number;

async function countEvents(uid: number, event: string): Promise<number> {
  const [rows] = await getPool().query(
    'SELECT COUNT(*) AS c FROM analytics_events WHERE user_id = ? AND event = ?',
    [uid, event],
  );
  return Number((rows as Array<{ c: number | string }>)[0]!.c);
}

beforeAll(async () => {
  app = createApp();
  await request(app)
    .post('/v1/auth/register/student')
    .send({ email: EMAIL, password: PASSWORD, university: 'KPI대', major: 'CS', year_in_school: 3 })
    .expect(201);
  const [rows] = await getPool().query('SELECT id FROM users WHERE email = ? LIMIT 1', [EMAIL]);
  userId = (rows as Array<{ id: number }>)[0]!.id;
});

afterAll(async () => {
  await getPool().query('DELETE FROM users WHERE email = ?', [EMAIL]);
  await closePool();
});

describe('#1 KPI 이벤트 발화', () => {
  it('회원가입 시 signup 이벤트 기록', async () => {
    expect(await countEvents(userId, 'signup')).toBeGreaterThanOrEqual(1);
  });

  it('로그인 시 revisit 이벤트 기록', async () => {
    await request(app).post('/v1/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    expect(await countEvents(userId, 'revisit')).toBeGreaterThanOrEqual(1);
  });
});

describe('#2 선배 정산 settlement 적립', () => {
  it('donatePath 가 settlement(basis=fixed)에 적립한다', async () => {
    const res = await donatePath(userId, {
      industry_code: 'IT',
      job_role_code: 'backend',
      major_field: '컴퓨터공학',
      year_in_school: 4,
      success_year: 2025,
      activities: [{ period: 'Y3', activity_type: 'project', detail: '백엔드 사이드 프로젝트', skill_tag: 'node' }],
    });
    const [rows] = await getPool().query(
      `SELECT basis, amount, status FROM settlement WHERE payee_user_id = ? AND source_ref = ? LIMIT 1`,
      [userId, `alumni_donation:${res.alumni_path_id}`],
    );
    const row = (rows as Array<{ basis: string; amount: number; status: string }>)[0];
    expect(row).toBeTruthy();
    expect(row.basis).toBe('fixed');
    expect(row.status).toBe('accrued');
    expect(row.amount).toBeGreaterThan(0);
  });
});
