import type { Request, Response, NextFunction } from 'express';
import { getPool } from '../db/pool.js';
import { logger } from '../lib/logger.js';

// T027: 민감 액션을 audit_logs에 적재 (FR-019, FR-033, FR-034)

export interface AuditEntry {
  actorUserId: number | null;
  action: string;                // 예: 'university_view_individual', 'data_export_requested'
  targetKind?: string | null;    // 예: 'student', 'mentor', 'payment'
  targetId?: number | null;
  meta?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO audit_logs
        (actor_user_id, action, target_kind, target_id, meta_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.actorUserId,
        entry.action,
        entry.targetKind ?? null,
        entry.targetId ?? null,
        entry.meta ? JSON.stringify(entry.meta) : null,
        entry.ipAddress ?? null,
      ],
    );
  } catch (err) {
    // audit 실패는 본 처리를 막지 않되 강하게 경고
    logger.error({ err, entry }, '[audit] insert failed');
  }
}

// Express 미들웨어 helper: 응답 완료 후 자동 적재
export function auditAfter(action: string, targetExtractor?: (req: Request) => { kind?: string; id?: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const target = targetExtractor?.(req) ?? {};
      void recordAudit({
        actorUserId: req.auth?.sub ?? null,
        action,
        targetKind: target.kind ?? null,
        targetId: target.id ?? null,
        meta: { method: req.method, path: req.path, status: res.statusCode },
        ipAddress: req.ip ?? null,
      });
    });
    next();
  };
}
