import { getPool } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';

// T045: 대학 학생 현황 — 동의 범위 서버측 강제 필터 (FR-014, R-4)
//   • 통계(집계)는 'aggregate_only' 또는 'individual' 동의 학생을 포함해 항상 제공
//   • 개인 단위 목록은 staff 권한='individual' AND 학생 동의='individual' 인 경우에만

export interface UniversityView {
  university_id: number;
  staff_scope: 'aggregate_only' | 'individual';
  stats: { total_consented: number; avg_diagnosis_score: number | null; by_major: Array<{ major: string; count: number }> };
  students: Array<{ student_id: number; major: string; year_in_school: number; latest_score: number | null }> | null;
}

async function resolveStaff(userId: number): Promise<{ university_id: number; scope_grant: 'aggregate_only' | 'individual' }> {
  const [rows] = await getPool().query(
    'SELECT university_id, scope_grant FROM university_staff WHERE user_id = ? LIMIT 1',
    [userId],
  );
  const row = (rows as Array<{ university_id: number; scope_grant: 'aggregate_only' | 'individual' }>)[0];
  if (!row) throw new HttpError(403, 'NOT_UNIVERSITY_STAFF', 'University staff record required');
  return row;
}

export async function getUniversityStudents(userId: number): Promise<UniversityView> {
  const staff = await resolveStaff(userId);
  const pool = getPool();

  // 통계: 'none' 미동의 제외
  const [statRows] = await pool.query(
    `SELECT COUNT(*) AS total,
            (SELECT COUNT(DISTINCT major) FROM students WHERE university_id = ? AND university_consent_scope <> 'none') AS majors
     FROM students WHERE university_id = ? AND university_consent_scope <> 'none'`,
    [staff.university_id, staff.university_id],
  );
  const total = Number((statRows as Array<{ total: number | string }>)[0]?.total ?? 0);

  const [byMajor] = await pool.query(
    `SELECT major, COUNT(*) AS count FROM students
     WHERE university_id = ? AND university_consent_scope <> 'none'
     GROUP BY major ORDER BY count DESC`,
    [staff.university_id],
  );

  const [avgRows] = await pool.query(
    `SELECT AVG(g.overall_score) AS avg_score FROM (
       SELECT gd.student_id, MAX(gd.computed_at) AS latest
       FROM gap_diagnoses gd
       JOIN students s ON s.id = gd.student_id
       WHERE s.university_id = ? AND s.university_consent_scope <> 'none'
       GROUP BY gd.student_id
     ) latest_per_student
     JOIN gap_diagnoses g ON g.student_id = latest_per_student.student_id AND g.computed_at = latest_per_student.latest`,
    [staff.university_id],
  );
  const avgScore = (avgRows as Array<{ avg_score: number | string | null }>)[0]?.avg_score;

  let students: UniversityView['students'] = null;
  if (staff.scope_grant === 'individual') {
    const [indRows] = await pool.query(
      `SELECT s.id AS student_id, s.major, s.year_in_school,
              (SELECT g.overall_score FROM gap_diagnoses g
               WHERE g.student_id = s.id ORDER BY g.computed_at DESC LIMIT 1) AS latest_score
       FROM students s
       WHERE s.university_id = ? AND s.university_consent_scope = 'individual'
       ORDER BY s.id ASC`,
      [staff.university_id],
    );
    students = (indRows as Array<{ student_id: number; major: string; year_in_school: number; latest_score: number | string | null }>).map((r) => ({
      student_id: r.student_id,
      major: r.major,
      year_in_school: r.year_in_school,
      latest_score: r.latest_score === null ? null : Number(r.latest_score),
    }));
  }

  return {
    university_id: staff.university_id,
    staff_scope: staff.scope_grant,
    stats: {
      total_consented: total,
      avg_diagnosis_score: avgScore === null || avgScore === undefined ? null : Number(Number(avgScore).toFixed(2)),
      by_major: (byMajor as Array<{ major: string; count: number | string }>).map((r) => ({ major: r.major, count: Number(r.count) })),
    },
    students,
  };
}
