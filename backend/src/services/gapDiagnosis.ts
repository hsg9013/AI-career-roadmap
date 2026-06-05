import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';

// T049: 갭 진단 알고리즘 + 스냅샷 저장
//
// 핵심:
//   • 직무 요구 역량(job_requirements.keywords_json) 의 가중치 맵을 기준으로
//   • 학생 활동 태그(activity_tags)에서 모은 보유 키워드와 매칭
//   • overall_score = Σ matched_weight / Σ total_weight × 100
//   • priority_to_improve = 미충족 키워드를 가중치 내림차순, 상위 N
//
// 모델 버전: 알고리즘 변경 시 GAP_MODEL_VERSION 을 함께 올린다 (재진단 트리거 용).

export const GAP_MODEL_VERSION = 'rule-1.0';
const PRIORITY_TOP_N = 5;

interface TargetJobRow {
  id: number;
  student_id: number;
  industry_code: string;
  job_role_code: string;
  priority: number;
}

interface JobRequirementRow {
  id: number;
  industry_code: string;
  job_role_code: string;
  keywords_json: unknown; // JSON column — driver는 이미 파싱해 객체로 반환
}

export interface GapPayload {
  fulfilled: string[];
  missing: string[];
  priority_to_improve: string[];
}

export interface GapDiagnosis {
  id: number;
  target_job_id: number;
  computed_at: string;
  overall_score: number;
  payload: GapPayload;
  model_version: string;
}

function normalize(tag: string): string {
  return tag.trim().toLowerCase();
}

function parseKeywords(raw: unknown): Record<string, number> {
  if (raw === null || raw === undefined) return {};
  // mysql2 는 JSON 컬럼을 자동 파싱하지만 일부 드라이버는 문자열로 반환.
  const obj = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  if (typeof obj !== 'object' || obj === null) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[normalize(k)] = n;
  }
  return out;
}

async function loadTargetJob(
  conn: PoolConnection,
  userId: number,
  targetJobId: number,
): Promise<TargetJobRow> {
  const [rows] = await conn.query(
    `SELECT tj.id, tj.student_id, tj.industry_code, tj.job_role_code, tj.priority
     FROM target_jobs tj
     JOIN students s ON s.id = tj.student_id
     WHERE tj.id = ? AND s.user_id = ?
     LIMIT 1`,
    [targetJobId, userId],
  );
  const arr = rows as TargetJobRow[];
  if (!arr[0]) {
    throw new HttpError(404, 'TARGET_JOB_NOT_FOUND', 'Target job not found for this user');
  }
  return arr[0];
}

async function loadJobRequirements(
  conn: PoolConnection,
  industry: string,
  role: string,
): Promise<Record<string, number>> {
  const [rows] = await conn.query(
    `SELECT id, industry_code, job_role_code, keywords_json
     FROM job_requirements
     WHERE industry_code = ? AND job_role_code = ?
     LIMIT 1`,
    [industry, role],
  );
  const arr = rows as JobRequirementRow[];
  if (!arr[0]) {
    throw new HttpError(
      422,
      'JOB_REQUIREMENTS_MISSING',
      `No requirement dictionary for ${industry}/${role}`,
    );
  }
  return parseKeywords(arr[0].keywords_json);
}

async function loadStudentTags(conn: PoolConnection, studentId: number): Promise<Set<string>> {
  const [rows] = await conn.query(
    `SELECT DISTINCT at.tag
     FROM activity_tags at
     JOIN activities a ON a.id = at.activity_id
     WHERE a.student_id = ? AND a.deleted_at IS NULL`,
    [studentId],
  );
  return new Set((rows as Array<{ tag: string }>).map((r) => normalize(r.tag)));
}

export interface ComputeResult {
  diagnosis: GapDiagnosis;
  job_role: string; // "IT/backend" 형식 — 외부 narrative 등에 PII 대신 사용
}

