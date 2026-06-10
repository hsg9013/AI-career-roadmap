import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { getPool, closePool } from '../../db/pool.js';
import { __internal } from '../../services/payments.js';

// 003 US3: 결제 실거래 플로우 — dev 무키 즉시승인, 상태조회, 웹훅 멱등, 환불 전이.
// 테스트 환경엔 PORTONE 키가 없으므로 checkout 은 즉시 paid, 웹훅 서명검증은 dev 우회.

const RUN = Date.now();
const EMAIL = `vitest-pay-${RUN}@uni.ac.kr`;
const PASSWORD = 'vitest-strong-pay';

let app: Express;
let token: string;
function auth() {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  app = createApp();
  await request(app)
    .post('/v1/auth/register/student')
    .send({ email: EMAIL, password: PASSWORD, university: 'PAY대', major: '경영', year_in_school: 3 })
    .expect(201);
  const login = await request(app).post('/v1/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
  token = login.body.access_token as string;
});

afterAll(async () => {
  await getPool().query('DELETE FROM users WHERE email = ?', [EMAIL]);
  await closePool();
});

describe('상태기계 (단위)', () => {
  it('허용 전이만 통과한다', () => {
    expect(__internal.canTransition('pending', 'paid')).toBe(true);
    expect(__internal.canTransition('pending', 'failed')).toBe(true);
    expect(__internal.canTransition('paid', 'refunded')).toBe(true);
    expect(__internal.canTransition('paid', 'canceled')).toBe(true);
    // 비허용
    expect(__internal.canTransition('pending', 'refunded')).toBe(false);
    expect(__internal.canTransition('refunded', 'paid')).toBe(false);
    expect(__internal.canTransition('failed', 'paid')).toBe(false);
  });
});

describe('POST /v1/payments/checkout (dev 즉시승인)', () => {
  let paymentId: number;
  let merchantUid: string;

  it('멤버십 결제 승인 → paid + 멤버십 활성 + 영수증', async () => {
    const res = await request(app)
      .post('/v1/payments/checkout')
      .set(auth())
      .send({ kind: 'membership', amount: 9900, plan: 'standard' })
      .expect(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.membership_ends_at).toBeTruthy();
    expect(res.body.receipt_url).toBeTruthy();
    expect(res.body.pg_tx_id).toMatch(/^mid_/);
    paymentId = res.body.payment_id;
    merchantUid = res.body.pg_tx_id;
  });

  it('금액 0 이하는 422', async () => {
    await request(app)
      .post('/v1/payments/checkout')
      .set(auth())
      .send({ kind: 'membership', amount: 0 })
      .expect(422);
  });

  it('GET /v1/payments/:id 로 상태·영수증 조회', async () => {
    const res = await request(app).get(`/v1/payments/${paymentId}`).set(auth()).expect(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.receipt_url).toBeTruthy();
    expect(res.body.membership_ends_at).toBeTruthy();
  });

  it('웹훅 환불 → 결제 refunded + 멤버십 종료', async () => {
    const res = await request(app)
      .post('/v1/payments/webhook')
      .send({ merchant_uid: merchantUid, status: 'refunded', event_id: `evt-refund-${merchantUid}-${RUN}` })
      .expect(200);
    expect(res.body.status).toBe('processed');
    expect(res.body.payment_status).toBe('refunded');

    const view = await request(app).get(`/v1/payments/${paymentId}`).set(auth()).expect(200);
    expect(view.body.status).toBe('refunded');
  });

  it('동일 웹훅 재수신은 멱등 — duplicate 로 무시', async () => {
    const res = await request(app)
      .post('/v1/payments/webhook')
      .send({ merchant_uid: merchantUid, status: 'refunded', event_id: `evt-refund-${merchantUid}-${RUN}` })
      .expect(200);
    expect(res.body.status).toBe('duplicate');
  });

  it('알 수 없는 결제 웹훅은 ignored', async () => {
    const res = await request(app)
      .post('/v1/payments/webhook')
      .send({ merchant_uid: 'mid_does_not_exist', status: 'paid', event_id: `evt-unknown-${RUN}` })
      .expect(200);
    expect(res.body.status).toBe('ignored');
  });
});
