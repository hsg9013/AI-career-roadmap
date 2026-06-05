import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../../db/pool.js';
import { HttpError } from '../../middlewares/errorHandler.js';
import { queues } from '../../queues/index.js';

// T048: 활동(activities) CRUD + 페이징 + 수동 태그
// 자동 태깅은 비동기 큐(recommendation-precompute) 로 enqueue 만 한다.

export const ACTIVITY_CATEGORIES = [
  'course',
  'project',
  'club',
  'volunteer',
  'contest',
  'external',
  'internship',
  'award',
  'certification',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface ActivityTag {
  tag: string;
  source: 'auto' | 'user';
  weight: number | null;
}

export interface Activity {
  id: number;
  category: ActivityCategory;
  title: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
  tags: ActivityTag[];
}

interface ActivityRow {
  id: number;
  student_id: number;
  category: ActivityCategory;
  title: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
}

interface ActivityTagRow {
  activity_id: number;
  tag: string;
  source: 'auto' | 'user';
  weight: string | null;
}

async function studentIdForUser(conn: PoolConnection, userId: number): Promise<number> {
  const [rows] = await conn.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  const arr = rows as Array<{ id: number }>;
  if (!arr[0]) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  return arr[0].id;
}

async function fetchTags(conn: PoolConnection, activityIds: number[]): Promise<Map<number, ActivityTag[]>> {
  const map = new Map<number, ActivityTag[]>();
  if (activityIds.length === 0) return map;
  const placeholders = activityIds.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT activity_id, tag, source, weight FROM activity_tags WHERE activity_id IN (${placeholders})`,
    activityIds,
  );
  for (const r of rows as ActivityTagRow[]) {
    const list = map.get(r.activity_id) ?? [];
    list.push({
      tag: r.tag,
      source: r.source,
      weight: r.weight === null ? null : Number(r.weight),
    });
    map.set(r.activity_id, list);
  }
  return map;
}

function rowToActivity(row: ActivityRow, tags: ActivityTag[]): Activity {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    started_at: row.started_at,
    ended_at: row.ended_at,
    outcome: row.outcome,
    tags,
  };
}

const SELECT_ACTIVITY_COLS = `
  a.id, a.student_id, a.category, a.title, a.description,
  DATE_FORMAT(a.started_at, '%Y-%m-%d') AS started_at,
  DATE_FORMAT(a.ended_at, '%Y-%m-%d')   AS ended_at,
  a.outcome
`;

export interface ListOptions {
  category?: ActivityCategory;
  page: number;
  pageSize: number;
}

export interface ListResult {
  items: Activity[];
  pagination: { page: number; page_size: number; total: number };
}

export async function listActivities(userId: number, opts: ListOptions): Promise<ListResult> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const studentId = await studentIdForUser(conn, userId);
    const where: string[] = ['a.student_id = ?', 'a.deleted_at IS NULL'];
    const params: unknown[] = [studentId];
    if (opts.category) {
      where.push('a.category = ?');
      params.push(opts.category);
    }

    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM activities a WHERE ${where.join(' AND ')}`,
      params,
    );
    const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

    const offset = (opts.page - 1) * opts.pageSize;
    const [rows] = await conn.query(
      `SELECT ${SELECT_ACTIVITY_COLS}
       FROM activities a
       WHERE ${where.join(' AND ')}
       ORDER BY a.started_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, opts.pageSize, offset],
    );
    const activityRows = rows as ActivityRow[];
    const tagMap = await fetchTags(conn, activityRows.map((r) => r.id));

    const items = activityRows.map((r) => rowToActivity(r, tagMap.get(r.id) ?? []));
    return {
      items,
      pagination: { page: opts.page, page_size: opts.pageSize, total },
    };
  } finally {
    conn.release();
  }
}

export interface ActivityInput {
  category: ActivityCategory;
  title: string;
  description?: string | null;
  started_at: string;
  ended_at?: string | null;
  outcome?: string | null;
  manual_tags?: string[];
}

async function fetchActivity(
  conn: PoolConnection,
  studentId: number,
  activityId: number,
): Promise<Activity | null> {
  const [rows] = await conn.query(
    `SELECT ${SELECT_ACTIVITY_COLS}
     FROM activities a
     WHERE a.id = ? AND a.student_id = ? AND a.deleted_at IS NULL
     LIMIT 1`,
    [activityId, studentId],
  );
  const arr = rows as ActivityRow[];
  if (!arr[0]) return null;
  const tagMap = await fetchTags(conn, [arr[0].id]);
  return rowToActivity(arr[0], tagMap.get(arr[0].id) ?? []);
}

async function upsertManualTags(
  conn: PoolConnection,
  activityId: number,
  tags: string[] | undefined,
): Promise<void> {
  if (!tags || tags.length === 0) return;
  const uniq = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  for (const tag of uniq) {
    await conn.query(
      `INSERT IGNORE INTO activity_tags (activity_id, tag, source, weight)
       VALUES (?, ?, 'user', NULL)`,
      [activityId, tag],
    );
  }
}

async function enqueueAutoTagging(activityId: number, studentId: number): Promise<void> {
  // 자동 태깅 워커는 후속 태스크에서 구현. 현재는 enqueue 만 시도하고 실패는 무시.
  try {
    await queues.recommendationPrecompute.add('auto-tag-activity', {
      activityId,
      studentId,
      ts: Date.now(),
    });
  } catch {
    // 큐가 다운되어도 활동 등록은 성공으로 처리한다.
  }
}

export async function createActivity(userId: number, input: ActivityInput): Promise<Activity> {
  return withTransaction(async (conn) => {
    const studentId = await studentIdForUser(conn, userId);
    const [insert] = await conn.query(
      `INSERT INTO activities (student_id, category, title, description, started_at, ended_at, outcome, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')`,
      [
        studentId,
        input.category,
        input.title,
        input.description ?? null,
        input.started_at,
        input.ended_at ?? null,
        input.outcome ?? null,
      ],
    );
    const id = (insert as { insertId: number }).insertId;
    await upsertManualTags(conn, id, input.manual_tags);
    const created = await fetchActivity(conn, studentId, id);
    if (!created) throw new HttpError(500, 'INTERNAL_ERROR', 'Failed to fetch created activity');
    void enqueueAutoTagging(id, studentId);
    return created;
  });
}

