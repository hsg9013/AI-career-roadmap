import type { PoolConnection } from 'mysql2/promise';
import { getPool, withTransaction } from '../../db/pool.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T047: 학생 프로필 + 목표 직무 (최대 3, FR-009) 서비스 레이어

export interface StudentProfile {
  id: number;
  user_id: number;
  university: string;
  major: string;
  year_in_school: number;
  expected_grad_at: string | null;
  school_email_verified: boolean;
}

interface StudentRow {
  id: number;
  user_id: number;
  university: string;
  major: string;
  year_in_school: number;
  expected_grad_at: string | null;
  school_email_verified: number;
}

function rowToProfile(row: StudentRow): StudentProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    university: row.university,
    major: row.major,
    year_in_school: row.year_in_school,
    expected_grad_at: row.expected_grad_at,
    school_email_verified: row.school_email_verified === 1,
  };
}

async function fetchStudentByUserId(
  conn: PoolConnection,
  userId: number,
): Promise<StudentRow | null> {
  // DATE 컬럼은 DATE_FORMAT 으로 문자열 직접 받기 — Date 객체로 받으면 timezone shift 로 하루 어긋남.
  const [rows] = await conn.query(
    `SELECT id, user_id, university, major, year_in_school,
            DATE_FORMAT(expected_grad_at, '%Y-%m-%d') AS expected_grad_at,
            school_email_verified
     FROM students
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );
  const arr = rows as StudentRow[];
  return arr[0] ?? null;
}

export async function getProfile(userId: number): Promise<StudentProfile> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const row = await fetchStudentByUserId(conn, userId);
    if (!row) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    return rowToProfile(row);
  } finally {
    conn.release();
  }
}

export interface UpdateProfileInput {
  university?: string;
  major?: string;
  year_in_school?: number;
  expected_grad_at?: string | null;
}

export async function updateProfile(
  userId: number,
  input: UpdateProfileInput,
): Promise<StudentProfile> {
  return withTransaction(async (conn) => {
    const existing = await fetchStudentByUserId(conn, userId);
    if (!existing) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');

    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.university !== undefined) {
      fields.push('university = ?');
      values.push(input.university);
    }
    if (input.major !== undefined) {
      fields.push('major = ?');
      values.push(input.major);
    }
    if (input.year_in_school !== undefined) {
      fields.push('year_in_school = ?');
      values.push(input.year_in_school);
    }
    if (input.expected_grad_at !== undefined) {
      fields.push('expected_grad_at = ?');
      values.push(input.expected_grad_at);
    }

    if (fields.length > 0) {
      values.push(existing.id);
      await conn.query(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const updated = await fetchStudentByUserId(conn, userId);
    return rowToProfile(updated as StudentRow);
  });
}

export interface TargetJob {
  id: number;
  industry_code: string;
  job_role_code: string;
  priority: number;
}

export async function listTargetJobs(userId: number): Promise<TargetJob[]> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const student = await fetchStudentByUserId(conn, userId);
    if (!student) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    const [rows] = await conn.query(
      `SELECT id, industry_code, job_role_code, priority
       FROM target_jobs
       WHERE student_id = ?
       ORDER BY priority ASC`,
      [student.id],
    );
    return rows as TargetJob[];
  } finally {
    conn.release();
  }
}

export interface TargetJobInput {
  industry_code: string;
  job_role_code: string;
  priority: number;
}

export async function replaceTargetJobs(
  userId: number,
  jobs: TargetJobInput[],
): Promise<TargetJob[]> {
  if (jobs.length > 3) {
    throw new HttpError(400, 'TARGET_JOB_LIMIT', 'Maximum 3 target jobs allowed (FR-009)');
  }

  // 우선순위·직무코드 중복 검사
  const priorities = new Set<number>();
  const roleKeys = new Set<string>();
  for (const j of jobs) {
    if (priorities.has(j.priority)) {
      throw new HttpError(400, 'DUPLICATE_PRIORITY', `Duplicated priority: ${j.priority}`);
    }
    priorities.add(j.priority);
    const key = `${j.industry_code}::${j.job_role_code}`;
    if (roleKeys.has(key)) {
      throw new HttpError(400, 'DUPLICATE_JOB', `Duplicated job role: ${key}`);
    }
    roleKeys.add(key);
  }

  return withTransaction(async (conn) => {
    const student = await fetchStudentByUserId(conn, userId);
    if (!student) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');

    await conn.query('DELETE FROM target_jobs WHERE student_id = ?', [student.id]);
    for (const j of jobs) {
      await conn.query(
        `INSERT INTO target_jobs (student_id, industry_code, job_role_code, priority)
         VALUES (?, ?, ?, ?)`,
        [student.id, j.industry_code, j.job_role_code, j.priority],
      );
    }

    const [rows] = await conn.query(
      `SELECT id, industry_code, job_role_code, priority
       FROM target_jobs
       WHERE student_id = ?
       ORDER BY priority ASC`,
      [student.id],
    );
    return rows as TargetJob[];
  });
}
