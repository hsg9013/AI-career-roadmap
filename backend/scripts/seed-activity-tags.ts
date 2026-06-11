import '../src/config/dotenv.js';
import { getPool, closePool } from '../src/db/pool.js';
import { diagnoseGap } from '../src/services/gapDiagnosis.js';

// 005 갭 진단 데모 백필 (멱등).
//   문제: 학생에게 활동 태그(activity_tags)가 없으면 갭 진단 점수가 항상 0점이 된다
//         (점수 = 매칭 가중치 합 / 전체 가중치 합 × 100, 매칭 기준은 activity_tags.tag).
//   조치: 목표 직무가 있는 모든 학생에 대해 — 각 목표 직무의 요구 키워드 중 가중치 상위
//         일부를 "보유"로 태깅해, 의미 있는(0이 아닌) 점수가 나오게 한다. 그 뒤 실제
//         diagnoseGap 으로 목표 직무별 스냅샷을 만들어 로그인 즉시 대시보드에 점수를 띄운다.
//   실행: pnpm --filter backend exec tsx scripts/seed-activity-tags.ts
//
// 신규 가입 학생은 활동이 없으면 0점이 정상(제품 의도) — 이 백필은 데모/기존 계정 대상이다.

// 각 목표 직무에서 "보유"로 채울 누적 가중치 목표 비율(가중치 내림차순으로 채움).
// 0.65 → 점수가 대략 65~78%(amber~green) 구간에 들어와 데모에 적합.
const COVER_RATIO = 0.65;

interface KeywordsRow {
  keywords_json: unknown;
}

function parseKeywords(raw: unknown): Record<string, number> {
  if (raw == null) return {};
  const obj = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  if (typeof obj !== 'object' || obj === null) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k.trim().toLowerCase()] = n;
  }
  return out;
}

// 가중치 내림차순으로 누적 비율이 COVER_RATIO 를 넘을 때까지 키워드를 고른다(최소 1개).
function pickTags(weights: Record<string, number>): string[] {
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return [];
  const picked: string[] = [];
  let acc = 0;
  for (const [kw, w] of entries) {
    picked.push(kw);
    acc += w;
    if (acc / total >= COVER_RATIO) break;
  }
  return picked;
}

async function main(): Promise<void> {
  const pool = getPool();

  // 목표 직무가 있는 학생 + 소속 user_id
  const [students] = await pool.query(
    `SELECT DISTINCT tj.student_id, s.user_id
       FROM target_jobs tj JOIN students s ON s.id = tj.student_id
      ORDER BY tj.student_id`,
  );
  const rows = students as Array<{ student_id: number; user_id: number }>;

  let tagged = 0;
  let snapshots = 0;

  for (const { student_id, user_id } of rows) {
    // 이 학생의 모든 목표 직무
    const [tjRows] = await pool.query(
      `SELECT id, industry_code, job_role_code FROM target_jobs WHERE student_id = ? ORDER BY priority`,
      [student_id],
    );
    const targetJobs = tjRows as Array<{ id: number; industry_code: string; job_role_code: string }>;
    if (targetJobs.length === 0) continue;

    // 모든 목표 직무의 키워드를 모아 태그 후보 집합 구성(태그는 학생 단위로 공유됨)
    const tagSet = new Set<string>();
    for (const tj of targetJobs) {
      const [jr] = await pool.query(
        `SELECT keywords_json FROM job_requirements WHERE industry_code = ? AND job_role_code = ? LIMIT 1`,
        [tj.industry_code, tj.job_role_code],
      );
      const kr = (jr as KeywordsRow[])[0];
      if (!kr) continue;
      for (const t of pickTags(parseKeywords(kr.keywords_json))) tagSet.add(t);
    }
    if (tagSet.size === 0) continue;

    // 태그를 붙일 활동 확보 — 기존 활동이 있으면 그 중 하나, 없으면 데모 활동 1건 생성
    const [actRows] = await pool.query(
      `SELECT id FROM activities WHERE student_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1`,
      [student_id],
    );
    let activityId = (actRows as Array<{ id: number }>)[0]?.id;
    if (!activityId) {
      const [ins] = await pool.query(
        `INSERT INTO activities (student_id, category, title, description, started_at, source)
         VALUES (?, 'project', '대표 활동(데모)', '갭 진단 데모용 보유 역량 활동', '2025-03-02', 'manual')`,
        [student_id],
      );
      activityId = (ins as { insertId: number }).insertId;
    }

    // 태그 멱등 삽입(uk_activity_tag: activity_id+tag 유니크) — source=auto
    for (const tag of tagSet) {
      await pool.query(
        `INSERT INTO activity_tags (activity_id, tag, source, weight)
         VALUES (?, ?, 'auto', 1.000)
         ON DUPLICATE KEY UPDATE tag = VALUES(tag)`,
        [activityId, tag],
      );
    }
    tagged += 1;

    // 목표 직무별 진단 스냅샷 생성(실제 알고리즘 재사용 → 대시보드 로그인 즉시 점수 표시)
    for (const tj of targetJobs) {
      try {
        const { diagnosis } = await diagnoseGap(user_id, tj.id);
        snapshots += 1;
        console.log(
          `  student ${student_id} · ${tj.industry_code}/${tj.job_role_code} → ${diagnosis.overall_score}점`,
        );
      } catch (e) {
        console.warn(`  ! student ${student_id} · tj ${tj.id} 진단 실패:`, (e as Error).message);
      }
    }
  }

  console.log(`\n=== 활동 태그 백필 완료 — 학생 ${tagged}명 태깅, 진단 스냅샷 ${snapshots}건 ===`);
  await closePool();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('[seed-activity-tags] error:', e);
  await closePool().catch(() => {});
  process.exit(1);
});
