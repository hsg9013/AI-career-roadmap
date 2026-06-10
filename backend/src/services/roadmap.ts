import { createHash } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { cached, invalidate } from '../lib/cache.js';
import {
  cohortCount,
  cohortKey,
  gradeBandFor,
  satisfiesKAnonymity,
  K_ANONYMITY_MIN,
} from './recommendation/kAnonymity.js';
import { runInference, type AiSource } from './ai/infer.js';
import { logger } from '../lib/logger.js';
import { track } from '../lib/analytics.js';

// T026: 선배 경로 기반 합격 로드맵 생성 (FR-005) + 거부 반영 (FR-006), k-익명성 게이트 (FR-019)
//
// 규칙 기반 추천(R-1):
//   1) 학생 목표 직무(industry/role)와 학년대(grade_band)로 코호트 결정
//   2) 코호트 표본이 ≥5 → 코호트 활동 빈도 집계로 추천 (source='cohort')
//      미달 → 직무 광역(role) 표본 ≥5 면 폴백, 그래도 미달 → 직무 요구사전 일반 추천 (source='fallback')
//   3) 최신 갭 진단의 부족/우선 역량에 가중치 부스트
//   4) 학생 거부 이력(item_ref/skill)으로 하향·제외

export const ROADMAP_MODEL_VERSION = 'roadmap-rule-1.0';
const TOP_N = 8;

export type RoadmapSource = 'cohort' | 'fallback';

export interface RoadmapItem {
  id?: number;
  period: string;
  activity_type: string;
  title: string;
  rationale: string;
  target_skill: string | null;
  score: number;
  status: 'recommended' | 'accepted' | 'rejected' | 'done';
  item_ref: string;
}

export interface Roadmap {
  id: number;
  target_job_id: number;
  status: 'draft' | 'active' | 'completed';
  source: RoadmapSource;
  cohort_key: string | null;
  cohort_size: number;
  generated_at: string;
  model_version: string;
  notice: string | null;
  items: RoadmapItem[];
  // 003 US1(T017/T021): AI 코칭 요약 + 사용 경로. AI 실패·무키·예산초과 시 규칙 기반 요약으로 폴백.
  ai_source: AiSource;
  ai_summary: string;
}

interface TargetJobRow {
  id: number;
  student_id: number;
  industry_code: string;
  job_role_code: string;
  year_in_school: number;
}

interface AggRow {
  period: string;
  activity_type: string;
  skill_tag: string | null;
  detail: string;
  alumni_count: number | string;
}

export function itemRef(period: string, activityType: string, skill: string | null, title: string): string {
  return createHash('sha256')
    .update(`${skill ?? ''}|${activityType}|${period}|${title}`)
    .digest('hex');
}

async function loadTargetJob(
  conn: PoolConnection,
  userId: number,
  targetJobId: number,
): Promise<TargetJobRow> {
  const [rows] = await conn.query(
    `SELECT tj.id, tj.student_id, tj.industry_code, tj.job_role_code, s.year_in_school
     FROM target_jobs tj
     JOIN students s ON s.id = tj.student_id
     WHERE tj.id = ? AND s.user_id = ?
     LIMIT 1`,
    [targetJobId, userId],
  );
  const arr = rows as TargetJobRow[];
  if (!arr[0]) throw new HttpError(404, 'TARGET_JOB_NOT_FOUND', 'Target job not found for this user');
  return arr[0];
}

// 최신 갭 진단의 부족/우선 역량 — 추천 부스트용. 없으면 빈 집합.
async function loadGapSkills(
  conn: PoolConnection,
  studentId: number,
  targetJobId: number,
): Promise<{ missing: Set<string>; priority: Set<string> }> {
  const [rows] = await conn.query(
    `SELECT payload_json FROM gap_diagnoses
     WHERE student_id = ? AND target_job_id = ?
     ORDER BY computed_at DESC, id DESC LIMIT 1`,
    [studentId, targetJobId],
  );
  const row = (rows as Array<{ payload_json: unknown }>)[0];
  if (!row) return { missing: new Set(), priority: new Set() };
  const payload =
    typeof row.payload_json === 'string'
      ? (JSON.parse(row.payload_json) as { missing?: string[]; priority_to_improve?: string[] })
      : (row.payload_json as { missing?: string[]; priority_to_improve?: string[] });
  return {
    missing: new Set((payload.missing ?? []).map((s) => s.toLowerCase())),
    priority: new Set((payload.priority_to_improve ?? []).map((s) => s.toLowerCase())),
  };
}

