import type { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { HttpError } from './errorHandler.js';

// T028: Redis 기반 fixed-window rate limit (IP·사용자별)
// 운영에선 nginx가 1차 차단(api_general 20r/s, api_auth 5r/s) + 본 미들웨어가 2차 게이트.

let redis: Redis | null = null;
function getRedis(): Redis {
  if (redis) return redis;
  redis = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 });
  return redis;
}

export interface RateLimitOptions {
  windowSeconds: number;
  max: number;
  keyPrefix?: string;
  keyFn?: (req: Request) => string;
}

export function rateLimit(opts: RateLimitOptions) {
  const prefix = opts.keyPrefix ?? 'rl';
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // 테스트 환경에서는 IP rate-limit 우회 — 인프로세스 테스트가 공유 Redis 카운터를 오염시키는 문제 방지.
    if (env.NODE_ENV === 'test') {
      next();
      return;
    }
    try {
      const key = `${prefix}:${opts.keyFn ? opts.keyFn(req) : (req.auth?.sub ?? req.ip ?? 'anon')}`;
      const r = getRedis();
      const count = await r.incr(key);
      if (count === 1) await r.expire(key, opts.windowSeconds);
      if (count > opts.max) {
        return next(new HttpError(429, 'RATE_LIMITED', `Too many requests (${opts.max}/${opts.windowSeconds}s)`));
      }
      next();
    } catch (err) {
      // Redis 장애 시 fail-open (운영 정책에 따라 fail-close로 변경 가능)
      next();
    }
  };
}
