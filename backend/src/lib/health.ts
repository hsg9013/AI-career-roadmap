import { Redis } from 'ioredis';
import { getPool } from '../db/pool.js';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// T065: 의존성 헬스체크 — /readyz 에서 DB·Redis 실제 ping. S3/LLM 은 설정 유무로 판정.

let healthRedis: Redis | null = null;
function getHealthRedis(): Redis {
  if (healthRedis) return healthRedis;
  healthRedis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  return healthRedis;
}

async function pingDb(): Promise<'ok' | 'down'> {
  try {
    await getPool().query('SELECT 1');
    return 'ok';
  } catch (err) {
    logger.warn({ err }, '[health] db ping failed');
    return 'down';
  }
}

async function pingRedis(): Promise<'ok' | 'down'> {
  try {
    const r = getHealthRedis();
    if (r.status !== 'ready' && r.status !== 'connecting') await r.connect().catch(() => undefined);
    const pong = await r.ping();
    return pong === 'PONG' ? 'ok' : 'down';
  } catch (err) {
    logger.warn({ err }, '[health] redis ping failed');
    return 'down';
  }
}

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  deps: { db: string; redis: string; s3: string; llm: string };
}

export async function checkReadiness(): Promise<ReadinessReport> {
  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
  const s3 = env.S3_ENDPOINT ? 'configured' : 'unset';
  const llm = env.LLM_API_KEY ? 'configured' : 'rule-fallback';
  const status: 'ok' | 'degraded' = db === 'ok' && redis === 'ok' ? 'ok' : 'degraded';
  return { status, deps: { db, redis, s3, llm } };
}