export async function patchActivity(
  userId: number,
  activityId: number,
  input: Partial<ActivityInput>,
): Promise<Activity> {
  return withTransaction(async (conn) => {
    const studentId = await studentIdForUser(conn, userId);
    const existing = await fetchActivity(conn, studentId, activityId);
    if (!existing) throw new HttpError(404, 'ACTIVITY_NOT_FOUND', 'Activity not found');

    const fields: string[] = [];
    const values: unknown[] = [];
    const setIf = <K extends keyof ActivityInput>(key: K, col: string): void => {
      if (input[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(input[key]);
      }
    };
    setIf('category', 'category');
    setIf('title', 'title');
    setIf('description', 'description');
    setIf('started_at', 'started_at');
    setIf('ended_at', 'ended_at');
    setIf('outcome', 'outcome');

    if (fields.length > 0) {
      values.push(activityId);
      await conn.query(`UPDATE activities SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (input.manual_tags !== undefined) {
      await conn.query(`DELETE FROM activity_tags WHERE activity_id = ? AND source = 'user'`, [
        activityId,
      ]);
      await upsertManualTags(conn, activityId, input.manual_tags);
    }

    const updated = await fetchActivity(conn, studentId, activityId);
    if (!updated) throw new HttpError(500, 'INTERNAL_ERROR', 'Failed to fetch updated activity');
    void enqueueAutoTagging(activityId, studentId);
    return updated;
  });
}

export async function deleteActivity(userId: number, activityId: number): Promise<void> {
  return withTransaction(async (conn) => {
    const studentId = await studentIdForUser(conn, userId);
    const [result] = await conn.query(
      `UPDATE activities SET deleted_at = NOW()
       WHERE id = ? AND student_id = ? AND deleted_at IS NULL`,
      [activityId, studentId],
    );
    const affected = (result as { affectedRows: number }).affectedRows;
    if (affected === 0) throw new HttpError(404, 'ACTIVITY_NOT_FOUND', 'Activity not found');
  });
}
