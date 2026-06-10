import '../../src/config/dotenv.js';
import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from '../../src/config/env.js';
import { logger } from '../../src/lib/logger.js';
import { startBackupRun, finishBackupRun, raiseAlert, resolveAlerts } from '../../src/lib/ops.js';
import { closePool } from '../../src/db/pool.js';

// 003 US8(T029): 일일 백업 러너.
//   • mysqldump 로 논리 백업 생성 → backup_run 기록.
//   • 실패 시 backup_run=failed + monitor_alert(critical) 적재.
//   • 저장 위치는 BACKUP_DIR(기본 backend/ops/backups). 공유 /tmp 사용 금지(다중 사용자 박스).
//   • 사용: pnpm --filter backend backup:run  (cron 으로 일 1회 권장)
//
// 파일명에 타임스탬프가 필요하나 결정성 제약이 없는 일반 스크립트이므로 Date 사용 OK.

const BACKUP_DIR = resolve(process.env.BACKUP_DIR ?? join(process.cwd(), 'ops', 'backups'));

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function runMysqldump(outPath: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const args = [
      `-h${env.DB_HOST}`,
      `-P${String(env.DB_PORT)}`,
      `-u${env.DB_USER}`,
      '--single-transaction',
      '--quick',
      '--routines',
      '--triggers',
      env.DB_NAME,
    ];
    // 비밀번호는 MYSQL_PWD 환경변수로 전달(프로세스 목록 노출 방지).
    const child = spawn('mysqldump', args, { env: { ...process.env, MYSQL_PWD: env.DB_PASSWORD } });
    const out = createWriteStream(outPath);
    let stderr = '';
    child.stdout.pipe(out);
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      out.close();
      if (code === 0) resolvePromise();
      else reject(new Error(`mysqldump exited ${String(code)}: ${stderr.slice(0, 500)}`));
    });
  });
}

async function main(): Promise<void> {
  await mkdir(BACKUP_DIR, { recursive: true });
  const outPath = join(BACKUP_DIR, `${env.DB_NAME}-${timestamp()}.sql`);
  const handle = await startBackupRun();
  logger.info({ outPath, runId: handle.id }, '[backup] starting');

  try {
    await runMysqldump(outPath);
    const { size } = await stat(outPath);
    await finishBackupRun(handle, { status: 'success', location: outPath, sizeBytes: size });
    await resolveAlerts('backup');
    logger.info({ outPath, sizeBytes: size, runId: handle.id }, '[backup] success');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishBackupRun(handle, { status: 'failed', error: message });
    await raiseAlert('backup', 'critical', `daily backup failed: ${message}`);
    logger.error({ err, runId: handle.id }, '[backup] failed');
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  logger.error({ err }, '[backup] fatal');
  process.exit(1);
});
