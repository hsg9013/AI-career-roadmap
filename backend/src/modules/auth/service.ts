import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  buildScopes,
  type Role,
  type AccessTokenClaims,
} from '../../lib/jwt.js';
import { HttpError } from '../../middlewares/errorHandler.js';
import { track } from '../../lib/analytics.js';

// T046: 인증 본 구현 — bcrypt(12), 5회 실패 잠금(Redis), refresh 회전(family).

const BCRYPT_ROUNDS = 12;
const LOCK_MAX_FAILS = 5;
const LOCK_WINDOW_SECONDS = 15 * 60;

let redis: Redis | null = null;
function getRedis(): Redis {
  if (redis) return redis;
  redis = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 });
  return redis;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface RegisterStudentInput {
  email: string;
  password: string;
  university: string;
  major: string;
  yearInSchool: number;
  // 001: 가입 동의란 — 대학 취업지원 정보 제공 범위 + 기업 인재검색 노출 동의.
  universityConsentScope?: 'none' | 'aggregate_only' | 'individual';
  matchConsent?: boolean;
}

export interface RegisterResult {
  userId: number;
  emailVerificationSent: boolean;
}

export async function registerStudent(input: RegisterStudentInput): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return withTransaction(async (conn) => {
    const [existingRows] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if ((existingRows as Array<{ id: number }>).length > 0) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'Email already registered');
    }

    const [insertUser] = await conn.query(
      `INSERT INTO users (email, password_hash, role, email_verified, is_active)
       VALUES (?, ?, 'student', 0, 1)`,
      [email, passwordHash],
    );
    const userId = (insertUser as { insertId: number }).insertId;

    const scope = input.universityConsentScope ?? 'aggregate_only';
    const [insertStudent] = await conn.query(
      `INSERT INTO students (user_id, university, major, year_in_school, university_consent_scope)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, input.university, input.major, input.yearInSchool, scope],
    );

    // 001: 기업 인재검색 노출 동의 시 매칭 동의(opted_in) 기록.
    if (input.matchConsent) {
      const studentId = (insertStudent as { insertId: number }).insertId;
      await conn.query(
        `INSERT INTO job_match_consents (student_id, opted_in) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE opted_in = 1`,
        [studentId],
      );
    }

    // 메일러는 T060+에서 연결. 현재는 플래그만 false.
    await track(userId, 'signup', { role: 'student', method: 'email' });
    return { userId, emailVerificationSent: false };
  });
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role: Role;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string | null;
  role: Role;
  is_active: number;
}

async function fetchUserByEmail(conn: PoolConnection, email: string): Promise<UserRow | null> {
  const [rows] = await conn.query(
    `SELECT id, email, password_hash, role, is_active
     FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );
  const arr = rows as UserRow[];
  return arr[0] ?? null;
}

async function lockoutKey(email: string): Promise<string> {
  return `auth:lock:${email}`;
}

async function checkLockout(email: string): Promise<void> {
  const r = getRedis();
  const key = await lockoutKey(email);
  const count = Number((await r.get(key)) ?? 0);
  if (count >= LOCK_MAX_FAILS) {
    const ttl = await r.ttl(key);
    throw new HttpError(423, 'ACCOUNT_LOCKED', `Too many failed attempts; retry in ${ttl}s`);
  }
}

async function recordFailedLogin(email: string): Promise<void> {
  const r = getRedis();
  const key = await lockoutKey(email);
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, LOCK_WINDOW_SECONDS);
}

