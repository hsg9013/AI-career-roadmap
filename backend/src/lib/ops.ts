import { getPool } from '../db/pool.js';
import { logger } from './logger.js';
import { checkReadiness } from './health.js';

// 003 US8: 운영 안정성 — 백업 이력·모니터링 경보·확장 헬스 리포트.
//   • FR-015: 일일 백업 생성·기록, 마지막 백업 시각 노출.
//   • FR-017: 구성요소 장애 감지 시 monitor_alert 적재(critical → 운영자 경보).

export interface BackupRunHandle {
  id: number;
}

export async function startBackupRun(): Promise<BackupRunHandle> {
  const [res] = await getPool().query(
    `INSERT INTO backup_run (status) VALUES ('running')`,
  );
  return { id: (res as { insertId: number }).insertId };
}

export async function finishBackupRun(
  handle: BackupRunHandle,
  outcome: { status: 'success' | 'failed'; location?: string; sizeBytes?: number; error?: string },
): Promise<void> {
  await getPool().query(
    `UPDATE backup_run
       SET status = ?, finished_at = CURRENT_TIMESTAMP, location = ?, size_bytes = ?, error = ?
     WHERE id = ?`,
    [outcome.status, outcome.location ?? null, outcome.sizeBytes ?? null, outcome.error ?? null, handle.id],
  );
}

export async function getLastSuccessfulBackupAt(): Promise<string | null> {
  const [rows] = await getPool().query(
    `SELECT finished_at FROM backup_run
     WHERE status = 'success' AND finished_at IS NOT NULL
     ORDER BY finished_at DESC LIMIT 1`,
  );
  const arr = rows as Array<{ finished_at: string }>;
  return arr[0]?.finished_at ?? null;
}

/** 동일 컴포넌트의 미해결(open) 경보가 없을 때만 새 경보를 적재(중복 방지). */
export async function raiseAlert(
  component: string,
  severity: 'warning' | 'critical',
  message: string,
): Promise<void> {
  const pool = getPool();
  const [open] = await pool.query(
    `SELECT id FROM monitor_alert WHERE component = ? AND resolved_at IS NULL LIMIT 1`,
    [component],
  );
  if ((open as unknown[]).length > 0) return;
  await pool.query(
    `INSERT INTO monitor_alert (component, severity, message) VALUES (?, ?, ?)`,
    [component, severity, message],
  );
  // critical 은 운영자 채널로 즉시 통지(여기선 로그 — 실연동 시 notifications 어댑터로 확장).
  if (severity === 'critical') logger.error({ component, message }, '[ops] CRITICAL alert raised');
  else logger.warn({ component, message }, '[ops] alert raised');
}

/** 컴포넌트의 미해결 경보를 해소 처리. */
export async function resolveAlerts(component: string): Promise<void> {
  await getPool().query(
    `UPDATE monitor_alert SET resolved_at = CURRENT_TIMESTAMP
     WHERE component = ? AND resolved_at IS NULL`,
    [component],
  );
}

export interface OpsHealthReport {
  status: 'ok' | 'degraded' | 'down';
  components: Record<string, string>;
  lastBackupAt: string | null;
}

/**
 * 모니터링 1회 평가: 의존성 헬스를 보고 down 컴포넌트는 경보 적재, 복구 시 해소.
 * /ops/health 응답과 주기적 모니터링 잡에서 공통 사용.
 */
export async function evaluateOpsHealth(): Promise<OpsHealthReport> {
  const readiness = await checkReadiness();
  const components: Record<string, string> = { ...readiness.deps };

  for (const comp of ['db', 'redis'] as const) {
    if (readiness.deps[comp] === 'down') {
      await raiseAlert(comp, 'critical', `${comp} health check failed`);
    } else {
      await resolveAlerts(comp);
    }
  }

  let lastBackupAt: string | null = null;
  try {
    lastBackupAt = await getLastSuccessfulBackupAt();
  } catch (err) {
    logger.warn({ err }, '[ops] lastBackupAt lookup failed');
  }

  const status: OpsHealthReport['status'] =
    readiness.deps.db === 'down' ? 'down' : readiness.status === 'ok' ? 'ok' : 'degraded';

  return { status, components, lastBackupAt };
}
