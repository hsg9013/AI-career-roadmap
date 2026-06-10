import { createHash } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { track } from '../lib/analytics.js';
import { logger } from '../lib/logger.js';
import { raiseAlert } from '../lib/ops.js';
import {
  hasPortOneCredentials,
  createSession,
  newMerchantUid,
  verifyWebhookSignature,
  devReceiptUrl,
} from './payments/portone.js';

// 003 US3: 결제(멤버십·단건) 실거래 + 정산 + 웹훅 멱등 (FR-006/FR-007).
//   • checkout: pending 결제 생성 → 실연동은 PortOne 세션 반환(웹훅이 확정), dev 무키는 즉시 승인.
//   • webhook: 서명 검증 + pg_event_id 멱등 + 상태기계 전이 + 멤버십 활성/해지.
//   • 상태기계: pending→paid→(canceled|refunded), pending→failed.

export type PaymentKind = 'membership' | 'one_time';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';
export type WebhookEventType = 'paid' | 'failed' | 'canceled' | 'refunded';

const MEMBERSHIP_DAYS = 30;

// 허용 전이 — 그 외는 무시(멱등·안전).
const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['paid', 'failed'],
  paid: ['canceled', 'refunded'],
  failed: [],
  canceled: [],
  refunded: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

const EVENT_TO_STATUS: Record<WebhookEventType, PaymentStatus> = {
  paid: 'paid',
  failed: 'failed',
  canceled: 'canceled',
  refunded: 'refunded',
};

async function resolveStudentId(conn: PoolConnection, userId: number): Promise<number> {
  const [rows] = await conn.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  const row = (rows as Array<{ id: number }>)[0];
  if (!row) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile required');
  return row.id;
}

// 멤버십 활성화(결제 paid 시). 30일 연장. payment_id 연결.
async function activateMembership(
  conn: PoolConnection,
  studentId: number,
  plan: string,
  paymentId: number,
): Promise<string> {
  const ends = new Date();
  ends.setDate(ends.getDate() + MEMBERSHIP_DAYS);
  await conn.query(
    `INSERT INTO memberships (student_id, plan, ends_at, payment_id) VALUES (?, ?, ?, ?)`,
    [studentId, plan, ends, paymentId],
  );
  return ends.toISOString();
}

// 멤버십 해지(취소·환불 시). 해당 결제로 활성화된 멤버십 즉시 종료 + 자동갱신 off.
async function deactivateMembership(conn: PoolConnection, paymentId: number): Promise<void> {
  await conn.query(
    `UPDATE memberships SET ends_at = CURRENT_TIMESTAMP, auto_renew = 0 WHERE payment_id = ?`,
    [paymentId],
  );
}

export interface CheckoutResult {
  payment_id: number;
  status: PaymentStatus;
  membership_ends_at: string | null;
  pg_tx_id: string;
  receipt_url: string | null;
  /** 실연동 시 결제창 URL(있으면). dev/즉시승인은 null. */
  redirect_url: string | null;
}

/**
 * 결제 시작. pending 결제 행을 만들고:
 *   • dev(무키): 즉시 승인 → paid + 멤버십 활성 + 영수증(합성).
 *   • 실연동: pending 유지 + PortOne 세션 반환(웹훅이 확정).
 */
export async function checkout(
  userId: number,
  kind: PaymentKind,
  amount: number,
  plan: string,
): Promise<CheckoutResult> {
  if (amount <= 0) {
    throw new HttpError(422, 'INVALID_AMOUNT', '결제 금액이 올바르지 않습니다.');
  }

  const merchantUid = newMerchantUid();
  const session = createSession(merchantUid);

  return withTransaction(async (conn) => {
    const studentId = await resolveStudentId(conn, userId);

    const [ins] = await conn.query(
      `INSERT INTO payments (payer_user_id, kind, pg_provider, amount, pg_tx_id, status)
       VALUES (?, ?, 'portone', ?, ?, 'pending')`,
      [userId, kind, amount, merchantUid],
    );
    const paymentId = (ins as { insertId: number }).insertId;

    // 실연동: 결제창으로 진행 → 웹훅 확정. pending 반환.
    if (!session.devAutoApprove) {
      return {
        payment_id: paymentId,
        status: 'pending' as const,
        membership_ends_at: null,
        pg_tx_id: merchantUid,
        receipt_url: null,
        redirect_url: session.redirectUrl,
      };
    }

    // dev 즉시 승인 경로.
    const receiptUrl = devReceiptUrl(merchantUid);
    await conn.query(
      `UPDATE payments SET status = 'paid', receipt_url = ? WHERE id = ?`,
      [receiptUrl, paymentId],
    );
    let endsAt: string | null = null;
    if (kind === 'membership') {
      endsAt = await activateMembership(conn, studentId, plan, paymentId);
    }
    await track(userId, 'payment_converted', { kind, amount, plan });

    return {
      payment_id: paymentId,
      status: 'paid' as const,
      membership_ends_at: endsAt,
      pg_tx_id: merchantUid,
      receipt_url: receiptUrl,
      redirect_url: null,
    };
  });
}

