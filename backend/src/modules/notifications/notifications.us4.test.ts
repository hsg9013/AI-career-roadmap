import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getPool, closePool } from '../../db/pool.js';
import { dispatchNotification } from '../../services/notifications.js';

// 003 US4: 3채널 발송 라우터 + 채널 설정 반영.
// dev 환경(무키): push 는 시뮬레이션 sent, email 은 console mailer sent.
// FR-008(3채널), FR-009(설정 반영: email off → skipped, in_app 은 항상 sent).

const RUN = Date.now();
const EMAIL = `vitest-noti-${RUN}@uni.ac.kr`;
const PASSWORD = 'vitest-strong-noti';

let app: Express;
let token: string;
let userId: number;
function auth() {
  return { Authorization: `Bearer ${token}` };
}

async function deliveriesFor(notificationId: number): Promise<Record<string, string>> {
  const [rows] = await getPool().query(
    'SELECT channel, status FROM notification_delivery WHERE notification_id = ?',
    [notificationId],
  );
  const out: Record<string, string> = {};
  for (const r of rows as Array<{ channel: string; status: string }>) out[r.channel] = r.status;
  return out;
}

beforeAll(async () => {
  app = createApp();
  await request(app)
    .post('/v1/auth/register/student')
    .send({ email: EMAIL, password: PASSWORD, university: 'NOTI대', major: '미디어', year_in_school: 2 })
    .expect(201);
  const login = await request(app).post('/v1/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
  token = login.body.access_token as string;
  const [rows] = await getPool().query('SELECT id FROM users WHERE email = ? LIMIT 1', [EMAIL]);
  userId = (rows as Array<{ id: number }>)[0]!.id;
});

afterAll(async () => {
  await getPool().query('DELETE FROM users WHERE email = ?', [EMAIL]);
  await closePool();
});

describe('US4 3채널 발송', () => {
  it('설정 전부 on → in_app·push·email 모두 sent', async () => {
    await request(app).put('/v1/notifications/settings').set(auth()).send({ push: true, email: true }).expect(200);
    const r = await dispatchNotification(userId, 'mission_deadline', '미션 마감 임박');
    expect(r.deliveries).toEqual({ in_app: 'sent', push: 'sent', email: 'sent' });

    const persisted = await deliveriesFor(r.notification_id);
    expect(persisted).toEqual({ in_app: 'sent', push: 'sent', email: 'sent' });
  });

  it('email off → email skipped, in_app·push 는 sent (FR-009)', async () => {
    await request(app).put('/v1/notifications/settings').set(auth()).send({ push: true, email: false }).expect(200);
    const r = await dispatchNotification(userId, 'mission_deadline', '미션 마감 임박 2');
    expect(r.deliveries.in_app).toBe('sent');
    expect(r.deliveries.push).toBe('sent');
    expect(r.deliveries.email).toBe('skipped');
  });

  it('push·email 모두 off 여도 in_app 은 항상 sent (FR-008)', async () => {
    await request(app).put('/v1/notifications/settings').set(auth()).send({ push: false, email: false }).expect(200);
    const r = await dispatchNotification(userId, 'progress_check', '진척 점검');
    expect(r.deliveries).toEqual({ in_app: 'sent', push: 'skipped', email: 'skipped' });
  });

  it('GET /v1/notifications 에 발송 알림이 보인다', async () => {
    const res = await request(app).get('/v1/notifications').set(auth()).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it('POST /v1/notifications/devices 디바이스 토큰 등록 201', async () => {
    const res = await request(app)
      .post('/v1/notifications/devices')
      .set(auth())
      .send({ platform: 'android', token: `tok-${RUN}` })
      .expect(201);
    expect(res.body.registered).toBe(true);
  });
});
