import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { track } from '../lib/analytics.js';
import { runInference, type AiSource } from './ai/infer.js';
import { logger } from '../lib/logger.js';

// T032: 활동 기록 → 이력서/자소서/포트폴리오 자동 생성 (FR-008~009, US3)

export type DocType = 'resume' | 'coverletter' | 'portfolio';

export interface DocumentRow {
  id: number;
  doc_type: DocType;
  version: number;
  title: string;
  content: unknown;
  status: 'draft' | 'final';
  updated_at: string;
  // 003 US1(T018/T021): 생성 경로. AI 성공 시 'ai', 무키·실패·예산초과 시 'fallback_rule'.
  ai_source?: AiSource;
}

async function resolveStudentId(conn: PoolConnection, userId: number): Promise<number> {
  const [rows] = await conn.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  const row = (rows as Array<{ id: number }>)[0];
  if (!row) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile required');
  return row.id;
}

interface ActivityRow {
  category: string;
  title: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
}

async function loadActivities(conn: PoolConnection, studentId: number): Promise<ActivityRow[]> {
  const [rows] = await conn.query(
    `SELECT category, title, description,
            DATE_FORMAT(started_at, '%Y-%m-%d') AS started_at,
            DATE_FORMAT(ended_at, '%Y-%m-%d') AS ended_at,
            outcome
     FROM activities WHERE student_id = ? AND deleted_at IS NULL
     ORDER BY started_at DESC`,
    [studentId],
  );
  return rows as ActivityRow[];
}

function buildContent(docType: DocType, activities: ActivityRow[]): { title: string; content: unknown } {
  if (activities.length === 0) {
    throw new HttpError(422, 'NO_ACTIVITIES', '문서를 생성할 활동 기록이 없습니다. 먼저 활동을 추가하세요.');
  }
  const byCategory: Record<string, ActivityRow[]> = {};
  for (const a of activities) (byCategory[a.category] ??= []).push(a);

  if (docType === 'resume') {
    return {
      title: '이력서 (자동 생성)',
      content: {
        sections: Object.entries(byCategory).map(([category, items]) => ({
          category,
          entries: items.map((a) => ({
            title: a.title,
            period: `${a.started_at} ~ ${a.ended_at ?? '진행중'}`,
            outcome: a.outcome ?? '',
          })),
        })),
      },
    };
  }
  if (docType === 'portfolio') {
    return {
      title: '포트폴리오 (자동 생성)',
      content: {
        projects: (byCategory['project'] ?? []).map((a) => ({
          name: a.title,
          period: `${a.started_at} ~ ${a.ended_at ?? '진행중'}`,
          description: a.description ?? '',
          outcome: a.outcome ?? '',
        })),
        others: activities.filter((a) => a.category !== 'project').map((a) => a.title),
      },
    };
  }
  // coverletter
  const highlights = activities.slice(0, 3).map((a) => `${a.title}${a.outcome ? ` — ${a.outcome}` : ''}`);
  return {
    title: '자기소개서 초안 (자동 생성)',
    content: {
      intro: '저는 다양한 활동을 통해 직무 역량을 키워온 지원자입니다.',
      highlights,
      closing: '위 경험을 바탕으로 기여하겠습니다.',
    },
  };
}

// 003 US1(T018): 자기소개서 AI 생성. 활동 메타(제목·유형·성과)를 근거로 한국어 초안을 작성.
// 문서는 학생 본인의 산출물이므로 추천 게이트웨이와 달리 익명화하지 않는다(cohort 매칭 아님).
// 실패·무키·예산초과 시 null 을 돌려 호출부가 규칙 기반 buildContent 로 폴백한다.
async function buildCoverLetterWithAi(
  studentId: number,
  activities: ActivityRow[],
): Promise<{ title: string; content: unknown } | null> {
  try {
    const facts = activities.slice(0, 8).map((a) => ({
      category: a.category,
      title: a.title,
      outcome: a.outcome ?? '',
    }));
    const system =
      '당신은 한국 대학생의 자기소개서 작성을 돕는 코치입니다. ' +
      '입력으로 받은 활동 목록(유형·제목·성과)만 근거로, 과장 없이 ' +
      '{"intro": string, "highlights": string[], "closing": string} JSON 형식만 출력하세요. ' +
      'highlights 는 활동 기반 3~4개 한국어 문장.';
    const user = JSON.stringify({ activities: facts });
    const res = await runInference({ feature: 'document', subjectRef: studentId, system, user });
    if (res.source !== 'ai' || !res.text) return null;

    const start = res.text.indexOf('{');
    const end = res.text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(res.text.slice(start, end + 1)) as {
      intro?: unknown;
      highlights?: unknown;
      closing?: unknown;
    };
    const intro = typeof parsed.intro === 'string' ? parsed.intro.trim() : '';
    if (!intro) return null;
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((s): s is string => typeof s === 'string').slice(0, 4)
      : [];
    const closing = typeof parsed.closing === 'string' ? parsed.closing.trim() : '';
    return { title: '자기소개서 초안 (AI 생성)', content: { intro, highlights, closing } };
  } catch (err) {
    logger.warn({ err, studentId }, '[documents] AI cover letter failed — rule fallback');
    return null;
  }
}

