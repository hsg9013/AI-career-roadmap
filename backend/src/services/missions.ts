import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { queues } from '../queues/index.js';
import { track } from '../lib/analytics.js';
import { logger } from '../lib/logger.js';

// T036/T037: 미션 제출 + AI 1차 피드백 + 현직자 검수 SLA(5영업일) (FR-010~012, R-8)

const REVIEW_SLA_BUSINESS_DAYS = 5;

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d;
}

async function resolveStudentId(conn: PoolConnection, userId: number): Promise<number> {
  const [rows] = await conn.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  const row = (rows as Array<{ id: number }>)[0];
  if (!row) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile required');
  return row.id;
}

export async function listMissions(): Promise<unknown[]> {
  const [rows] = await getPool().query(
    `SELECT id, title, industry_code, job_role_code, brief, status
     FROM missions WHERE status = 'open' ORDER BY created_at DESC`,
  );
  return rows as unknown[];
}

function aiFeedback(content: string): string {
  const len = content.trim().length;
  const depth = len > 400 ? '충분한 분량으로 작성되었습니다.' : '핵심 근거와 예시를 더 보강하면 좋겠습니다.';
  return `[AI 1차 분석] 제출 내용 ${len}자. ${depth} 구조(문제정의→접근→결과)와 정량적 성과 표현을 점검하세요.`;
}

export interface SubmitResult {
  submission_id: number;
  state: string;
  deadline: string;
  ai_feedback: string;
}

export async function submitMission(
  userId: number,
  missionId: number,
  content: string,
  storageKey?: string,
): Promise<SubmitResult> {
  return withTransaction(async (conn) => {
    const studentId = await resolveStudentId(conn, userId);
    const [m] = await conn.query("SELECT id FROM missions WHERE id = ? AND status = 'open' LIMIT 1", [missionId]);
    if (!(m as unknown[])[0]) throw new HttpError(404, 'MISSION_NOT_FOUND', 'Mission not found or closed');

    const [ins] = await conn.query(
      `INSERT INTO submissions (mission_id, student_id, storage_key, content, state)
       VALUES (?, ?, ?, ?, 'ai_reviewed')`,
      [missionId, studentId, storageKey ?? null, content],
    );
    const submissionId = (ins as { insertId: number }).insertId;

    const fb = aiFeedback(content);
    await conn.query(
      "INSERT INTO feedbacks (submission_id, kind, content) VALUES (?, 'ai', ?)",
      [submissionId, fb],
    );

    // 현직자 배정 + 5영업일 데드라인. 가용 멘토 자동 배정(있으면).
    const [mentorRows] = await conn.query('SELECT id FROM mentors WHERE verified = 1 ORDER BY RAND() LIMIT 1');
    const mentorId = (mentorRows as Array<{ id: number }>)[0]?.id ?? null;
    const deadline = addBusinessDays(new Date(), REVIEW_SLA_BUSINESS_DAYS);
    await conn.query(
      `INSERT INTO review_assignments (submission_id, mentor_id, deadline, status)
       VALUES (?, ?, ?, 'pending')`,
      [submissionId, mentorId, deadline],
    );
    await conn.query("UPDATE submissions SET state = 'assigned' WHERE id = ?", [submissionId]);

    // SLA 만료 시 재배정/AI 대체를 위한 지연 잡 등록 (best-effort)
    const delayMs = Math.max(0, deadline.getTime() - Date.now());
    try {
      await queues.missionReview.add('sla-check', { submissionId }, { delay: delayMs, removeOnComplete: true });
    } catch (err) {
      logger.warn({ err, submissionId }, '[missions] failed to enqueue SLA job (non-blocking)');
    }

    await track(userId, 'mission_submitted', { mission_id: missionId });
    return { submission_id: submissionId, state: 'assigned', deadline: deadline.toISOString(), ai_feedback: fb };
  });
}

export async function getSubmissionFeedback(userId: number, submissionId: number): Promise<unknown> {
  const conn = await getPool().getConnection();
  try {
    const [own] = await conn.query(
      `SELECT s.id, s.state, ra.status AS review_status,
              DATE_FORMAT(ra.deadline, '%Y-%m-%dT%H:%i:%sZ') AS deadline
       FROM submissions s
       JOIN students st ON st.id = s.student_id
       LEFT JOIN review_assignments ra ON ra.submission_id = s.id
       WHERE s.id = ? AND st.user_id = ? LIMIT 1`,
      [submissionId, userId],
    );
    const sub = (own as Array<{ id: number; state: string; review_status: string | null; deadline: string | null }>)[0];
    if (!sub) throw new HttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found for this user');

    const [fbs] = await conn.query(
      `SELECT kind, mentor_id, content, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
       FROM feedbacks WHERE submission_id = ? ORDER BY created_at ASC`,
      [submissionId],
    );
    return { submission: sub, feedbacks: fbs };
  } finally {
    conn.release();
  }
}

// 워커 진입점: SLA 만료 처리 — 미완료면 재배정 시도, 실패 시 AI 대체 (FR-012)
export async function processReviewSla(submissionId: number): Promise<void> {
  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      "SELECT id, mentor_id, status FROM review_assignments WHERE submission_id = ? LIMIT 1",
      [submissionId],
    );
    const ra = (rows as Array<{ id: number; mentor_id: number | null; status: string }>)[0];
    if (!ra || ra.status !== 'pending') return; // 이미 완료/처리됨

    const [other] = await conn.query(
      'SELECT id FROM mentors WHERE verified = 1 AND (? IS NULL OR id <> ?) ORDER BY RAND() LIMIT 1',
      [ra.mentor_id, ra.mentor_id],
    );
    const altMentor = (other as Array<{ id: number }>)[0]?.id ?? null;

    if (altMentor) {
      await conn.query("UPDATE review_assignments SET mentor_id = ?, status = 'reassigned' WHERE id = ?", [altMentor, ra.id]);
      await conn.query("UPDATE submissions SET state = 'reassigned' WHERE id = ?", [submissionId]);
    } else {
      await conn.query(
        "INSERT INTO feedbacks (submission_id, kind, content) VALUES (?, 'ai', ?)",
        [submissionId, '[AI 대체 피드백] 검수 기한 내 멘토 배정이 어려워 AI 심화 피드백으로 대체합니다.'],
      );
      await conn.query("UPDATE review_assignments SET status = 'ai_fallback' WHERE id = ?", [ra.id]);
      await conn.query("UPDATE submissions SET state = 'ai_fallback' WHERE id = ?", [submissionId]);
    }
  });
}
