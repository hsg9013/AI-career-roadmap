import { getPool } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { eventCounts } from '../lib/analytics.js';

// T062/T072: 운영자 검수(신고) + 운영 지표 (FR-023, SC-002~010)

export async function listReports(status?: string): Promise<unknown[]> {
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const [rows] = await getPool().query(
    `SELECT id, reporter_user_id, target_kind, target_id, reason, status, resolution,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
     FROM reports ${where} ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  return rows as unknown[];
}

export async function resolveReport(
  adminUserId: number,
  reportId: number,
  status: 'reviewing' | 'resolved' | 'rejected',
  resolution?: string,
): Promise<void> {
  const [res] = await getPool().query(
    'UPDATE reports SET status = ?, resolution = ?, reviewed_by = ? WHERE id = ?',
    [status, resolution ?? null, adminUserId, reportId],
  );
  if ((res as { affectedRows: number }).affectedRows === 0) {
    throw new HttpError(404, 'REPORT_NOT_FOUND', 'Report not found');
  }
}

// 운영 대시보드 지표: 이벤트 카운트 + 기본 도메인 카운트
export async function metrics(): Promise<Record<string, unknown>> {
  const pool = getPool();
  const events = await eventCounts();
  const [counts] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM students) AS students,
       (SELECT COUNT(*) FROM roadmaps) AS roadmaps,
       (SELECT COUNT(*) FROM submissions) AS submissions,
       (SELECT COUNT(*) FROM alumni_paths) AS alumni_paths,
       (SELECT COUNT(*) FROM payments WHERE status = 'paid') AS paid_payments`,
  );
  return { events, domain: (counts as unknown[])[0] };
}