async function loadRejections(
  conn: PoolConnection,
  studentId: number,
): Promise<{ refs: Set<string>; skills: Set<string> }> {
  const [rows] = await conn.query(
    `SELECT item_ref, target_skill FROM recommendation_rejections WHERE student_id = ?`,
    [studentId],
  );
  const refs = new Set<string>();
  const skills = new Set<string>();
  for (const r of rows as Array<{ item_ref: string; target_skill: string | null }>) {
    refs.add(r.item_ref);
    if (r.target_skill) skills.add(r.target_skill.toLowerCase());
  }
  return { refs, skills };
}

// 코호트(또는 광역) 선배 활동 빈도 집계.
async function aggregateAlumni(
  conn: PoolConnection,
  industry: string,
  role: string,
  gradeBand?: string,
): Promise<AggRow[]> {
  const where = gradeBand
    ? 'ap.industry_code = ? AND ap.job_role_code = ? AND ap.grade_band = ?'
    : 'ap.industry_code = ? AND ap.job_role_code = ?';
  const params = gradeBand ? [industry, role, gradeBand] : [industry, role];
  const [rows] = await conn.query(
    `SELECT apa.period, apa.activity_type, apa.skill_tag,
            MIN(apa.detail) AS detail,
            COUNT(DISTINCT ap.id) AS alumni_count
     FROM alumni_path_activities apa
     JOIN alumni_paths ap ON ap.id = apa.alumni_path_id
     WHERE ${where}
     GROUP BY apa.period, apa.activity_type, apa.skill_tag, apa.detail
     ORDER BY apa.period ASC`,
    params,
  );
  return rows as AggRow[];
}

function skillBoost(skill: string | null, missing: Set<string>, priority: Set<string>): number {
  if (!skill) return 1;
  const s = skill.toLowerCase();
  if (priority.has(s)) return 1.6;
  if (missing.has(s)) return 1.3;
  return 1;
}

function buildItems(
  agg: AggRow[],
  gap: { missing: Set<string>; priority: Set<string> },
  rej: { refs: Set<string>; skills: Set<string> },
): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  for (const row of agg) {
    const skill = row.skill_tag;
    const title = row.detail;
    const ref = itemRef(row.period, row.activity_type, skill, title);
    if (rej.refs.has(ref)) continue; // 거부한 항목은 재추천 제외 (FR-006)

    const base = Number(row.alumni_count);
    const boost = skillBoost(skill, gap.missing, gap.priority);
    const penalty = skill && rej.skills.has(skill.toLowerCase()) ? 0.4 : 1; // 거부 역량 하향
    const score = Number((base * boost * penalty).toFixed(3));

    const skillNote = skill ? `부족 역량 '${skill}' 보완에 기여` : '핵심 활동';
    items.push({
      period: row.period,
      activity_type: row.activity_type,
      title,
      rationale: `합격 선배 ${base}명이 ${row.period}에 수행 — ${skillNote}`,
      target_skill: skill,
      score,
      status: 'recommended',
      item_ref: ref,
    });
  }
  return items;
}

// 선배 표본이 부족할 때: 직무 요구 역량 사전 기반 일반 추천 (alumni 미사용).
async function buildGenericItems(
  conn: PoolConnection,
  industry: string,
  role: string,
  gap: { missing: Set<string>; priority: Set<string> },
  rej: { refs: Set<string>; skills: Set<string> },
): Promise<RoadmapItem[]> {
  const [rows] = await conn.query(
    `SELECT keywords_json FROM job_requirements WHERE industry_code = ? AND job_role_code = ? LIMIT 1`,
    [industry, role],
  );
  const raw = (rows as Array<{ keywords_json: unknown }>)[0]?.keywords_json;
  if (!raw) return [];
  const dict =
    typeof raw === 'string'
      ? (JSON.parse(raw) as Record<string, number>)
      : (raw as Record<string, number>);

  // 부족 역량 우선, 가중치 내림차순
  const ranked = Object.entries(dict)
    .map(([k, w]) => ({ skill: k.toLowerCase(), weight: Number(w) }))
    .sort((a, b) => b.weight - a.weight);

  const items: RoadmapItem[] = [];
  let idx = 0;
  for (const { skill, weight } of ranked) {
    const inMissing = gap.missing.size === 0 || gap.missing.has(skill) || gap.priority.has(skill);
    if (!inMissing) continue;
    const period = `Y${Math.min(4, 2 + Math.floor(idx / 3))}`; // Y2→Y4 분산
    const activityType = 'project';
    const title = `${skill} 역량 강화 프로젝트`;
    const ref = itemRef(period, activityType, skill, title);
    if (rej.refs.has(ref)) continue;
    const penalty = rej.skills.has(skill) ? 0.4 : 1;
    items.push({
      period,
      activity_type: activityType,
      title,
      rationale: `목표 직무 요구 역량 '${skill}'(가중치 ${weight}) 보완 권장`,
      target_skill: skill,
      score: Number((weight * 10 * penalty).toFixed(3)),
      status: 'recommended',
      item_ref: ref,
    });
    idx += 1;
  }
  return items;
}

