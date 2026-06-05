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

export function requireRole(...roles: AccessTokenClaims['role'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(new HttpError(401, 'UNAUTHENTICATED', 'Auth required'));
    if (!roles.includes(req.auth.role)) {
      return next(new HttpError(403, 'FORBIDDEN_ROLE', `Required role: ${roles.join('|')}`));
    }
    next();
  };
}
