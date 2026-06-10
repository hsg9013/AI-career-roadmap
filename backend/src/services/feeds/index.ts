import { getPool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { getCollectors, type FeedCollector, type FeedKind } from './collectors.js';

// 003 US5(T039/T040): 일 단위 수집 실행 + 신선도 + 조회.
//   • collectSource: feed_collection_run 기록 + external_feed_item upsert. 실패 시 기존 행 유지(삭제 없음).
//   • refreshFeedFreshness: 기준 기간 초과 항목을 stale 로 표시(FR-011).

export interface CollectSummary {
  source: string;
  status: 'success' | 'failed';
  itemCount: number;
  error?: string;
}

// 단일 소스 수집. 수집 실패는 throw 하지 않고 run=failed 로 기록(기존 데이터 보존).
export async function collectSource(collector: FeedCollector): Promise<CollectSummary> {
  const pool = getPool();
  const [runIns] = await pool.query(
    `INSERT INTO feed_collection_run (source, status) VALUES (?, 'running')`,
    [collector.source],
  );
  const runId = (runIns as { insertId: number }).insertId;

  try {
    const items = await collector.collect();
    // upsert — 동일 (source, external_id) 는 갱신(중복 없음), 재수집 시 fresh 로 되살림.
    for (const it of items) {
      await pool.query(
        `INSERT INTO external_feed_item (kind, source, external_id, title, payload, freshness, collected_at)
         VALUES (?, ?, ?, ?, ?, 'fresh', NOW())
         ON DUPLICATE KEY UPDATE
           title = VALUES(title), payload = VALUES(payload),
           freshness = 'fresh', collected_at = NOW()`,
        [collector.kind, collector.source, it.externalId, it.title, JSON.stringify(it.payload)],
      );
    }
    await pool.query(
      `UPDATE feed_collection_run SET status = 'success', item_count = ?, finished_at = NOW() WHERE id = ?`,
      [items.length, runId],
    );
    return { source: collector.source, status: 'success', itemCount: items.length };
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    await pool.query(
      `UPDATE feed_collection_run SET status = 'failed', error = ?, finished_at = NOW() WHERE id = ?`,
      [message, runId],
    );
    // 실패 시 기존 external_feed_item 은 건드리지 않는다(FR-010: 수집 실패 시 기존 데이터 유지).
    logger.warn({ source: collector.source, err }, '[feeds] collection failed — kept existing data');
    return { source: collector.source, status: 'failed', itemCount: 0, error: message };
  }
}

// 모든 소스 수집 후 신선도 갱신. 일일 스케줄 잡에서 호출.
export async function collectAllFeeds(): Promise<{ runs: CollectSummary[]; staled: number }> {
  const runs: CollectSummary[] = [];
  for (const c of getCollectors()) {
    runs.push(await collectSource(c));
  }
  const staled = await refreshFeedFreshness();
  logger.info({ runs, staled }, '[feeds] collection cycle complete');
  return { runs, staled };
}

// 기준 기간(FEED_STALE_AFTER_DAYS) 초과 항목을 stale 로. 갱신된 행 수 반환.
export async function refreshFeedFreshness(): Promise<number> {
  const [res] = await getPool().query(
    `UPDATE external_feed_item SET freshness = 'stale'
     WHERE freshness = 'fresh' AND collected_at < (NOW() - INTERVAL ? DAY)`,
    [env.FEED_STALE_AFTER_DAYS],
  );
  return (res as { affectedRows: number }).affectedRows;
}

export interface FeedItemView {
  id: number;
  kind: FeedKind;
  source: string;
  external_id: string;
  title: string | null;
  freshness: 'fresh' | 'stale';
  collected_at: string;
  payload: unknown;
}

export interface ListFeedQuery {
  kind?: FeedKind;
  source?: string;
  freshness?: 'fresh' | 'stale';
}

export async function listFeedItems(q: ListFeedQuery): Promise<FeedItemView[]> {
  const filters: string[] = [];
  const params: unknown[] = [];
  if (q.kind) { filters.push('kind = ?'); params.push(q.kind); }
  if (q.source) { filters.push('source = ?'); params.push(q.source); }
  if (q.freshness) { filters.push('freshness = ?'); params.push(q.freshness); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await getPool().query(
    `SELECT id, kind, source, external_id, title, freshness,
            DATE_FORMAT(collected_at, '%Y-%m-%dT%H:%i:%sZ') AS collected_at, payload
     FROM external_feed_item ${where}
     ORDER BY collected_at DESC LIMIT 100`,
    params,
  );
  return (rows as Array<FeedItemView & { payload: unknown }>).map((r) => ({
    ...r,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
  }));
}