export interface WebhookInput {
  /** PortOne 이벤트 고유 ID(멱등 키). 없으면 merchant_uid+status 로 합성. */
  eventId?: string;
  merchantUid: string;
  eventType: WebhookEventType;
  receiptUrl?: string | null;
}

export interface WebhookResult {
  status: 'processed' | 'duplicate' | 'ignored';
  payment_status?: PaymentStatus;
}

/**
 * PortOne 웹훅 처리. 서명 검증 → pg_event_id 멱등 → 상태기계 전이 → 멤버십 반영.
 * rawBody/signature 는 라우터가 그대로 전달(HMAC 검증용).
 */
export async function handleWebhook(
  rawBody: Buffer | string,
  signature: string | undefined,
  input: WebhookInput,
): Promise<WebhookResult> {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new HttpError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
  }

  const eventId = input.eventId ?? `${input.merchantUid}:${input.eventType}`;
  const payloadHash = createHash('sha256')
    .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    .digest('hex');

  return withTransaction(async (conn) => {
    // 멱등: 이미 처리한 이벤트면 중복 무시.
    try {
      await conn.query(
        `INSERT INTO payment_webhook_event (pg_event_id, payload_hash) VALUES (?, ?)`,
        [eventId, payloadHash],
      );
    } catch (err) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        logger.info({ eventId }, '[payments] duplicate webhook ignored');
        return { status: 'duplicate' };
      }
      throw err;
    }

    const [rows] = await conn.query(
      `SELECT id, payer_user_id, kind, status FROM payments WHERE pg_tx_id = ? LIMIT 1 FOR UPDATE`,
      [input.merchantUid],
    );
    const pay = (rows as Array<{ id: number; payer_user_id: number; kind: PaymentKind; status: PaymentStatus }>)[0];
    if (!pay) {
      logger.warn({ merchantUid: input.merchantUid }, '[payments] webhook for unknown payment — ignored');
      return { status: 'ignored' };
    }

    const target = EVENT_TO_STATUS[input.eventType];
    if (!canTransition(pay.status, target)) {
      logger.warn({ from: pay.status, to: target, paymentId: pay.id }, '[payments] invalid transition — ignored');
      return { status: 'ignored', payment_status: pay.status };
    }

    await conn.query(
      `UPDATE payments SET status = ?, receipt_url = COALESCE(?, receipt_url) WHERE id = ?`,
      [target, input.receiptUrl ?? null, pay.id],
    );

    if (target === 'paid' && pay.kind === 'membership') {
      const studentId = await resolveStudentId(conn, pay.payer_user_id);
      await activateMembership(conn, studentId, 'standard', pay.id);
      await track(pay.payer_user_id, 'payment_converted', { kind: pay.kind, via: 'webhook' });
    } else if (target === 'canceled' || target === 'refunded') {
      await deactivateMembership(conn, pay.id);
      await track(pay.payer_user_id, 'membership_canceled', { kind: pay.kind, reason: target });
    }

    return { status: 'processed', payment_status: target };
  });
}

export interface PaymentView {
  id: number;
  kind: PaymentKind;
  amount: number;
  status: PaymentStatus;
  pg_tx_id: string | null;
  receipt_url: string | null;
  created_at: string;
  membership_ends_at: string | null;
}

