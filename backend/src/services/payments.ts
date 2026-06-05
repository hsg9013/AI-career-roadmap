import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { track } from '../lib/analytics.js';

// T054/T055: 결제(멤버십) + 멘토 정산 (FR-016~017, R-5)
// PortOne 연동은 dev 단계 stub — amount>0 이면 승인, 아니면 실패(402). 운영 시 실제 PG 호출로 교체.

export type PaymentKind = 'membership' | 'one_time';
const MEMBERSHIP_DAYS = 30;

interface PortOneResult {
  approved: boolean;
  pgTxId: string | null;
}

function portOneConfirm(amount: number): PortOneResult {
  // 실제 구현은 @portone/server-sdk 결제 검증. dev stub.
  if (amount <= 0) return { approved: false, pgTxId: null };
  return { approved: true, pgTxId: `portone-dev-${amount}-${Math.floor(amount * 7 + 13)}` };
}

async function resolveStudentId(conn: PoolConnection, userId: number): Promise<number> {
  const [rows] = await conn.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  const row = (rows as Array<{ id: number }>)[0];
  if (!row) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile required');
  return row.id;
}

export interface CheckoutResult {
  payment_id: number;
  status: 'paid' | 'failed';
  membership_ends_at: string | null;
}

export async function checkout(
  userId: number,
  kind: PaymentKind,
  amount: number,
  plan: string,
): Promise<CheckoutResult> {
  return withTransaction(async (conn) => {
    const studentId = await resolveStudentId(conn, userId);
    const pg = portOneConfirm(amount);
    const status = pg.approved ? 'paid' : 'failed';

    const [ins] = await conn.query(
      `INSERT INTO payments (payer_user_id, kind, amount, pg_tx_id, status) VALUES (?, ?, ?, ?, ?)`,
      [userId, kind, amount, pg.pgTxId, status],
    );
    const paymentId = (ins as { insertId: number }).insertId;

    if (!pg.approved) {
      throw new HttpError(402, 'PAYMENT_FAILED', '결제가 승인되지 않았습니다. 결제 수단을 확인하세요.');
    }

    let endsAt: string | null = null;
    if (kind === 'membership') {
      const ends = new Date();
      ends.setDate(ends.getDate() + MEMBERSHIP_DAYS);
      await conn.query(
        `INSERT INTO memberships (student_id, plan, ends_at, payment_id) VALUES (?, ?, ?, ?)`,
        [studentId, plan, ends, paymentId],
      );
      endsAt = ends.toISOString();
    }

    await track(userId, 'payment_converted', { kind, amount, plan });
    return { payment_id: paymentId, status: 'paid', membership_ends_at: endsAt };
  });
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
      const amount = mt.mentor_track === 'flat'
        ? count * FLAT_PER_FEEDBACK
        : Math.round(count * FLAT_PER_FEEDBACK * commissionRate);
      await conn.query(
        `INSERT INTO mentor_payouts (mentor_id, period, amount, status) VALUES (?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
        [mt.id, period, amount],
      );
      mentorsPaid += 1;
      total += amount;
    }
    return { mentors: mentorsPaid, total };
  });
}