export async function diagnoseGap(userId: number, targetJobId: number): Promise<ComputeResult> {
  return withTransaction(async (conn) => {
    const tj = await loadTargetJob(conn, userId, targetJobId);
    const weights = await loadJobRequirements(conn, tj.industry_code, tj.job_role_code);

    // 학생이 자기 프로필을 등록한 적 없으면 422 — FR-007 전제 (프로필 필수)
    const tags = await loadStudentTags(conn, tj.student_id);

    const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
    if (totalWeight === 0) {
      throw new HttpError(
        422,
        'EMPTY_REQUIREMENTS',
        `Job requirement dictionary has zero total weight`,
      );
    }

    const fulfilled: string[] = [];
    const missingWithWeight: Array<[string, number]> = [];
    let matchedWeight = 0;
    for (const [kw, w] of Object.entries(weights)) {
      if (tags.has(kw)) {
        fulfilled.push(kw);
        matchedWeight += w;
      } else {
        missingWithWeight.push([kw, w]);
      }
    }
    missingWithWeight.sort((a, b) => b[1] - a[1]);
    const missing = missingWithWeight.map(([k]) => k);
    const priority = missingWithWeight.slice(0, PRIORITY_TOP_N).map(([k]) => k);

    const score = Number(((matchedWeight / totalWeight) * 100).toFixed(2));
    const payload: GapPayload = {
      fulfilled: fulfilled.sort(),
      missing,
      priority_to_improve: priority,
    };

    const [insert] = await conn.query(
      `INSERT INTO gap_diagnoses
         (student_id, target_job_id, overall_score, payload_json, model_version)
       VALUES (?, ?, ?, ?, ?)`,
      [tj.student_id, tj.id, score, JSON.stringify(payload), GAP_MODEL_VERSION],
    );
    const id = (insert as { insertId: number }).insertId;

    const [rows] = await conn.query(
      `SELECT id,
              target_job_id,
              DATE_FORMAT(computed_at, '%Y-%m-%dT%H:%i:%sZ') AS computed_at,
              overall_score,
              payload_json,
              model_version
       FROM gap_diagnoses WHERE id = ?`,
      [id],
    );
    const row = (rows as Array<{
      id: number;
      target_job_id: number;
      computed_at: string;
      overall_score: string | number;
      payload_json: unknown;
      model_version: string;
    }>)[0]!;

    return {
      diagnosis: {
        id: row.id,
        target_job_id: row.target_job_id,
        computed_at: row.computed_at,
        overall_score: Number(row.overall_score),
        payload:
          typeof row.payload_json === 'string'
            ? (JSON.parse(row.payload_json) as GapPayload)
            : (row.payload_json as GapPayload),
        model_version: row.model_version,
      },
      job_role: `${tj.industry_code}/${tj.job_role_code}`,
    };
  });
}

export async function getLatestDiagnosis(
  userId: number,
  targetJobId: number,
): Promise<GapDiagnosis | null> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // 권한 확인: target_job 이 본인 것인지
    const tj = await loadTargetJob(conn, userId, targetJobId);
    const [rows] = await conn.query(
      `SELECT id,
              target_job_id,
              DATE_FORMAT(computed_at, '%Y-%m-%dT%H:%i:%sZ') AS computed_at,
              overall_score,
              payload_json,
              model_version
       FROM gap_diagnoses
       WHERE student_id = ? AND target_job_id = ?
       ORDER BY computed_at DESC, id DESC
       LIMIT 1`,
      [tj.student_id, tj.id],
    );
    const arr = rows as Array<{
      id: number;
      target_job_id: number;
      computed_at: string;
      overall_score: string | number;
      payload_json: unknown;
      model_version: string;
    }>;
    if (!arr[0]) return null;
    const r = arr[0];
    return {
      id: r.id,
      target_job_id: r.target_job_id,
      computed_at: r.computed_at,
      overall_score: Number(r.overall_score),
      payload:
        typeof r.payload_json === 'string'
          ? (JSON.parse(r.payload_json) as GapPayload)
          : (r.payload_json as GapPayload),
      model_version: r.model_version,
    };
  } finally {
    conn.release();
  }
}

// 테스트용 export
export const __internal = { parseKeywords, normalize } as const;
