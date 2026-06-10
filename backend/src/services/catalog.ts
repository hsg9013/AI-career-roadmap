import { getPool } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';

// 003 US2(T009/T012): 직무·산업 사전 조회 서비스.
//   • 회원가입 관심 산업·희망 직무 선택지의 SSOT.
//   • 직무 응답에는 job_requirements.keywords_json 의 핵심 역량 키워드를 함께 노출(FR-005).

export interface IndustryDto {
  code: string;
  name: string;
}

export interface JobRoleDto {
  code: string;
  industry_code: string;
  name: string;
  competencies: string[];
}

interface IndustryRow {
  code: string;
  name: string;
}

interface JobRoleRow {
  industry_code: string;
  code: string;
  name: string;
  keywords_json: unknown;
}

function competenciesFrom(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  const obj = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  if (typeof obj !== 'object' || obj === null) return [];
  // 가중치 내림차순으로 키워드만 노출
  return Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => [k, typeof v === 'number' ? v : Number(v)] as const)
    .filter(([, w]) => Number.isFinite(w))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

export async function listIndustries(): Promise<{ items: IndustryDto[] }> {
  const [rows] = await getPool().query(
    `SELECT code, name FROM industries WHERE is_active = TRUE ORDER BY sort_order, code`,
  );
  const items = (rows as IndustryRow[]).map((r) => ({ code: r.code, name: r.name }));
  return { items };
}

export async function listJobsByIndustry(industryCode: string): Promise<{ items: JobRoleDto[] }> {
  const pool = getPool();
  const [industry] = await pool.query(
    `SELECT code FROM industries WHERE code = ? AND is_active = TRUE LIMIT 1`,
    [industryCode],
  );
  if ((industry as IndustryRow[]).length === 0) {
    throw new HttpError(404, 'INDUSTRY_NOT_FOUND', 'Industry not found');
  }

  const [rows] = await pool.query(
    `SELECT jr.industry_code, jr.code, jr.name, req.keywords_json
     FROM job_roles jr
     LEFT JOIN job_requirements req
       ON req.industry_code = jr.industry_code AND req.job_role_code = jr.code
     WHERE jr.industry_code = ? AND jr.is_active = TRUE
     ORDER BY jr.sort_order, jr.code`,
    [industryCode],
  );

  const items = (rows as JobRoleRow[]).map((r) => ({
    code: r.code,
    industry_code: r.industry_code,
    name: r.name,
    competencies: competenciesFrom(r.keywords_json),
  }));
  return { items };
}
