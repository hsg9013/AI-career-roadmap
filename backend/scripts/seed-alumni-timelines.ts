import '../src/config/dotenv.js';
import { getPool, closePool } from '../src/db/pool.js';

// 004 US2 보강: alumni_paths 에 시기별 활동 타임라인(alumni_path_activities)이 없는 표본을 백필.
// 로드맵 추천 엔진(aggregateAlumni)이 집계할 활동이 있어야 빈 로드맵이 안 나온다. 멱등(없는 path만).
// skill_tag 는 해당 직무의 요구역량 키워드(job_requirements)를 사용해 직무 적합 추천이 되게 한다.

const GENERIC = ['communication', 'teamwork', 'problem-solving', 'documentation'];
// 시기별 활동 유형(테이블 CHECK 허용값 내). period 오름차순.
const SLOTS: Array<{ period: string; type: string; detailTpl: (kw: string) => string }> = [
  { period: 'Y1', type: 'course', detailTpl: (k) => `${k} 기초 과목 수강` },
  { period: 'Y2', type: 'project', detailTpl: (k) => `${k} 활용 팀 프로젝트` },
  { period: 'Y3', type: 'internship', detailTpl: (k) => `${k} 실무 인턴 경험` },
  { period: 'Y4', type: 'certification', detailTpl: (k) => `${k} 관련 자격/수료` },
];

async function main() {
  const pool = getPool();
  // 직무별 키워드 맵
  const [reqRows] = await pool.query('SELECT industry_code, job_role_code, keywords_json FROM job_requirements');
  const kwMap = new Map<string, string[]>();
  for (const r of reqRows as Array<{ industry_code: string; job_role_code: string; keywords_json: unknown }>) {
    let keys: string[] = [];
    try {
      const obj = typeof r.keywords_json === 'string' ? JSON.parse(r.keywords_json) : r.keywords_json;
      keys = Object.keys(obj as Record<string, unknown>);
    } catch { /* ignore */ }
    kwMap.set(`${r.industry_code}/${r.job_role_code}`, keys.length ? keys : GENERIC);
  }

  // 타임라인 없는 path
  const [paths] = await pool.query(
    `SELECT ap.id, ap.industry_code, ap.job_role_code
     FROM alumni_paths ap
     WHERE NOT EXISTS (SELECT 1 FROM alumni_path_activities apa WHERE apa.alumni_path_id = ap.id)`,
  );
  const pathRows = paths as Array<{ id: number; industry_code: string; job_role_code: string }>;
  console.log(`타임라인 백필 대상 path: ${pathRows.length}`);

  let inserted = 0;
  for (const p of pathRows) {
    const kws = kwMap.get(`${p.industry_code}/${p.job_role_code}`) ?? GENERIC;
    const rows: Array<[number, string, string, string, string]> = SLOTS.map((slot, i) => {
      const kw = kws[i % kws.length];
      return [p.id, slot.period, slot.type, slot.detailTpl(kw), kw];
    });
    await pool.query(
      `INSERT INTO alumni_path_activities (alumni_path_id, period, activity_type, detail, skill_tag) VALUES ?`,
      [rows],
    );
    inserted += rows.length;
  }

  const [left] = await pool.query(
    `SELECT COUNT(*) c FROM alumni_paths ap WHERE NOT EXISTS (SELECT 1 FROM alumni_path_activities apa WHERE apa.alumni_path_id = ap.id)`,
  );
  console.log(`완료 — 활동 ${inserted}건 추가. 타임라인 없는 path 잔여: ${Number((left as Array<{ c: number }>)[0]?.c ?? 0)}`);
  await closePool();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('[seed-alumni-timelines] error:', e);
  await closePool().catch(() => {});
  process.exit(1);
});