async function clearLockout(email: string): Promise<void> {
  const r = getRedis();
  await r.del(await lockoutKey(email));
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  await checkLockout(email);

  const pool = getPool();
  const conn = await pool.getConnection();
  let user: UserRow | null;
  try {
    user = await fetchUserByEmail(conn, email);
  } finally {
    conn.release();
  }

  if (!user || !user.password_hash || user.is_active !== 1) {
    await recordFailedLogin(email);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const ok = await bcrypt.compare(input.password, user.password_hash);
  if (!ok) {
    await recordFailedLogin(email);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await clearLockout(email);
  // 재방문 지표(SC-009) — 로그인 성공 1건당 1회.
  await track(user.id, 'revisit', { method: 'password' });
  return issueSession({ id: user.id, role: user.role });
}

// 세션 발급(access+refresh 회전 family) — 일반 로그인·소셜 로그인 공통 사용.
export async function issueSession(user: { id: number; role: Role }): Promise<LoginResult> {
  // 학생/멘토 이외 역할은 권한 매트릭스 의존 → buildScopes 가 안전한 기본을 돌려준다.
  const scopes = buildScopes({ role: user.role });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, scopes });

  const familyId = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, family: familyId });

  await persistRefreshToken({ userId: user.id, familyId, token: refreshToken });
  await getPool().query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  return {
    accessToken,
    refreshToken,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    role: user.role,
  };
}

interface PersistRefreshInput {
  userId: number;
  familyId: string;
  token: string;
}

async function persistRefreshToken(input: PersistRefreshInput): Promise<void> {
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES (?, ?, ?, ?)`,
    [input.userId, sha256(input.token), input.familyId, expiresAt],
  );
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function rotateRefresh(rawRefresh: string): Promise<RefreshResult> {
  let claims: ReturnType<typeof verifyRefreshToken>;
  try {
    claims = verifyRefreshToken(rawRefresh);
  } catch {
    throw new HttpError(401, 'INVALID_TOKEN', 'Invalid refresh token');
  }

  const tokenHash = sha256(rawRefresh);

  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, user_id, family_id, expires_at, revoked_at
       FROM refresh_tokens
       WHERE user_id = ? AND token_hash = ?
       LIMIT 1`,
      [claims.sub, tokenHash],
    );
    const row = (rows as Array<{
      id: number;
      user_id: number;
      family_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>)[0];

    if (!row) {
      // 토큰 자체가 DB에 없음 — 위조 또는 이미 정리된 family. 안전을 위해 family 무효화.
      await conn.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL',
        [claims.family],
      );
      throw new HttpError(401, 'REFRESH_REUSED', 'Refresh token not recognized; family revoked');
    }

    if (row.revoked_at !== null) {
      // 이미 revoked 된 토큰 재사용 → 도난 의심, family 전체 revoke
      await conn.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL',
        [row.family_id],
      );
      throw new HttpError(401, 'REFRESH_REUSED', 'Refresh token reuse detected; family revoked');
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new HttpError(401, 'REFRESH_EXPIRED', 'Refresh token expired');
    }

    // 사용자 정보 재조회 — role/권한 변경 반영
    const [userRows] = await conn.query(
      'SELECT id, role, is_active FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [row.user_id],
    );
    const user = (userRows as Array<{ id: number; role: Role; is_active: number }>)[0];
    if (!user || user.is_active !== 1) {
      throw new HttpError(401, 'USER_INACTIVE', 'User account is not active');
    }

    // 현재 토큰 revoke + 새 토큰 발급(같은 family 유지)
    await conn.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [row.id]);

    const scopes = buildScopes({ role: user.role });
    const newAccess = signAccessToken({ sub: user.id, role: user.role, scopes });
    const newRefresh = signRefreshToken({ sub: user.id, family: row.family_id });
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await conn.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
       VALUES (?, ?, ?, ?)`,
      [user.id, sha256(newRefresh), row.family_id, expiresAt],
    );

    return {
      accessToken: newAccess,
      refreshToken: newRefresh,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    };
  });
}

export async function logout(rawRefresh: string | null): Promise<void> {
  if (!rawRefresh) return;
  try {
    const claims = verifyRefreshToken(rawRefresh);
    await getPool().query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = ? AND token_hash = ? AND revoked_at IS NULL`,
      [claims.sub, sha256(rawRefresh)],
    );
  } catch {
    // 토큰이 손상되어 있어도 logout은 항상 성공으로 처리
  }
}

// 테스트 보조: lockout 카운트/세션 정리용. 실제 라우터에서는 노출하지 않음.
export const __internal = {
  sha256,
  normalizeEmail,
  clearLockout,
  getRedis,
  LOCK_MAX_FAILS,
} as const;

export type { AccessTokenClaims };
