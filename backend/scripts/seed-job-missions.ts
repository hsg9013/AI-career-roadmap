import '../src/config/dotenv.js';
import { getPool, closePool } from '../src/db/pool.js';

// 004 US3/G2: 카탈로그 직무마다 기본 미션 세트(직무당 최소 3개, created_by NULL=base)를 확보.
// 멘토 출제 미션은 운영 중 추가되며 조회 시 우선 노출된다. 멱등(부족분만 채움).

const MIN_PER_JOB = 3;

// 직무명 기반 기본 미션 템플릿(3종). 직무 표시명을 끼워 생성.
const TEMPLATES = [
  (job: string) => ({
    title: `${job} 실무 미니 과제: 요구사항 분석`,
    brief: `${job} 직무의 실제 업무 상황을 가정해 요구사항을 정리하고 해결 접근을 1페이지로 제안하세요. 문제정의→접근→기대효과 구조로 작성합니다.`,
  }),
  (job: string) => ({
    title: `${job} 핵심 역량 과제: 산출물 제작`,
    brief: `${job}에서 자주 쓰이는 산출물(설계/분석/기획 문서 등)을 직접 만들어 제출하세요. 정량적 근거와 의사결정 이유를 포함합니다.`,
  }),
  (job: string) => ({
    title: `${job} 회고 과제: 경험-역량 연결`,
    brief: `본인의 활동/프로젝트 경험 한 가지를 ${job} 직무 요구역량과 연결해 STAR 형식으로 정리하세요.`,
  }),
];

async function main() {
  const pool = getPool();
  const [jobs] = await pool.query(
    'SELECT industry_code, code AS job_role_code, name FROM job_roles',
  );
  const jobRows = jobs as Array<{ industry_code: string; job_role_code: string; name: string }>;
  console.log(`카탈로그 직무 ${jobRows.length}개 점검, 직무당 기본 미션 ${MIN_PER_JOB}개 목표`);

  let inserted = 0;
  for (const job of jobRows) {
    const [cntRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM missions
       WHERE industry_code = ? AND job_role_code = ? AND created_by IS NULL`,
      [job.industry_code, job.job_role_code],
    );
    const have = Number((cntRows as Array<{ c: number }>)[0]?.c ?? 0);
    for (let i = have; i < MIN_PER_JOB; i++) {
      const t = TEMPLATES[i % TEMPLATES.length](job.name ?? job.job_role_code);
      await pool.query(
        `INSERT INTO missions (title, industry_code, job_role_code, brief, created_by, status)
         VALUES (?, ?, ?, ?, NULL, 'open')`,
        [t.title, job.industry_code, job.job_role_code, t.brief],
      );
      inserted++;
    }
  }

  const [shortRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM (
       SELECT industry_code, job_role_code, COUNT(*) n FROM missions
       WHERE created_by IS NULL GROUP BY 1,2 HAVING n < ${MIN_PER_JOB}
     ) t`,
  );
  const under = Number((shortRows as Array<{ c: number }>)[0]?.c ?? 0);
  console.log(`완료 — 기본 미션 ${inserted}개 추가. base<${MIN_PER_JOB} 잔존 직무: ${under}`);
  await closePool().catch(() => {});
  process.exit(0);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
