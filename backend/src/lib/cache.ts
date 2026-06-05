import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// T066: 조회 캐시 헬퍼 (성능 패스). Redis 장애 시 graceful — 항상 원본으로 폴백.

let redis: Redis | null = null;
function client(): Redis {
  if (redis) return redis;
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
  return redis;
}

export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  try {
    const hit = await client().get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err, key }, '[cache] read failed — bypassing');
  }
  const value = await loader();
  try {
    await client().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, '[cache] write failed');
  }
  return value;
}

export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await client().del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, '[cache] invalidate failed');
  }
}
