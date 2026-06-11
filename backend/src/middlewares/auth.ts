import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenClaims } from '../lib/jwt.js';
import { HttpError } from './errorHandler.js';

// T025: Bearer JWT 검증 + req.auth 주입 (전역 Express.Request 확장은 src/types/express.d.ts)

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Missing Bearer token'));
  }
  try {
    req.auth = verifyAccessToken(match[1]!);
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    next(new HttpError(401, 'INVALID_TOKEN', message));
  }
}

// 005: 선택적 인증 — Bearer 토큰이 있으면 req.auth 주입, 없거나 무효면 익명으로 통과(차단 안 함).
// 공개 라우트(제휴 배너 등)에서 로그인 사용자 맥락(목표직무)을 활용하기 위함.
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) {
    try {
      req.auth = verifyAccessToken(match[1]!);
    } catch {
      /* 무효 토큰은 익명 취급 */
    }
  }
  next();
}

export function requireRole(...roles: AccessTokenClaims['role'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(new HttpError(401, 'UNAUTHENTICATED', 'Auth required'));
    if (!roles.includes(req.auth.role)) {
      return next(new HttpError(403, 'FORBIDDEN_ROLE', `Required role: ${roles.join('|')}`));
    }
    next();
  };
}
