import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { track } from '../lib/analytics.js';

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

export async function generateDocument(userId: number, docType: DocType): Promise<DocumentRow> {
  return withTransaction(async (conn) => {
    const studentId = await resolveStudentId(conn, userId);
    const activities = await loadActivities(conn, studentId);
    const { title, content } = buildContent(docType, activities);

    const [verRows] = await conn.query(
      'SELECT COALESCE(MAX(version), 0) AS v FROM documents WHERE student_id = ? AND doc_type = ?',
      [studentId, docType],
    );
    const nextVersion = Number((verRows as Array<{ v: number | string }>)[0]!.v) + 1;

    const [ins] = await conn.query(
      `INSERT INTO documents (student_id, doc_type, version, title, content_json, status)
       VALUES (?, ?, ?, ?, ?, 'draft')`,
      [studentId, docType, nextVersion, title, JSON.stringify(content)],
    );
    const id = (ins as { insertId: number }).insertId;
    await track(userId, 'document_generated', { doc_type: docType });

    return { id, doc_type: docType, version: nextVersion, title, content, status: 'draft', updated_at: '' };
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
