import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { collectSource, collectAllFeeds, refreshFeedFreshness, listFeedItems } from './index.js';
import type { FeedCollector } from './collectors.js';
import { getPool, closePool } from '../../db/pool.js';

// 003 US5: 수집 upsert 멱등 + 실패 시 기존 유지 + 신선도(stale) + 조회.

const SRC = `vitest-feed-${Date.now()}`;

afterAll(async () => {
  await getPool().query('DELETE FROM external_feed_item WHERE source = ?', [SRC]);
  await getPool().query('DELETE FROM feed_collection_run WHERE source = ?', [SRC]);
  await closePool();
});

function collectorWith(items: { externalId: string; title: string }[], fail = false): FeedCollector {
  return {
    source: SRC,
    kind: 'jobposting',
    async collect() {
      if (fail) throw new Error('simulated feed outage');
      return items.map((i) => ({ externalId: i.externalId, title: i.title, payload: { t: i.title } }));
    },
  };
}

describe('collectSource', () => {
  it('수집 성공 → external_feed_item upsert + run=success', async () => {
    const r = await collectSource(collectorWith([
      { externalId: 'a', title: '공고 A' },
      { externalId: 'b', title: '공고 B' },
    ]));
    expect(r.status).toBe('success');
    expect(r.itemCount).toBe(2);
    const items = await listFeedItems({ source: SRC });
    expect(items.length).toBe(2);
    expect(items.every((i) => i.freshness === 'fresh')).toBe(true);
  });

  it('재수집 멱등 — 동일 external_id 는 중복 없이 갱신', async () => {
    await collectSource(collectorWith([{ externalId: 'a', title: '공고 A(수정)' }]));
    const items = await listFeedItems({ source: SRC });
    // a,b 두 건 유지(중복 생성 없음)
    expect(items.length).toBe(2);
    const a = items.find((i) => i.external_id === 'a');
    expect(a?.title).toBe('공고 A(수정)');
  });

  it('수집 실패 → run=failed, 기존 데이터 유지(삭제 없음)', async () => {
    const r = await collectSource(collectorWith([], true));
    expect(r.status).toBe('failed');
    const items = await listFeedItems({ source: SRC });
    expect(items.length).toBe(2); // 기존 2건 그대로
  });

  it('신선도: 기준 기간 초과 항목은 stale 로 표시', async () => {
    // collected_at 을 과거로 밀어 stale 조건 충족.
    await getPool().query(
      "UPDATE external_feed_item SET collected_at = (NOW() - INTERVAL 60 DAY) WHERE source = ?",
      [SRC],
    );
    const staled = await refreshFeedFreshness();
    expect(staled).toBeGreaterThanOrEqual(2);
    const stale = await listFeedItems({ source: SRC, freshness: 'stale' });
    expect(stale.length).toBe(2);
  });
});

describe('collectAllFeeds (dev 샘플)', () => {
  it('모든 소스 수집 실행 — 샘플 데이터 적재', async () => {
    const result = await collectAllFeeds();
    expect(result.runs.length).toBeGreaterThanOrEqual(3);
    expect(result.runs.every((r) => r.status === 'success')).toBe(true);
    const jobs = await listFeedItems({ kind: 'jobposting' });
    expect(jobs.length).toBeGreaterThan(0);
  });
});
