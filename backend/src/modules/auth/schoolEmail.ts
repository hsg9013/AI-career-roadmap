import { randomUUID } from 'node:crypto';
import { getPool, withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { getMailer } from '../../lib/mailer/index.js';
import { HttpError } from '../../middlewares/errorHandler.js';
import { sha256, normalizeEmail } from './service.js';

// 003 US6(T043): 학교 이메일 검증 (FR-013). .ac.kr 만 허용, 비-.ac.kr 은 거부.
//   • verify: .ac.kr 검사 → 토큰 발급·메일 발송 → school_email_verification(pending).
//   • confirm: 토큰으로 verified 전환 + students.school_email_verified=1.

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function isAcKrEmail(email: string): boolean {
  return /^[^@\s]+@([^@\s]+\.)?ac\.kr$/.test(email.trim().toLowerCase());
}

export interface VerifyRequestResult {
  status: 'pending' | 'rejected';
  /** dev(비-production)에서만 노출 — 확인 링크 토큰(테스트·로컬 확인용). */
  devToken?: string;
}

export async function requestSchoolEmailVerification(
  userId: number,
  rawEmail: string,
): Promise<VerifyRequestResult> {
  const email = normalizeEmail(rawEmail);

  // 비-.ac.kr 은 거부 기록 후 422.
  if (!isAcKrEmail(email)) {
    await getPool().query(
      `INSERT INTO school_email_verification (user_id, email, status) VALUES (?, ?, 'rejected')`,
      [userId, email],
    );
    throw new HttpError(422, 'NOT_AC_KR', '학교 이메일은 .ac.kr 주소만 인증할 수 있습니다.');
  }

  const token = randomUUID();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await getPool().query(
    `INSERT INTO school_email_verification (user_id, email, status, token_hash, expires_at)
     VALUES (?, ?, 'pending', ?, ?)`,
    [userId, email, tokenHash, expiresAt],
  );

  // 확인 메일 발송(dev 콘솔 메일러). 링크는 프런트 확인 페이지로.
  const link = `${env.WEB_BASE_URL}/school-email/confirm?token=${token}`;
  try {
    await getMailer().send({
      to: email,
      subject: '[AI 진로 로드맵] 학교 이메일 인증',
      body: `아래 링크로 학교 이메일을 인증하세요(24시간 유효): ${link}`,
      templateCode: 'school-email-verify',
    });
  } catch (err) {
    logger.warn({ err, userId }, '[auth:school] verification mail failed (non-blocking)');
  }

  return {
    status: 'pending',
    devToken: env.NODE_ENV !== 'production' ? token : undefined,
  };
}

export interface ConfirmResult {
  status: 'verified';
  email: string;
}

export async function confirmSchoolEmail(token: string): Promise<ConfirmResult> {
  if (!token) throw new HttpError(400, 'MISSING_TOKEN', 'token required');
  const tokenHash = sha256(token);

  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, user_id, email, status, expires_at FROM school_email_verification
       WHERE token_hash = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [tokenHash],
    );
    const row = (rows as Array<{
      id: number; user_id: number; email: string; status: string; expires_at: Date | null;
    }>)[0];
    if (!row) throw new HttpError(404, 'TOKEN_NOT_FOUND', '유효하지 않은 인증 토큰입니다.');
    if (row.status === 'verified') return { status: 'verified' as const, email: row.email };
    if (row.status !== 'pending') throw new HttpError(409, 'NOT_PENDING', '인증 대기 상태가 아닙니다.');
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new HttpError(410, 'TOKEN_EXPIRED', '인증 토큰이 만료되었습니다. 다시 요청하세요.');
    }

    await conn.query(
      `UPDATE school_email_verification SET status = 'verified', verified_at = NOW() WHERE id = ?`,
      [row.id],
    );
    // 대학 소속 검증 표시(students 플래그). students 프로필이 없으면 무시(영향 0행).
    await conn.query('UPDATE students SET school_email_verified = 1 WHERE user_id = ?', [row.user_id]);

    return { status: 'verified' as const, email: row.email };
  });
}

export async function getSchoolEmailStatus(userId: number): Promise<{ status: 'none' | 'pending' | 'verified' | 'rejected'; email: string | null }> {
  const [rows] = await getPool().query(
    `SELECT email, status FROM school_email_verification
     WHERE user_id = ? ORDER BY FIELD(status,'verified','pending','rejected'), id DESC LIMIT 1`,
    [userId],
  );
  const row = (rows as Array<{ email: string; status: 'pending' | 'verified' | 'rejected' }>)[0];
  return row ? { status: row.status, email: row.email } : { status: 'none', email: null };
}
