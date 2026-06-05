import { getPool } from '../db/pool.js';
import { logger } from './logger.js';

// T072: 제품 이벤트 트래킹 (SC-002~SC-010). best-effort — 실패해도 본 요청 흐름을 막지 않는다.

export type AnalyticsEvent =
  | 'signup'
  | 'first_diagnosis'
  | 'roadmap_generated'
  | 'roadmap_item_completed'
  | 'recommendation_rejected'
  | 'document_generated'
  | 'portfolio_used'
  | 'mission_submitted'
  | 'payment_converted'
  | 'membership_canceled'
  | 'revisit';

export async function track(
  userId: number | null,
  event: AnalyticsEvent,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    await getPool().query(
      'INSERT INTO analytics_events (user_id, event, props_json) VALUES (?, ?, ?)',
      [userId, event, props ? JSON.stringify(props) : null],
    );
  } catch (err) {
    logger.warn({ err, event }, '[analytics] track failed (non-blocking)');
  }
}

// SC 지표 집계 — 운영 대시보드/관리자 메트릭에서 사용.
export async function eventCounts(): Promise<Record<string, number>> {
  const [rows] = await getPool().query(
    'SELECT event, COUNT(*) AS cnt FROM analytics_events GROUP BY event',
  );
  const out: Record<string, number> = {};
  for (const r of rows as Array<{ event: string; cnt: number | string }>) out[r.event] = Number(r.cnt);
  return out;
}
