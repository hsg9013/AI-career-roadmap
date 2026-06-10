import '../src/config/dotenv.js';
import bcrypt from 'bcrypt';
import { getPool, closePool } from '../src/db/pool.js';

// 004 시연용 데모 계정 시드 (멱등). 비밀번호 공통: demo1234!
//   실행: pnpm --filter backend exec tsx scripts/seed-demo-accounts.ts
// 익명 합격경로 표본(seed-alumni-samples)과 달리, 이건 로그인 가능한 역할별 계정이다.

const PASSWORD = 'demo1234!';

async function upsertUser(email: string, role: string): Promise<number> {
  const pool = getPool();
  const hash = await bcrypt.hash(PASSWORD, 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, email_verified, is_active)
     VALUES (?, ?, ?, 1, 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), is_active = 1`,
    [email, hash, role],
  );
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  return (rows as Array<{ id: number }>)[0]!.id;
}

async function ensureStudent(
  userId: number,
  opts: { university: string; major: string; year: number; industry: string; job: string; consentAds?: boolean },
): Promise<number> {
  const pool = getPool();
  const [ex] = await pool.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  let studentId = (ex as Array<{ id: number }>)[0]?.id;
  if (!studentId) {
    const [ins] = await pool.query(
      `INSERT INTO students (user_id, university, major, year_in_school) VALUES (?, ?, ?, ?)`,
      [userId, opts.university, opts.major, opts.year],
    );
    studentId = (ins as { insertId: number }).insertId;
  }
  // 목표 직무(멱등: 재설정)
  await pool.query('DELETE FROM target_jobs WHERE student_id = ?', [studentId]);
  await pool.query(
    `INSERT INTO target_jobs (student_id, industry_code, job_role_code, priority) VALUES (?, ?, ?, 1)`,
    [studentId, opts.industry, opts.job],
  );
  // 활동·스펙 샘플(없을 때만)
  const [actCnt] = await pool.query('SELECT COUNT(*) c FROM activities WHERE student_id = ?', [studentId]);
  if (Number((actCnt as Array<{ c: number }>)[0]?.c ?? 0) === 0) {
    await pool.query(
      `INSERT INTO activities (student_id, category, title, started_at, source) VALUES
        (?, 'project', '캡스톤 프로젝트', '2025-03-02', 'manual'),
        (?, 'certification', 'SQLD', '2025-06-01', 'manual'),
        (?, 'internship', '백엔드 인턴 3개월', '2025-07-01', 'manual')`,
      [studentId, studentId, studentId],
    );
  }
  // 광고/매칭 동의(데모 노출용)
  if (opts.consentAds) {
    await pool.query(
      `INSERT INTO job_match_consents (student_id, opted_in) VALUES (?, 1)
       ON DUPLICATE KEY UPDATE opted_in = 1`,
      [studentId],
    );
  }
  return studentId;
}

async function ensureMentor(userId: number, expertise: string): Promise<void> {
  const pool = getPool();
  const [ex] = await pool.query('SELECT id FROM mentors WHERE user_id = ? LIMIT 1', [userId]);
  if (!(ex as unknown[]).length) {
    await pool.query(
      `INSERT INTO mentors (user_id, expertise, mentor_track, verified) VALUES (?, ?, ?, 1)`,
      [userId, expertise, 'flat'],
    );
  } else {
    await pool.query('UPDATE mentors SET verified = 1 WHERE user_id = ?', [userId]);
  }
}

async function main(): Promise<void> {
  const created: string[] = [];

  // 학생 3
  const s1 = await upsertUser('demo-student-backend@p16.local', 'student');
  await ensureStudent(s1, { university: '데모대학교', major: '컴퓨터공학', year: 4, industry: 'IT', job: 'backend', consentAds: true });
  created.push('demo-student-backend@p16.local  (학생 · IT/backend · 광고동의)');

  const s2 = await upsertUser('demo-student-frontend@p16.local', 'student');
  await ensureStudent(s2, { university: '데모대학교', major: '소프트웨어', year: 3, industry: 'IT', job: 'frontend' });
  created.push('demo-student-frontend@p16.local (학생 · IT/frontend)');

  const s3 = await upsertUser('demo-student-quant@p16.local', 'student');
  await ensureStudent(s3, { university: '데모대학교', major: '경제학', year: 4, industry: 'FIN', job: 'quant' });
  created.push('demo-student-quant@p16.local    (학생 · FIN/quant)');

  // 멘토(현직자) 2 — verified
  const m1 = await upsertUser('demo-mentor-backend@p16.local', 'mentor');
  await ensureMentor(m1, 'backend');
  created.push('demo-mentor-backend@p16.local   (멘토 · 백엔드 · verified)');

  const m2 = await upsertUser('demo-mentor-data@p16.local', 'mentor');
  await ensureMentor(m2, 'data');
  created.push('demo-mentor-data@p16.local      (멘토 · 데이터 · verified)');

  // 대학(B2G) / 기업(B2B)
  await upsertUser('demo-university@p16.local', 'university');
  created.push('demo-university@p16.local       (대학 취업지원센터)');
  await upsertUser('demo-enterprise@p16.local', 'enterprise');
  created.push('demo-enterprise@p16.local       (기업 인재검색)');

  console.log('\n=== 데모 계정 생성 완료 (공통 비밀번호: ' + PASSWORD + ') ===');
  for (const c of created) console.log('  • ' + c);
  console.log('\n(관리자: admin@p16.local / admin1234! — 기존 seed:admin)');
  await closePool();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('[seed-demo-accounts] error:', e);
  await closePool().catch(() => {});
  process.exit(1);
});
