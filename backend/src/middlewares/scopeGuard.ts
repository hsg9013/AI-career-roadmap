import type { Request, Response, NextFunction } from 'express';
import type { Scope } from '../lib/jwt.js';
import { HttpError } from './errorHandler.js';

// T026 (R-7): 요구 scope 검사 미들웨어
// 사용: app.get('/dashboard/aggregate', requireAuth, scopeGuard('university:aggregate'), handler)

export function scopeGuard(...required: Scope[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(new HttpError(401, 'UNAUTHENTICATED', 'Auth required'));
    const have = new Set(req.auth.scopes);
    const missing = required.filter((s) => !have.has(s));
    if (missing.length > 0) {
      return next(new HttpError(403, 'INSUFFICIENT_SCOPE', `Missing scopes: ${missing.join(',')}`));
    }
    next();
  };
}