function finalize(items: RoadmapItem[]): RoadmapItem[] {
  // item_ref 중복 제거(최고 점수 유지) → 점수순 상위 N → period, score 정렬
  const byRef = new Map<string, RoadmapItem>();
  for (const it of items) {
    const prev = byRef.get(it.item_ref);
    if (!prev || it.score > prev.score) byRef.set(it.item_ref, it);
  }
  return [...byRef.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
    .sort((a, b) => (a.period === b.period ? b.score - a.score : a.period.localeCompare(b.period)));
}

// 규칙 기반 요약 — AI 미사용/실패 시 폴백. 항목 메타만으로 결정적 문장 생성(PII 없음).
function ruleRoadmapSummary(jobRole: string, items: RoadmapItem[], notice: string | null): string {
  const periods = [...new Set(items.map((it) => it.period))].sort();
  const skills = [...new Set(items.map((it) => it.target_skill).filter((s): s is string => !!s))].slice(0, 4);
  const head = `${jobRole} 직무를 향한 ${items.length}개 활동을 ${periods.length}개 시기로 구성했습니다.`;
  const focus = skills.length ? ` 핵심 보완 역량: ${skills.join(', ')}.` : '';
  return head + focus + (notice ? ` ${notice}` : '');
}

// AI 코칭 요약 — 항목 제목·시기·역량 키워드만 전달(PII 제로). 실패 시 규칙 요약 폴백.
async function buildRoadmapSummary(
  jobRole: string,
  roadmapId: number,
  items: RoadmapItem[],
  notice: string | null,
): Promise<{ ai_source: AiSource; ai_summary: string }> {
  const fallback = ruleRoadmapSummary(jobRole, items, notice);
  try {
    const safeItems = items.map((it) => ({
      period: it.period,
      type: it.activity_type,
      title: it.title,
      skill: it.target_skill,
    }));
    const system =
      '당신은 한국 대학생의 취업 로드맵을 안내하는 코치입니다. ' +
      '입력으로 받은 목표 직무와 추천 활동 목록(시기·유형·역량 키워드)만 근거로, ' +
      '실행 동기를 부여하는 2~3문장 한국어 요약을 작성하세요. ' +
      '반드시 {"summary": string} JSON 형식만 출력하세요.';
    const user = JSON.stringify({ job_role: jobRole, items: safeItems, notice });
    const res = await runInference({ feature: 'roadmap', subjectRef: roadmapId, system, user });
    if (res.source === 'ai' && res.text) {
      const start = res.text.indexOf('{');
      const end = res.text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(res.text.slice(start, end + 1)) as { summary?: unknown };
        const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
        if (summary) return { ai_source: 'ai', ai_summary: summary };
      }
    }
  } catch (err) {
    logger.warn({ err, roadmapId }, '[roadmap] AI summary failed — rule fallback');
  }
  return { ai_source: 'fallback_rule', ai_summary: fallback };
}

