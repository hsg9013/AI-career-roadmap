import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

// T021: 액세스/refresh JWT + scope 클레임 빌더 (R-5/R-7)

export type Role = 'student' | 'mentor' | 'university' | 'enterprise' | 'admin';

export type Scope =
  | 'university:aggregate'
  | 'university:individual'
  | 'mentor:read'
  | 'mentor:write'
  | 'admin:moderation'
  | 'admin:billing'
  | string;

export interface AccessTokenClaims {
  sub: number;             // user_id
  role: Role;
  scopes: Scope[];         // 공백 구분 문자열로 직렬화되지 않고 배열 그대로 저장
  iat?: number;
  exp?: number;
}

export interface RefreshTokenClaims {
  sub: number;
  family: string;          // refresh 회전 가족 식별자
  jti?: string;            // 토큰 고유 식별자 — 같은 초에 회전해도 토큰(=hash)이 항상 distinct하도록
  iat?: number;
  exp?: number;
}

function asSignOptions(opts: Partial<SignOptions>): SignOptions {
  // 타입 호환: jsonwebtoken v9의 SignOptions는 expiresIn에 string|number 모두 허용
  return opts as SignOptions;
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp'>): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, asSignOptions({
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    algorithm: 'HS256',
  }));
}

export function signRefreshToken(claims: Omit<RefreshTokenClaims, 'iat' | 'exp' | 'jti'>): string {
  // jti(randomUUID)를 부여해 토큰 문자열·sha256 해시가 항상 유일하도록 한다.
  // 그렇지 않으면 동일 초에 회전(rotateRefresh) 시 sub+family+iat 가 같아 바이트 동일 토큰이
  // 재발급되고, DB에 같은 token_hash 가 (revoked + active) 중복되어 다음 회전이 재사용으로 오탐된다.
  return jwt.sign({ ...claims, jti: randomUUID() }, env.JWT_REFRESH_SECRET, asSignOptions({
    expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
    algorithm: 'HS256',
  }));
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as unknown as AccessTokenClaims;
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as unknown as RefreshTokenClaims;
}

// R-7: 역할 + 권한 매트릭스에서 scope 배열 빌드
export interface ScopeBuildInput {
  role: Role;
  universityScope?: 'aggregate_only' | 'aggregate_and_individual' | null;
}

export function buildScopes(input: ScopeBuildInput): Scope[] {
  const scopes: Scope[] = [];
  switch (input.role) {
    case 'university':
      if (input.universityScope === 'aggregate_only' || input.universityScope === 'aggregate_and_individual') {
        scopes.push('university:aggregate');
      }
      if (input.universityScope === 'aggregate_and_individual') {
        scopes.push('university:individual');
      }
      break;
    case 'mentor':
      scopes.push('mentor:read', 'mentor:write');
      break;
    case 'admin':
      scopes.push('admin:moderation', 'admin:billing');
      break;
    default:
      // student / enterprise / 기타: 기본 권한은 라우터 단에서 처리
      break;
  }
  return scopes;
}