/** 결제 상태·영수증 조회(본인 소유만). */
export async function getPayment(userId: number, paymentId: number): Promise<PaymentView> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT p.id, p.kind, p.amount, p.status, p.pg_tx_id, p.receipt_url,
            DATE_FORMAT(p.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
            DATE_FORMAT(m.ends_at, '%Y-%m-%dT%H:%i:%sZ') AS membership_ends_at
     FROM payments p
     LEFT JOIN memberships m ON m.payment_id = p.id
     WHERE p.id = ? AND p.payer_user_id = ? LIMIT 1`,
    [paymentId, userId],
  );
  const r = (rows as Array<PaymentView>)[0];
  if (!r) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
  return r;
}

export async function listMentorPayouts(userId: number): Promise<unknown[]> {
  const pool = getPool();
  const [m] = await pool.query('SELECT id FROM mentors WHERE user_id = ? LIMIT 1', [userId]);
  const mentor = (m as Array<{ id: number }>)[0];
  if (!mentor) throw new HttpError(403, 'NOT_MENTOR', 'Mentor record required');
  const [rows] = await pool.query(
    `SELECT period, amount, status, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
     FROM mentor_payouts WHERE mentor_id = ? ORDER BY period DESC`,
    [mentor.id],
  );
  return rows as unknown[];
}

// 월 정산 산출(정액/수수료) — payout-monthly 워커 또는 관리자가 호출. 멱등(UNIQUE period).
const FLAT_PER_FEEDBACK = 20000; // 정액 트랙: 피드백 건당
export async function computeMonthlyPayouts(period: string): Promise<{ mentors: number; total: number }> {
  return withTransaction(async (conn) => {
    const [rates] = await conn.query("SELECT rate FROM commission_rates WHERE scope = 'mentor_feedback' LIMIT 1");
    const commissionRate = Number((rates as Array<{ rate: number | string }>)[0]?.rate ?? 0.2);

    const [mentorRows] = await conn.query('SELECT id, user_id, mentor_track FROM mentors WHERE verified = 1');
    let mentorsPaid = 0;
    let total = 0;
    for (const mt of mentorRows as Array<{ id: number; user_id: number; mentor_track: 'flat' | 'commission' }>) {
      const [cntRows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM feedbacks WHERE kind = 'mentor' AND mentor_id = ?
         AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
        [mt.user_id, period],
      );
      const count = Number((cntRows as Array<{ cnt: number | string }>)[0]?.cnt ?? 0);
      if (count === 0) continue;
      const basis = mt.mentor_track === 'flat' ? 'fixed' : 'commission';
      const amount = mt.mentor_track === 'flat'
        ? count * FLAT_PER_FEEDBACK
        : Math.round(count * FLAT_PER_FEEDBACK * commissionRate);
      await conn.query(
        `INSERT INTO mentor_payouts (mentor_id, period, amount, status) VALUES (?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
        [mt.id, period, amount],
      );
      // T026: 정산 원장 적립(멱등 — payee+source_ref+basis UNIQUE). source_ref = 정산기간.
      await conn.query(
        `INSERT INTO settlement (payee_user_id, basis, source_ref, amount, status)
         VALUES (?, ?, ?, ?, 'accrued')
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
        [mt.user_id, basis, `mentor_feedback:${period}`, amount],
      );
      mentorsPaid += 1;
      total += amount;
    }
    return { mentors: mentorsPaid, total };
  });
}

// 003 US3(T027): 결제·멤버십 정합성 점검.
// paid 인 멤버십 결제인데 활성 멤버십이 없으면 자동 정정(멤버십 생성). 정정 불가는 운영 경보.
export async function reconcilePayments(): Promise<{ checked: number; corrected: number; flagged: number }> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT p.id, p.payer_user_id
     FROM payments p
     LEFT JOIN memberships m ON m.payment_id = p.id
     WHERE p.kind = 'membership' AND p.status = 'paid' AND m.id IS NULL`,
  );
  const mismatches = rows as Array<{ id: number; payer_user_id: number }>;
  let corrected = 0;
  let flagged = 0;

  for (const row of mismatches) {
    try {
      await withTransaction(async (conn) => {
        const studentId = await resolveStudentId(conn, row.payer_user_id);
        // 경합 방지: 트랜잭션 내 재확인.
        const [chk] = await conn.query('SELECT id FROM memberships WHERE payment_id = ? LIMIT 1', [row.id]);
        if ((chk as unknown[]).length > 0) return;
        await activateMembership(conn, studentId, 'standard', row.id);
      });
      corrected += 1;
      logger.warn({ paymentId: row.id }, '[payments] reconcile: membership auto-activated');
    } catch (err) {
      // 학생 프로필 없음 등 자동 정정 불가 → 운영 검수로 보류.
      flagged += 1;
      logger.error({ err, paymentId: row.id }, '[payments] reconcile: cannot auto-correct — flagging');
    }
  }

  if (flagged > 0) {
    await raiseAlert('payments', 'critical', `${flagged}건 결제-멤버십 불일치를 자동 정정하지 못해 운영 검수 필요`);
  }
  return { checked: mismatches.length, corrected, flagged };
}

export const __internal = { canTransition, TRANSITIONS, EVENT_TO_STATUS, hasPortOneCredentials } as const;