export async function generateRoadmap(userId: number, targetJobId: number): Promise<Roadmap> {
  const result = await withTransaction(async (conn) => {
    const tj = await loadTargetJob(conn, userId, targetJobId);
    const gradeBand = gradeBandFor(tj.year_in_school);
    const gap = await loadGapSkills(conn, tj.student_id, tj.id);
    const rej = await loadRejections(conn, tj.student_id);

    let source: RoadmapSource;
    let cohortSize: number;
    let usedKey: string | null;
    let notice: string | null = null;
    let rawItems: RoadmapItem[];

    const cohortN = await cohortCount(conn, tj.industry_code, tj.job_role_code, gradeBand);
    if (satisfiesKAnonymity(cohortN)) {
      source = 'cohort';
      cohortSize = cohortN;
      usedKey = cohortKey({
        industry_code: tj.industry_code,
        job_role_code: tj.job_role_code,
        grade_band: gradeBand,
      });
      rawItems = buildItems(await aggregateAlumni(conn, tj.industry_code, tj.job_role_code, gradeBand), gap, rej);
    } else {
      const roleN = await cohortCount(conn, tj.industry_code, tj.job_role_code);
      if (satisfiesKAnonymity(roleN)) {
        source = 'fallback';
        cohortSize = roleN;
        usedKey = `${tj.industry_code}/${tj.job_role_code}/*`;
        notice = `해당 학년대 선배 표본(${cohortN}명)이 최소 기준(${K_ANONYMITY_MIN}명) 미만이라 직무 전체 선배 경로로 추천했습니다.`;
        rawItems = buildItems(await aggregateAlumni(conn, tj.industry_code, tj.job_role_code), gap, rej);
      } else {
        source = 'fallback';
        cohortSize = roleN;
        usedKey = null;
        notice = `선배 표본(${roleN}명)이 최소 기준(${K_ANONYMITY_MIN}명) 미만이라 직무 요구 역량 기반 일반 추천을 제공합니다.`;
        rawItems = await buildGenericItems(conn, tj.industry_code, tj.job_role_code, gap, rej);
      }
    }

    const items = finalize(rawItems);

    const [ins] = await conn.query(
      `INSERT INTO roadmaps (student_id, target_job_id, status, source, cohort_key, cohort_size, model_version)
       VALUES (?, ?, 'active', ?, ?, ?, ?)`,
      [tj.student_id, tj.id, source, usedKey, cohortSize, ROADMAP_MODEL_VERSION],
    );
    const roadmapId = (ins as { insertId: number }).insertId;

    for (const it of items) {
      const [itemIns] = await conn.query(
        `INSERT INTO roadmap_items
           (roadmap_id, period, activity_type, title, rationale, target_skill, score, status, item_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'recommended', ?)`,
        [roadmapId, it.period, it.activity_type, it.title, it.rationale, it.target_skill, it.score, it.item_ref],
      );
      it.id = (itemIns as { insertId: number }).insertId;
    }

    const [rows] = await conn.query(
      `SELECT DATE_FORMAT(generated_at, '%Y-%m-%dT%H:%i:%sZ') AS generated_at FROM roadmaps WHERE id = ?`,
      [roadmapId],
    );
    const generatedAt = (rows as Array<{ generated_at: string }>)[0]!.generated_at;

    return {
      id: roadmapId,
      target_job_id: tj.id,
      status: 'active' as const,
      source,
      cohort_key: usedKey,
      cohort_size: cohortSize,
      generated_at: generatedAt,
      model_version: ROADMAP_MODEL_VERSION,
      notice,
      items,
      job_role: `${tj.industry_code}/${tj.job_role_code}`,
    };
  });

  // AI 코칭 요약은 트랜잭션 밖에서(외부 HTTP 호출이 DB 트랜잭션을 점유하지 않도록).
  const { job_role, ...roadmapBase } = result;
  const { ai_source, ai_summary } = await buildRoadmapSummary(
    job_role,
    result.id,
    result.items,
    result.notice,
  );

  await invalidate(latestCacheKey(userId, targetJobId));
  await track(userId, 'roadmap_generated', { target_job_id: targetJobId, source: roadmapBase.source });
  return { ...roadmapBase, ai_source, ai_summary };
}

