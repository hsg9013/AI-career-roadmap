import { createHash } from 'node:crypto';
import { withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { HttpError } from '../../middlewares/errorHandler.js';
import type { Role } from '../../lib/jwt.js';
import { issueSession, normalizeEmail, type LoginResult } from './service.js';

// 003 US6(T042): 네이버 소셜 로그인 (FR-012, FR-020 점진 활성화).
//   • 키(OAUTH_NAVER_*) 설정 시: code→token→profile 실 호출.
//   • dev 무키: code 로 결정적 합성 프로필(동일 code→동일 계정) — 키 없이도 흐름 검증.
// 연결 규칙: provider_uid 기존 연결 → 그 계정 / 없으면 이메일 일치 계정에 연결 / 둘 다 없으면 신규 생성.

export function hasNaverCredentials(): boolean {
  return env.OAUTH_NAVER_CLIENT_ID.length > 0 && env.OAUTH_NAVER_CLIENT_SECRET.length > 0;
}

export interface NaverProfile {
  providerUid: string;
  email: string;
}

// 실연동: 네이버 OAuth 토큰 교환 + 프로필 조회. 실패 시 HttpError.
async function fetchNaverProfileReal(code: string, state: string): Promise<NaverProfile> {
  const tokenUrl =
    `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code` +
    `&client_id=${encodeURIComponent(env.OAUTH_NAVER_CLIENT_ID)}` +
    `&client_secret=${encodeURIComponent(env.OAUTH_NAVER_CLIENT_SECRET)}` +
    `&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  const tokenRes = await fetch(tokenUrl);
  if (!tokenRes.ok) throw new HttpError(502, 'NAVER_TOKEN_FAILED', '네이버 토큰 교환 실패');
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new HttpError(502, 'NAVER_TOKEN_FAILED', '네이버 토큰 없음');

  const meRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!meRes.ok) throw new HttpError(502, 'NAVER_PROFILE_FAILED', '네이버 프로필 조회 실패');
  const me = (await meRes.json()) as { response?: { id?: string; email?: string } };
  const id = me.response?.id;
  if (!id) throw new HttpError(502, 'NAVER_PROFILE_FAILED', '네이버 식별자 없음');
  const email = me.response?.email ?? `${id}@naver-user.local`;
  return { providerUid: id, email: normalizeEmail(email) };
}

// dev 합성: code 해시 기반 결정적 프로필. 동일 code → 동일 계정으로 매핑(테스트 가능).
function devNaverProfile(code: string): NaverProfile {
  const uid = `naver-dev-${createHash('sha256').update(code).digest('hex').slice(0, 16)}`;
  return { providerUid: uid, email: `${uid}@naver-dev.local` };
}

async function resolveProfile(code: string, state: string): Promise<NaverProfile> {
  if (hasNaverCredentials()) return fetchNaverProfileReal(code, state);
  logger.warn('[auth:naver] no credentials — dev synthetic profile');
  return devNaverProfile(code);
}

export interface SocialLoginResult extends LoginResult {
  created: boolean;
}

export async function socialLoginNaver(code: string, state = ''): Promise<SocialLoginResult> {
  if (!code) throw new HttpError(400, 'MISSING_CODE', 'authorization code required');
  const profile = await resolveProfile(code, state);

  const { userId, role, created } = await withTransaction(async (conn) => {
    // 1) provider_uid 로 기존 연결 조회.
    const [linked] = await conn.query(
      `SELECT u.id, u.role FROM social_identity si
       JOIN users u ON u.id = si.user_id
       WHERE si.provider = 'naver' AND si.provider_uid = ? AND u.deleted_at IS NULL LIMIT 1`,
      [profile.providerUid],
    );
    const linkedUser = (linked as Array<{ id: number; role: Role }>)[0];
    if (linkedUser) return { userId: linkedUser.id, role: linkedUser.role, created: false };

    // 2) 이메일 일치 계정에 연결.
    const [byEmail] = await conn.query(
      'SELECT id, role FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [profile.email],
    );
    const existing = (byEmail as Array<{ id: number; role: Role }>)[0];
    if (existing) {
      await conn.query(
        `INSERT INTO social_identity (user_id, provider, provider_uid) VALUES (?, 'naver', ?)`,
        [existing.id, profile.providerUid],
      );
      return { userId: existing.id, role: existing.role, created: false };
    }

    // 3) 신규 계정 생성(소셜 검증 완료 → email_verified=1, 비밀번호 없음).
    const [ins] = await conn.query(
      `INSERT INTO users (email, password_hash, role, email_verified, is_active)
       VALUES (?, NULL, 'student', 1, 1)`,
      [profile.email],
    );
    const newId = (ins as { insertId: number }).insertId;
    await conn.query(
      `INSERT INTO social_identity (user_id, provider, provider_uid) VALUES (?, 'naver', ?)`,
      [newId, profile.providerUid],
    );
    return { userId: newId, role: 'student' as Role, created: true };
  });

  const session = await issueSession({ id: userId, role });
  return { ...session, created };
}
