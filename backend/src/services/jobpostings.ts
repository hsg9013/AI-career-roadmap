import { getPool } from '../db/pool.js';

// T063: 외부 채용 공고 + 신선도(fresh/stale) (FR-024)

const STALE_AFTER_DAYS = 30;

export async function listJobPostings(q: { industry_code?: string; job_role_code?: string }): Promise<unknown[]> {
  const filters: string[] = [];
  const params: unknown[] = [];
  if (q.industry_code) { filters.push('industry_code = ?'); params.push(q.industry_code); }
  if (q.job_role_code) { filters.push('job_role_code = ?'); params.push(q.job_role_code); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await getPool().query(
    `SELECT id, source, title, company, industry_code, job_role_code, url, freshness,
            DATE_FORMAT(collected_at, '%Y-%m-%dT%H:%i:%sZ') AS collected_at
     FROM job_postings ${where} ORDER BY collected_at DESC LIMIT 100`,
    params,
  );
  return rows as unknown[];
}

// 수집 후 일정 기간 지난 공고를 'stale' 로 표시 (external-fetch 워커/배치에서 호출)
export async function refreshStaleness(): Promise<number> {
  const [res] = await getPool().query(
    `UPDATE job_postings SET freshness = 'stale'
     WHERE freshness = 'fresh' AND collected_at < (NOW() - INTERVAL ? DAY)`,
    [STALE_AFTER_DAYS],
  );
  return (res as { affectedRows: number }).affectedRows;
}
