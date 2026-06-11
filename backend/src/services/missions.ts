import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { queues } from '../queues/index.js';
import { track } from '../lib/analytics.js';
import { logger } from '../lib/logger.js';
import { runInference } from './ai/infer.js';

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

// 004 US3/G2: 학생의 목표 직무에 맞는 미션을 반환한다.
// - userId 주어지면 학생의 최우선 목표 직무로 필터(없으면 전체 open).
// - 멘토 출제(created_by NOT NULL)를 기본 세트(created_by NULL)보다 우선 노출.
export async function listMissions(userId?: number): Promise<unknown[]> {
  const pool = getPool();

  let industryCode: string | null = null;
  let jobRoleCode: string | null = null;
  if (userId != null) {
    const conn = await pool.getConnection();
    try {
      const studentId = await resolveStudentId(conn, userId);
      const [tj] = await conn.query(
        `SELECT industry_code, job_role_code FROM target_jobs
         WHERE student_id = ? ORDER BY priority ASC, id ASC LIMIT 1`,
        [studentId],
      );
      const row = (tj as Array<{ industry_code: string; job_role_code: string }>)[0];
      if (row) {
        industryCode = row.industry_code;
        jobRoleCode = row.job_role_code;
      }
    } finally {
      conn.release();
    }
  }

  if (industryCode && jobRoleCode) {
    const [rows] = await pool.query(
      `SELECT id, title, industry_code, job_role_code, brief, status,
              (created_by IS NOT NULL) AS mentor_authored
       FROM missions
       WHERE status = 'open' AND industry_code = ? AND job_role_code = ?
       ORDER BY mentor_authored DESC, created_at DESC`,
      [industryCode, jobRoleCode],
    );
    return rows as unknown[];
  }

  const [rows] = await pool.query(
    `SELECT id, title, industry_code, job_role_code, brief, status,
            (created_by IS NOT NULL) AS mentor_authored
     FROM missions WHERE status = 'open' ORDER BY mentor_authored DESC, created_at DESC`,
  );
  return rows as unknown[];
}

// 규칙 기반 1차 피드백 — AI 미사용/실패 시 폴백(기존 휴리스틱 유지).
function ruleFeedback(content: string): string {
  const len = content.trim().length;
  const depth = len > 400 ? '충분한 분량으로 작성되었습니다.' : '핵심 근거와 예시를 더 보강하면 좋겠습니다.';
  return `[AI 1차 분석] 제출 내용 ${len}자. ${depth} 구조(문제정의→접근→결과)와 정량적 성과 표현을 점검하세요.`;
}

// 003 US1(T019): 미션 제출 1차 AI 피드백. 제출물은 학생 본인의 산출물 → 익명화하지 않음.
// HTTP 호출은 트랜잭션 밖에서 수행하고, 실패·무키·예산초과 시 규칙 기반으로 폴백한다.
async function aiFeedback(content: string, missionId: number): Promise<string> {
  try {
    const system =
      '당신은 한국 대학생의 미션 제출물을 1차로 검토하는 코치입니다. ' +
      '제출 내용을 근거로 강점 1가지와 개선점 2가지를 한국어로 간결히 제시하세요. ' +
      '반드시 {"feedback": string} JSON 형식만 출력하세요.';
    const user = JSON.stringify({ submission: content.slice(0, 4000) });
    const res = await runInference({ feature: 'mission_feedback', subjectRef: missionId, system, user });
    if (res.source === 'ai' && res.text) {
      const start = res.text.indexOf('{');
      const end = res.text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(res.text.slice(start, end + 1)) as { feedback?: unknown };
        const fb = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';
        if (fb) return `[AI 1차 분석] ${fb}`;
      }
    }
  } catch (err) {
    logger.warn({ err, missionId }, '[missions] AI feedback failed — rule fallback');
  }
  return ruleFeedback(content);
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
  // 1차 AI 피드백은 트랜잭션 밖에서 생성(외부 HTTP 가 DB 트랜잭션을 점유하지 않도록).
  const fb = await aiFeedback(content, missionId);

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

// 005 US4(H4): 현직자(멘토) 심층 코멘트 작성 — feedbacks(kind='mentor')로 저장하고
// review_assignment 를 completed 로 마감한다. 학생은 기존 getSubmissionFeedback 으로 결합 조회한다.
export async function addMentorFeedback(
  mentorUserId: number,
  submissionId: number,
  content: string,
): Promise<{ submission_id: number; kind: 'mentor'; content: string }> {
  return withTransaction(async (conn) => {
    const [mrows] = await conn.query('SELECT id FROM mentors WHERE user_id = ? LIMIT 1', [mentorUserId]);
    const mentorId = (mrows as Array<{ id: number }>)[0]?.id;
    if (!mentorId) throw new HttpError(403, 'NOT_A_MENTOR', '현직자(멘토) 계정만 코멘트를 작성할 수 있습니다.');

    const [srows] = await conn.query('SELECT id FROM submissions WHERE id = ? LIMIT 1', [submissionId]);
    if (!(srows as unknown[]).length) throw new HttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');

    await conn.query(
      `INSERT INTO feedbacks (submission_id, kind, mentor_id, content) VALUES (?, 'mentor', ?, ?)`,
      [submissionId, mentorId, content],
    );
    await conn.query(
      "UPDATE review_assignments SET status = 'completed' WHERE submission_id = ?",
      [submissionId],
    );
    await track(mentorUserId, 'mentor_feedback_added', { submission_id: submissionId });
    return { submission_id: submissionId, kind: 'mentor', content };
  });
}

// 005 US4(H4): 멘토에게 배정된(검수 대기) 제출물 목록 — 멘토가 코멘트를 달 대상.
export async function listMentorAssignments(mentorUserId: number): Promise<unknown[]> {
  const [rows] = await getPool().query(
    `SELECT s.id AS submission_id, s.content, s.state,
            m.title AS mission_title,
            ra.status AS review_status,
            DATE_FORMAT(ra.deadline, '%Y-%m-%dT%H:%i:%sZ') AS deadline
       FROM review_assignments ra
       JOIN mentors me ON me.id = ra.mentor_id
       JOIN submissions s ON s.id = ra.submission_id
       JOIN missions m ON m.id = s.mission_id
      WHERE me.user_id = ? AND ra.status IN ('pending')
      ORDER BY ra.deadline ASC
      LIMIT 50`,
    [mentorUserId],
  );
  return rows as unknown[];
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
