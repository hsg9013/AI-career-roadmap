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

// 대시보드 차트용 사용 데이터 집계 — 서비스유형별 / 기간(월)별 / 사용자별
export async function usageBreakdown(): Promise<{
  byType: Array<{ key: string; count: number }>;
  byPeriod: Array<{ key: string; count: number }>;
  byUser: Array<{ key: string; count: number }>;
  total: number;
}> {
  const pool = getPool();
  const [typeRows] = await pool.query(
    `SELECT event AS k, COUNT(*) AS n FROM analytics_events GROUP BY event ORDER BY n DESC, event ASC`,
  );
  const [periodRows] = await pool.query(
    `SELECT DATE_FORMAT(occurred_at, '%Y-%m') AS k, COUNT(*) AS n
     FROM analytics_events GROUP BY k ORDER BY k ASC`,
  );
  const [userRows] = await pool.query(
    `SELECT CAST(user_id AS CHAR) AS k, COUNT(*) AS n
     FROM analytics_events WHERE user_id IS NOT NULL
     GROUP BY user_id ORDER BY n DESC, user_id ASC LIMIT 20`,
  );
  const [totRows] = await pool.query('SELECT COUNT(*) AS n FROM analytics_events');
  const map = (rows: unknown) =>
    (rows as Array<{ k: string; n: number | string }>).map((r) => ({ key: r.k, count: Number(r.n) }));
  return {
    byType: map(typeRows),
    byPeriod: map(periodRows),
    byUser: map(userRows),
    total: Number((totRows as Array<{ n: number | string }>)[0]?.n ?? 0),
  };
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