// FR-006: 추천 거부 — 항목 상태 변경 + 거부 이력 기록(다음 생성에서 제외·하향)
export async function rejectItem(
  userId: number,
  itemId: number,
  reason?: string,
): Promise<void> {
  const targetJobId = await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT ri.id, ri.item_ref, ri.target_skill, r.student_id, r.target_job_id
       FROM roadmap_items ri
       JOIN roadmaps r ON r.id = ri.roadmap_id
       JOIN students s ON s.id = r.student_id
       WHERE ri.id = ? AND s.user_id = ?
       LIMIT 1`,
      [itemId, userId],
    );
    const row = (rows as Array<{ id: number; item_ref: string; target_skill: string | null; student_id: number; target_job_id: number }>)[0];
    if (!row) throw new HttpError(404, 'ROADMAP_ITEM_NOT_FOUND', 'Roadmap item not found for this user');

    await conn.query(`UPDATE roadmap_items SET status = 'rejected' WHERE id = ?`, [itemId]);
    await conn.query(
      `INSERT INTO recommendation_rejections (student_id, item_ref, target_skill, reason)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), rejected_at = CURRENT_TIMESTAMP`,
      [row.student_id, row.item_ref, row.target_skill, reason ?? null],
    );
    return row.target_job_id;
  });
  await invalidate(latestCacheKey(userId, targetJobId));
  await track(userId, 'recommendation_rejected', { item_id: itemId });
}

// 003: 로드맵 항목 완료 표시(SC-003 "로드맵 1개라도 완료 70%" 측정). 본인 항목만.
export async function completeItem(userId: number, itemId: number): Promise<void> {
  const targetJobId = await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT ri.id, r.target_job_id
       FROM roadmap_items ri
       JOIN roadmaps r ON r.id = ri.roadmap_id
       JOIN students s ON s.id = r.student_id
       WHERE ri.id = ? AND s.user_id = ? LIMIT 1`,
      [itemId, userId],
    );
    const row = (rows as Array<{ id: number; target_job_id: number }>)[0];
    if (!row) throw new HttpError(404, 'ROADMAP_ITEM_NOT_FOUND', 'Roadmap item not found for this user');
    await conn.query(`UPDATE roadmap_items SET status = 'done' WHERE id = ?`, [itemId]);
    return row.target_job_id;
  });
  await invalidate(latestCacheKey(userId, targetJobId));
  await track(userId, 'roadmap_item_completed', { item_id: itemId });
}

function latestCacheKey(userId: number, targetJobId: number): string {
  return `roadmap:latest:${userId}:${targetJobId}`;
}

export async function getLatestRoadmap(userId: number, targetJobId: number): Promise<Roadmap | null> {
  // T066: 60초 조회 캐시. 생성/거부 시 무효화.
  return cached(latestCacheKey(userId, targetJobId), 60, () => loadLatestRoadmap(userId, targetJobId));
}

async function loadLatestRoadmap(userId: number, targetJobId: number): Promise<Roadmap | null> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const tj = await loadTargetJob(conn, userId, targetJobId);
    const [rows] = await conn.query(
      `SELECT id, target_job_id, status, source, cohort_key, cohort_size,
              DATE_FORMAT(generated_at, '%Y-%m-%dT%H:%i:%sZ') AS generated_at, model_version
       FROM roadmaps
       WHERE student_id = ? AND target_job_id = ?
       ORDER BY generated_at DESC, id DESC LIMIT 1`,
      [tj.student_id, tj.id],
    );
    const r = (rows as Array<{
      id: number; target_job_id: number; status: Roadmap['status']; source: RoadmapSource;
      cohort_key: string | null; cohort_size: number; generated_at: string; model_version: string;
    }>)[0];
    if (!r) return null;

    const [itemRows] = await conn.query(
      `SELECT id, period, activity_type, title, rationale, target_skill, score, status, item_ref
       FROM roadmap_items WHERE roadmap_id = ?
       ORDER BY period ASC, score DESC`,
      [r.id],
    );
    const items = (itemRows as Array<RoadmapItem & { score: string | number }>).map((it) => ({
      ...it,
      score: Number(it.score),
    }));

    // 조회 경로는 비용·지연 회피를 위해 live AI 를 호출하지 않고 규칙 기반 요약을 제공.
    const jobRole = `${tj.industry_code}/${tj.job_role_code}`;
    return {
      id: r.id,
      target_job_id: r.target_job_id,
      status: r.status,
      source: r.source,
      cohort_key: r.cohort_key,
      cohort_size: r.cohort_size,
      generated_at: r.generated_at,
      model_version: r.model_version,
      notice: null,
      items,
      ai_source: 'fallback_rule',
      ai_summary: ruleRoadmapSummary(jobRole, items, null),
    };
  } finally {
    conn.release();
  }
}

export const __internal = { itemRef, skillBoost, buildItems, finalize } as const;
