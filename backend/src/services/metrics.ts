import { getPool } from '../db/pool.js';
import { eventCounts } from '../lib/analytics.js';
import { getLastSuccessfulBackupAt } from '../lib/ops.js';

// 003 Polish(T053): 관측 대시보드 입력 — 폴백률·결제/발송/수집 성공률·가용성 + 사업 KPI.
// 모든 집계는 읽기 전용. 분모 0 일 때 rate=null(표시 측에서 'N/A').

function rate(numer: number, denom: number): number | null {
  return denom > 0 ? Number((numer / denom).toFixed(4)) : null;
}

export interface OpsMetrics {
  ai: { total: number; fallback: number; fallbackRate: number | null; byReason: Record<string, number> };
  payments: { paid: number; failed: number; refunded: number; canceled: number; successRate: number | null };
  notifications: { sent: number; failed: number; skipped: number; successRate: number | null };
  feeds: { runs: number; success: number; failed: number; successRate: number | null; lastRunAt: string | null };
  availability: { openCriticalAlerts: number; lastBackupAt: string | null };
  kpi: Record<string, number>;
}

export async function collectOpsMetrics(): Promise<OpsMetrics> {
  const pool = getPool();

  // AI 폴백률 — ai_inference_log 전체 기준.
  const [aiRows] = await pool.query(
    `SELECT source, fallback_reason, COUNT(*) AS c FROM ai_inference_log GROUP BY source, fallback_reason`,
  );
  let aiTotal = 0;
  let aiFallback = 0;
  const byReason: Record<string, number> = {};
  for (const r of aiRows as Array<{ source: string; fallback_reason: string; c: number | string }>) {
    const c = Number(r.c);
    aiTotal += c;
    if (r.source === 'fallback_rule') {
      aiFallback += c;
      byReason[r.fallback_reason] = (byReason[r.fallback_reason] ?? 0) + c;
    }
  }

  // 결제 성공률 — 종결 상태 기준(paid / (paid+failed)).
  const [payRows] = await pool.query(`SELECT status, COUNT(*) AS c FROM payments GROUP BY status`);
  const pay: Record<string, number> = {};
  for (const r of payRows as Array<{ status: string; c: number | string }>) pay[r.status] = Number(r.c);
  const paid = pay.paid ?? 0;
  const payFailed = pay.failed ?? 0;

  // 발송 성공률 — notification_delivery(채널 무관).
  const [delRows] = await pool.query(`SELECT status, COUNT(*) AS c FROM notification_delivery GROUP BY status`);
  const del: Record<string, number> = {};
  for (const r of delRows as Array<{ status: string; c: number | string }>) del[r.status] = Number(r.c);
  const sent = del.sent ?? 0;
  const delFailed = del.failed ?? 0;

  // 수집 성공률 — feed_collection_run.
  const [feedRows] = await pool.query(
    `SELECT status, COUNT(*) AS c, MAX(started_at) AS last FROM feed_collection_run GROUP BY status`,
  );
  let feedSuccess = 0;
  let feedFailed = 0;
  let lastRunAt: string | null = null;
  for (const r of feedRows as Array<{ status: string; c: number | string; last: string | null }>) {
    if (r.status === 'success') feedSuccess = Number(r.c);
    else if (r.status === 'failed') feedFailed = Number(r.c);
    if (r.last && (!lastRunAt || r.last > lastRunAt)) lastRunAt = r.last;
  }

  // 가용성 — 미해결 critical 경보 수 + 마지막 성공 백업.
  const [alertRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM monitor_alert WHERE severity = 'critical' AND resolved_at IS NULL`,
  );
  const openCriticalAlerts = Number((alertRows as Array<{ c: number | string }>)[0]?.c ?? 0);
  const lastBackupAt = await getLastSuccessfulBackupAt();

  return {
    ai: { total: aiTotal, fallback: aiFallback, fallbackRate: rate(aiFallback, aiTotal), byReason },
    payments: {
      paid, failed: payFailed, refunded: pay.refunded ?? 0, canceled: pay.canceled ?? 0,
      successRate: rate(paid, paid + payFailed),
    },
    notifications: {
      sent, failed: delFailed, skipped: del.skipped ?? 0,
      successRate: rate(sent, sent + delFailed),
    },
    feeds: {
      runs: feedSuccess + feedFailed, success: feedSuccess, failed: feedFailed,
      successRate: rate(feedSuccess, feedSuccess + feedFailed), lastRunAt,
    },
    availability: { openCriticalAlerts, lastBackupAt },
    kpi: await eventCounts(),
  };
}
