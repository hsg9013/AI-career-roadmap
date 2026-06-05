import type { PoolConnection } from 'mysql2/promise';

// T024: k-익명성 게이트 (FR-019, R-2)
//
// 선배 경로 추천은 동일 코호트(industry_code × job_role_code × grade_band) 표본이
// K_ANONYMITY_MIN(=5) 이상일 때만 코호트 단위로 사용한다. 미달 시 호출부는
// 더 넓은 코호트로 폴백하거나 일반 추천으로 대체해야 한다.

export const K_ANONYMITY_MIN = 5;

export interface Cohort {
  industry_code: string;
  job_role_code: string;
  grade_band: string;
}

export function cohortKey(c: Cohort): string {
  return `${c.industry_code}/${c.job_role_code}/${c.grade_band}`;
}

// year_in_school(1~6) → grade_band 매핑. 선배 시드 데이터의 band 값과 일치해야 한다.
export function gradeBandFor(yearInSchool: number): string {
  if (yearInSchool <= 2) return 'y1_2';
  if (yearInSchool === 3) return 'y3';
  return 'y4plus';
}

// 코호트 표본 수. grade_band 가 주어지면 3-키 코호트, 없으면 (industry, role) 광역 표본.
export async function cohortCount(
  conn: PoolConnection,
  industryCode: string,
  jobRoleCode: string,
  gradeBand?: string,
): Promise<number> {
  const where = gradeBand
    ? 'industry_code = ? AND job_role_code = ? AND grade_band = ?'
    : 'industry_code = ? AND job_role_code = ?';
  const params = gradeBand ? [industryCode, jobRoleCode, gradeBand] : [industryCode, jobRoleCode];
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM alumni_paths WHERE ${where}`,
    params,
  );
  return Number((rows as Array<{ cnt: number | string }>)[0]?.cnt ?? 0);
}

export function satisfiesKAnonymity(count: number): boolean {
  return count >= K_ANONYMITY_MIN;
}