export async function generateDocument(userId: number, docType: DocType): Promise<DocumentRow> {
  // 1) 읽기(활동) — 트랜잭션 밖. 외부 AI 호출이 DB 트랜잭션을 점유하지 않도록 분리.
  const conn = await getPool().getConnection();
  let studentId: number;
  let activities: ActivityRow[];
  try {
    studentId = await resolveStudentId(conn, userId);
    activities = await loadActivities(conn, studentId);
  } finally {
    conn.release();
  }

  // 2) 콘텐츠 결정: 자기소개서는 AI 우선, 그 외/실패 시 규칙 기반.
  let aiSource: AiSource = 'fallback_rule';
  let built = buildContent(docType, activities); // 활동 0건이면 여기서 422
  if (docType === 'coverletter') {
    const ai = await buildCoverLetterWithAi(studentId, activities);
    if (ai) {
      built = ai;
      aiSource = 'ai';
    }
  }
  const { title, content } = built;

  // 3) 쓰기 — 버전 계산 + INSERT 는 트랜잭션으로.
  return withTransaction(async (txConn) => {
    const [verRows] = await txConn.query(
      'SELECT COALESCE(MAX(version), 0) AS v FROM documents WHERE student_id = ? AND doc_type = ?',
      [studentId, docType],
    );
    const nextVersion = Number((verRows as Array<{ v: number | string }>)[0]!.v) + 1;

    const [ins] = await txConn.query(
      `INSERT INTO documents (student_id, doc_type, version, title, content_json, status)
       VALUES (?, ?, ?, ?, ?, 'draft')`,
      [studentId, docType, nextVersion, title, JSON.stringify(content)],
    );
    const id = (ins as { insertId: number }).insertId;
    await track(userId, 'document_generated', { doc_type: docType, ai_source: aiSource });

    return {
      id, doc_type: docType, version: nextVersion, title, content,
      status: 'draft', updated_at: '', ai_source: aiSource,
    };
  });
}

export async function listDocuments(userId: number): Promise<DocumentRow[]> {
  const conn = await getPool().getConnection();
  try {
    const studentId = await resolveStudentId(conn, userId);
    const [rows] = await conn.query(
      `SELECT id, doc_type, version, title, content_json,
              status, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updated_at
       FROM documents WHERE student_id = ?
       ORDER BY doc_type ASC, version DESC`,
      [studentId],
    );
    return (rows as Array<DocumentRow & { content_json: unknown }>).map((r) => ({
      id: r.id,
      doc_type: r.doc_type,
      version: r.version,
      title: r.title,
      content: typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json,
      status: r.status,
      updated_at: r.updated_at,
    }));
  } finally {
    conn.release();
  }
}

export async function updateDocument(
  userId: number,
  docId: number,
  patch: { title?: string; content?: unknown; status?: 'draft' | 'final' },
): Promise<DocumentRow> {
  return withTransaction(async (conn) => {
    const studentId = await resolveStudentId(conn, userId);
    const [own] = await conn.query(
      'SELECT id FROM documents WHERE id = ? AND student_id = ? LIMIT 1',
      [docId, studentId],
    );
    if (!(own as unknown[])[0]) throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');

    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title); }
    if (patch.content !== undefined) { sets.push('content_json = ?'); params.push(JSON.stringify(patch.content)); }
    if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status); }
    if (patch.status === 'final') await track(userId, 'portfolio_used', { document_id: docId });
    if (sets.length > 0) {
      params.push(docId);
      await conn.query(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    const [rows] = await conn.query(
      `SELECT id, doc_type, version, title, content_json, status,
              DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updated_at
       FROM documents WHERE id = ?`,
      [docId],
    );
    const r = (rows as Array<DocumentRow & { content_json: unknown }>)[0]!;
    return {
      id: r.id,
      doc_type: r.doc_type,
      version: r.version,
      title: r.title,
      content: typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json,
      status: r.status,
      updated_at: r.updated_at,
    };
  });
}

// 005 고도화: 자동 생성 문서 삭제(본인 소유만). documents 에 soft-delete 컬럼이 없어 하드 삭제.
export async function deleteDocument(userId: number, docId: number): Promise<void> {
  return withTransaction(async (conn) => {
    const studentId = await resolveStudentId(conn, userId);
    const [res] = await conn.query(
      'DELETE FROM documents WHERE id = ? AND student_id = ?',
      [docId, studentId],
    );
    if ((res as { affectedRows: number }).affectedRows === 0) {
      throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    }
  });
}
