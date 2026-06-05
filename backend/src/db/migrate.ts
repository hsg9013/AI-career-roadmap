import '../config/dotenv.js';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, closePool } from './pool.js';
import { logger } from '../lib/logger.js';

// T018: SQL 파일 기반 마이그레이션 러너 (schema_migrations 테이블, 단방향 적용)
// 사용: pnpm --filter backend migrate:up | migrate:status

const __filename = fileURLToPath(import.meta.url);
const MIGRATIONS_DIR = join(dirname(__filename), 'migrations');

const SCHEMA_MIGRATIONS_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(120) PRIMARY KEY,
  applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum    CHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureSchemaMigrations() {
  await getPool().query(SCHEMA_MIGRATIONS_DDL);
}

async function listFiles(): Promise<string[]> {
  const all = await readdir(MIGRATIONS_DIR);
  return all
    .filter((f) => /^V\d+__.+\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b));
}

async function appliedSet(): Promise<Set<string>> {
  const [rows] = await getPool().query('SELECT version FROM schema_migrations');
  const arr = rows as unknown as Array<{ version: string }>;
  return new Set(arr.map((r) => r.version));
}

async function sha256(input: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}

function splitStatements(sql: string): string[] {
  // 단순 세미콜론 분리 (CREATE TRIGGER 등 복합 블록은 향후 DELIMITER 처리 필요)
  // 줄 단위 -- 주석은 split 전에 제거해 "주석으로 시작하는 세그먼트가 통째로 버려지는" 버그를 막는다.
  const stripped = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  return stripped
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function migrateUp(): Promise<{ applied: string[] }> {
  await ensureSchemaMigrations();
  const files = await listFiles();
  const applied = await appliedSet();
  const newlyApplied: string[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;

    const fullPath = join(MIGRATIONS_DIR, file);
    const sql = await readFile(fullPath, 'utf8');
    const checksum = await sha256(sql);

    logger.info({ version, file }, '[migrate] applying');
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      for (const stmt of splitStatements(sql)) {
        await conn.query(stmt);
      }
      await conn.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
        [version, checksum],
      );
      await conn.commit();
      newlyApplied.push(version);
      logger.info({ version }, '[migrate] applied');
    } catch (err) {
      await conn.rollback();
      logger.error({ err, version }, '[migrate] failed — rolled back');
      throw err;
    } finally {
      conn.release();
    }
  }
  return { applied: newlyApplied };
}

export async function migrateStatus(): Promise<void> {
  await ensureSchemaMigrations();
  const files = await listFiles();
  const applied = await appliedSet();
  // eslint-disable-next-line no-console
  console.log('Migration status:');
  for (const f of files) {
    const v = f.replace(/\.sql$/, '');
    // eslint-disable-next-line no-console
    console.log(`  ${applied.has(v) ? '✅ applied' : '⏳ pending'}  ${v}`);
  }
}

const CMD = process.argv[2];
if (CMD === 'up' || CMD === 'status') {
  const main = CMD === 'up' ? migrateUp : migrateStatus;
  main()
    .then(async (res) => {
      if (CMD === 'up') {
        const applied = (res as { applied: string[] }).applied;
        // eslint-disable-next-line no-console
        console.log(applied.length === 0 ? 'No pending migrations.' : `Applied ${applied.length}:`);
        applied.forEach((v) => console.log('  ' + v));
      }
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error('[migrate] error:', err);
      await closePool();
      process.exit(1);
    });
}
