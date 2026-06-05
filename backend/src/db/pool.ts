import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

// T017: mysql2 promise pool. prepared statement는 호출부에서 강제.
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (pool) return pool;
  pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_POOL_MAX,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    namedPlaceholders: true,
    timezone: '+09:00',
  });
  logger.info(
    { host: env.DB_HOST, port: env.DB_PORT, db: env.DB_NAME, pool_max: env.DB_POOL_MAX },
    '[db] pool created',
  );
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
  logger.info('[db] pool closed');
}

// 트랜잭션 헬퍼: connection 자동 acquire/release/rollback
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
