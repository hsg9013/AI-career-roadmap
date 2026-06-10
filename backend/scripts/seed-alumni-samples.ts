import '../src/config/dotenv.js';
import { randomBytes } from 'node:crypto';
import { getPool, closePool } from '../src/db/pool.js';

// 004 US2/G6: 모든 카탈로그 직무에 합격 경로 표본을 직무당 최소 10건 확보(k-익명성 ≥5 충족).
// 기존 표본은 보존하고 부족분만 채운다(멱등). 시연용 익명 표본이며 개인 식별 정보 없음.

const TARGET_PER_JOB = 10;
const MAJOR_FIELDS = ['컴퓨터공학', '전자공학', '경영학', '산업공학', '통계학', '디자인', '경제학', '기계공학'];
const GRADE_BANDS = ['y3', 'y4plus', 'y1_2']; // chk_alumni_band 제약 값
const SUCCESS_YEARS = [2023, 2024, 2025];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function main() {
  const pool = getPool();
  const [jobs] = await pool.query('SELECT industry_code, code AS job_role_code FROM job_roles');
  const jobRows = jobs as Array<{ industry_code: string; job_role_code: string }>;
  console.log(`카탈로그 직무 ${jobRows.length}개 점검, 직무당 목표 ${TARGET_PER_JOB}건`);

  let inserted = 0;
  let jobsTouched = 0;
  for (const job of jobRows) {
    const [cntRows] = await pool.query(
      'SELECT COUNT(*) AS c FROM alumni_paths WHERE industry_code = ? AND job_role_code = ?',
      [job.industry_code, job.job_role_code],
    );
    const have = Number((cntRows as Array<{ c: number }>)[0]?.c ?? 0);
    const need = Math.max(0, TARGET_PER_JOB - have);
    if (need === 0) continue;
    jobsTouched++;
    for (let i = 0; i < need; i++) {
      await pool.query(
        `INSERT INTO alumni_paths (anonymized_id, industry_code, job_role_code, major_field, grade_band, success_year)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          randomBytes(32).toString('hex'),
          job.industry_code,
          job.job_role_code,
          pick(MAJOR_FIELDS, have + i),
          pick(GRADE_BANDS, have + i),
          pick(SUCCESS_YEARS, have + i),
        ],
      );
      inserted++;
    }
  }

  // 검증: 직무당 표본 수 < 5 인 코호트 잔존 여부
  const [shortRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM (
       SELECT industry_code, job_role_code, COUNT(*) n FROM alumni_paths GROUP BY 1,2 HAVING n < 5
     ) t`,
  );
  const under5 = Number((shortRows as Array<{ c: number }>)[0]?.c ?? 0);

  console.log(`완료 — 표본 ${inserted}건 추가(직무 ${jobsTouched}개 보강). k<5 잔존 코호트: ${under5}`);
  await closePool().catch(() => {});
  process.exit(0);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
