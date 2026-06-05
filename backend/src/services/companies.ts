import { getPool } from '../db/pool.js';

// T049: 기업 인재 검색 (FR-015) — 매칭 동의(opted_in=1) 학생만 노출.

export interface CandidateQuery {
  industry_code?: string;
  job_role_code?: string;
}

export interface Candidate {
  student_id: number;
  major: string;
  year_in_school: number;
  target_industry: string;
  target_role: string;
  latest_score: number | null;
}

export async function searchCandidates(q: CandidateQuery): Promise<Candidate[]> {
  const filters: string[] = ['jmc.opted_in = 1'];
  const params: unknown[] = [];
  if (q.industry_code) { filters.push('tj.industry_code = ?'); params.push(q.industry_code); }
  if (q.job_role_code) { filters.push('tj.job_role_code = ?'); params.push(q.job_role_code); }

  const [rows] = await getPool().query(
    `SELECT s.id AS student_id, s.major, s.year_in_school,
            tj.industry_code AS target_industry, tj.job_role_code AS target_role,
            (SELECT g.overall_score FROM gap_diagnoses g
             WHERE g.student_id = s.id AND g.target_job_id = tj.id
             ORDER BY g.computed_at DESC LIMIT 1) AS latest_score
     FROM job_match_consents jmc
     JOIN students s ON s.id = jmc.student_id
     JOIN target_jobs tj ON tj.student_id = s.id
     WHERE ${filters.join(' AND ')}
     ORDER BY latest_score DESC
     LIMIT 100`,
    params,
  );
  return (rows as Array<Candidate & { latest_score: number | string | null }>).map((r) => ({
    student_id: r.student_id,
    major: r.major,
    year_in_school: r.year_in_school,
    target_industry: r.target_industry,
    target_role: r.target_role,
    latest_score: r.latest_score === null ? null : Number(r.latest_score),
  }));
}

// 학생이 매칭 노출 동의를 설정 (upsert)
export async function setMatchConsent(studentUserId: number, optedIn: boolean): Promise<void> {
  await getPool().query(
    `INSERT INTO job_match_consents (student_id, opted_in)
     SELECT id, ? FROM students WHERE user_id = ?
     ON DUPLICATE KEY UPDATE opted_in = VALUES(opted_in)`,
    [optedIn ? 1 : 0, studentUserId],
  );
}
