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

export interface JobRoleNameDto {
  code: string;
  industry_code: string;
  name: string;
}

// 014: 전체 직무(코드→한글명) 1회 조회. 프론트 라벨 매핑용(대시보드/로드맵/미션이 코드 대신 한글 표시).
export async function listAllJobRoles(): Promise<{ items: JobRoleNameDto[] }> {
  const [rows] = await getPool().query(
    `SELECT industry_code, code, name FROM job_roles WHERE is_active = TRUE
     ORDER BY industry_code, sort_order, code`,
  );
  const items = (rows as Array<{ industry_code: string; code: string; name: string }>).map((r) => ({
    code: r.code,
    industry_code: r.industry_code,
    name: r.name,
  }));
  return { items };
}

// 005: 목표직무 코드 유효성 — 카탈로그(활성 산업·직무)에 존재하는 조합인지 확인.
// 존재하지 않는 임의 코드('sfsdfds' 등)로 목표직무·로드맵이 생성되는 것을 막는다.
export async function jobRoleExists(industryCode: string, jobRoleCode: string): Promise<boolean> {
  const [rows] = await getPool().query(
    `SELECT 1 FROM job_roles jr
       JOIN industries i ON i.code = jr.industry_code
      WHERE jr.industry_code = ? AND jr.code = ? AND jr.is_active = TRUE AND i.is_active = TRUE
      LIMIT 1`,
    [industryCode, jobRoleCode],
  );
  return (rows as unknown[]).length > 0;
}

export async function assertValidJobRole(industryCode: string, jobRoleCode: string): Promise<void> {
  if (!(await jobRoleExists(industryCode, jobRoleCode))) {
    throw new HttpError(
      400,
      'INVALID_TARGET_JOB',
      `존재하지 않는 산업·직무입니다: ${industryCode}/${jobRoleCode}`,
    );
  }
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
