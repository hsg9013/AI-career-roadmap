import '../src/config/dotenv.js';
import bcrypt from 'bcrypt';
import { getPool, closePool } from '../src/db/pool.js';

// 데모 시나리오 완비 — 가상 데이터 시딩(멱등). seed:005 이후 실행 권장.
//  1) 대학 대시보드: 데모 대학 계정↔대학(university_staff, individual) 연결 + 동의 학생 시딩.
//  2) 기업 인재검색: 전 산업/직무 조합별 4명의 매칭동의(opted_in) 가상 인재 + 진단 점수.
//  3) 멘토↔학생 매핑: 데모 학생 제출물 → 데모 멘토 검수 배정(pending) 1건.
//  실행: pnpm --filter backend exec tsx scripts/seed-demo-scenario.ts

const MOCK_DOMAIN = 'mock.demo.local';
const PER_COMBO = 4;
const MAJORS = [
  '컴퓨터공학', '소프트웨어학', '경영학', '산업디자인', '전자공학',
  '경제학', '심리학', '신문방송학', '기계공학', '응용통계학',
];
// 조합당 동의 범위(대학) 분포: 2 집계 + 1 개인 + 1 미동의 → 필터 동작까지 시연.
const SCOPES = ['aggregate_only', 'individual', 'aggregate_only', 'none'] as const;

async function scalarId(sql: string, params: unknown[] = []): Promise<number | undefined> {
  const [rows] = await getPool().query(sql, params);
  return (rows as Array<{ id: number }>)[0]?.id;
}

async function main(): Promise<void> {
  const pool = getPool();

  // ── 1) 데모 대학 + staff 연결 ──
  await pool.query(`INSERT INTO universities (name) VALUES ('데모대학교') ON DUPLICATE KEY UPDATE name = name`);
  const universityId = (await scalarId(`SELECT id FROM universities WHERE name = '데모대학교' LIMIT 1`))!;
  const uniUserId = await scalarId(`SELECT id FROM users WHERE email = 'demo-university@p16.local' LIMIT 1`);
  if (uniUserId) {
    await pool.query(
      `INSERT INTO university_staff (user_id, university_id, scope_grant) VALUES (?, ?, 'individual')
       ON DUPLICATE KEY UPDATE university_id = VALUES(university_id), scope_grant = 'individual'`,
      [uniUserId, universityId],
    );
  }

  // ── 2) 전 직무 조합 × PER_COMBO 가상 인재 ──
  const [roleRows] = await pool.query(
    `SELECT industry_code, code FROM job_roles WHERE is_active = TRUE ORDER BY industry_code, code`,
  );
  const combos = roleRows as Array<{ industry_code: string; code: string }>;
  let createdStudents = 0;
  let createdDiag = 0;
  let idx = 0;

  for (const { industry_code, code } of combos) {
    for (let n = 1; n <= PER_COMBO; n++) {
      idx++;
      const email = `mock-${industry_code}-${code}-${n}@${MOCK_DOMAIN}`.toLowerCase();
      const scope = SCOPES[(n - 1) % SCOPES.length];
      const major = MAJORS[idx % MAJORS.length]!;
      const year = (idx % 4) + 1;

      let userId = await scalarId('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (!userId) {
        const [ins] = await pool.query(
          `INSERT INTO users (email, password_hash, role, email_verified, is_active)
           VALUES (?, NULL, 'student', 1, 1)`,
          [email],
        );
        userId = (ins as { insertId: number }).insertId;
      }

      let studentId = await scalarId('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
      if (!studentId) {
        const [ins] = await pool.query(
          `INSERT INTO students (user_id, university, major, year_in_school, university_id, university_consent_scope)
           VALUES (?, '데모대학교', ?, ?, ?, ?)`,
          [userId, major, year, universityId, scope],
        );
        studentId = (ins as { insertId: number }).insertId;
        createdStudents++;
      } else {
        await pool.query(
          'UPDATE students SET university_id = ?, university_consent_scope = ? WHERE id = ?',
          [universityId, scope, studentId],
        );
      }

      let targetJobId = await scalarId(
        'SELECT id FROM target_jobs WHERE student_id = ? AND industry_code = ? AND job_role_code = ? LIMIT 1',
        [studentId, industry_code, code],
      );
      if (!targetJobId) {
        const [ins] = await pool.query(
          `INSERT INTO target_jobs (student_id, industry_code, job_role_code, priority) VALUES (?, ?, ?, 1)`,
          [studentId, industry_code, code],
        );
        targetJobId = (ins as { insertId: number }).insertId;
      }

      // 기업 인재검색 노출 동의(전원)
      await pool.query(
        `INSERT INTO job_match_consents (student_id, opted_in) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE opted_in = 1`,
        [studentId],
      );

      // 진단 점수(없을 때만) — 55~92 결정적 분포
      const hasDiag = await scalarId(
        'SELECT id FROM gap_diagnoses WHERE student_id = ? AND target_job_id = ? LIMIT 1',
        [studentId, targetJobId],
      );
      if (!hasDiag) {
        const score = 55 + ((idx * 7) % 38);
        await pool.query(
          `INSERT INTO gap_diagnoses (student_id, target_job_id, overall_score, payload_json, model_version)
           VALUES (?, ?, ?, ?, 'rule-1.0')`,
          [studentId, targetJobId, score, JSON.stringify({ fulfilled: [], missing: [], priority_to_improve: [] })],
        );
        createdDiag++;
      }
    }
  }

  // ── 데모 학생 3명도 대학/매칭 동의에 편입(로그인 가능 계정이 검색·통계에 보이도록) ──
  for (const email of [
    'demo-student-backend@p16.local',
    'demo-student-frontend@p16.local',
    'demo-student-quant@p16.local',
  ]) {
    const sid = await scalarId(
      'SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = ? LIMIT 1',
      [email],
    );
    if (sid) {
      await pool.query(
        "UPDATE students SET university_id = ?, university_consent_scope = 'individual' WHERE id = ?",
        [universityId, sid],
      );
      await pool.query(
        `INSERT INTO job_match_consents (student_id, opted_in) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE opted_in = 1`,
        [sid],
      );
    }
  }

  // ── 3) 멘토↔학생 매핑: demo-student-backend 제출물 → demo-mentor-backend 검수(pending) ──
  const demoStudentId = await scalarId(
    `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = 'demo-student-backend@p16.local' LIMIT 1`,
  );
  const demoMentorId = await scalarId(
    `SELECT m.id FROM mentors m JOIN users u ON u.id = m.user_id WHERE u.email = 'demo-mentor-backend@p16.local' LIMIT 1`,
  );
  let mappingMsg = 'skipped (계정 없음)';
  if (demoStudentId && demoMentorId) {
    const existing = await scalarId(
      `SELECT ra.id FROM review_assignments ra JOIN submissions sub ON sub.id = ra.submission_id
       WHERE sub.student_id = ? AND ra.mentor_id = ? AND ra.status = 'pending' LIMIT 1`,
      [demoStudentId, demoMentorId],
    );
    if (existing) {
      mappingMsg = `이미 매핑됨 (assignment ${existing})`;
    } else {
      const missionId = await scalarId(
        `SELECT id FROM missions WHERE status = 'open' AND industry_code = 'IT' AND job_role_code = 'backend' ORDER BY id LIMIT 1`,
      );
      if (missionId) {
        const [subIns] = await pool.query(
          `INSERT INTO submissions (mission_id, student_id, storage_key, content, state)
           VALUES (?, ?, '', ?, 'assigned')`,
          [missionId, demoStudentId, '[데모] 백엔드 REST API 설계 제출물 — 인증·페이지네이션·에러 응답 표준화를 포함했습니다.'],
        );
        const submissionId = (subIns as { insertId: number }).insertId;
        await pool.query(
          `INSERT INTO feedbacks (submission_id, kind, content) VALUES (?, 'ai', ?)`,
          [submissionId, '[AI 1차 피드백] 계층 분리·입력 검증이 양호합니다. 에러 응답 포맷 일관성을 보완하세요.'],
        );
        const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        await pool.query(
          `INSERT INTO review_assignments (submission_id, mentor_id, deadline, status) VALUES (?, ?, ?, 'pending')`,
          [submissionId, demoMentorId, deadline],
        );
        mappingMsg = `submission ${submissionId} → mentor ${demoMentorId} (pending, 마감 ${deadline.toISOString().slice(0, 10)})`;
      } else {
        mappingMsg = 'skipped (open 백엔드 미션 없음)';
      }
    }
  }

  // ── 데모 멘토 '출제 미션' 시딩: IT/backend 미션 2개의 created_by 를 데모 멘토 user_id 로 지정 ──
  const demoMentorUserId = await scalarId(
    `SELECT id FROM users WHERE email = 'demo-mentor-backend@p16.local' LIMIT 1`,
  );
  let authoredMsg = 'skipped';
  if (demoMentorUserId) {
    const [upd] = await pool.query(
      `UPDATE missions SET created_by = ?
       WHERE id IN (
         SELECT id FROM (
           SELECT id FROM missions WHERE industry_code = 'IT' AND job_role_code = 'backend'
           ORDER BY id LIMIT 2
         ) t
       )`,
      [demoMentorUserId],
    );
    authoredMsg = `IT/backend 미션 ${(upd as { affectedRows: number }).affectedRows}개 → 데모 멘토 출제로 지정`;
  }

  // ── 교육·활동 플랫폼 데모 제휴사(로그인·승인 완료) + 콘텐츠/배너/성과 ──
  const eduEmail = 'demo-partner-edu@p16.local';
  const eduHash = await bcrypt.hash('demo1234!', 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, email_verified, is_active)
     VALUES (?, ?, 'edu_platform', 1, 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'edu_platform', is_active = 1`,
    [eduEmail, eduHash],
  );
  const eduUserId = (await scalarId('SELECT id FROM users WHERE email = ? LIMIT 1', [eduEmail]))!;
  let eduPartnerId = await scalarId(
    `SELECT p.id FROM partner p JOIN partner_account pa ON pa.partner_id = p.id WHERE pa.user_id = ? LIMIT 1`,
    [eduUserId],
  );
  if (!eduPartnerId) {
    const [pins] = await pool.query(
      "INSERT INTO partner (type, name, consent_scope, status) VALUES ('edu_platform', '데모 교육·활동 플랫폼', 'stats', 'active')",
    );
    eduPartnerId = (pins as { insertId: number }).insertId;
    await pool.query('INSERT INTO partner_account (partner_id, user_id) VALUES (?, ?)', [eduPartnerId, eduUserId]);
  }
  const eduSrc = `partner-${eduPartnerId}`;
  const eduFeedCnt = await scalarId('SELECT COUNT(*) AS id FROM external_feed_item WHERE source = ?', [eduSrc]);
  if (!eduFeedCnt) {
    await pool.query(
      `INSERT INTO external_feed_item (kind, source, external_id, title, freshness, payload) VALUES
        ('certification', ?, ?, '제휴 클라우드 자격 과정(데모)', 'fresh', '{}'),
        ('contest', ?, ?, '제휴 대외활동: 데이터 챌린지(데모)', 'fresh', '{}')`,
      [eduSrc, `${eduSrc}-seed1`, eduSrc, `${eduSrc}-seed2`],
    );
  }
  let eduBannerId = await scalarId('SELECT id FROM partner_banner WHERE partner_id = ? LIMIT 1', [eduPartnerId]);
  if (!eduBannerId) {
    const [bins] = await pool.query(
      "INSERT INTO partner_banner (partner_id, title, landing_url, discount_text, active) VALUES (?, '데모 교육 플랫폼: 토익 단기 과정', 'https://edu.demo.local/toeic', '30% 할인', 1)",
      [eduPartnerId],
    );
    eduBannerId = (bins as { insertId: number }).insertId;
    // 성과 샘플: 클릭 8 + 전환 2 (banner_conversion.event = click|convert)
    for (let i = 0; i < 8; i++) await pool.query("INSERT INTO banner_conversion (partner_banner_id, event) VALUES (?, 'click')", [eduBannerId]);
    for (let i = 0; i < 2; i++) await pool.query("INSERT INTO banner_conversion (partner_banner_id, event) VALUES (?, 'convert')", [eduBannerId]);
  }

  console.log('\n=== 데모 시나리오 시딩 완료 ===');
  console.log(`1) 대학: university_id=${universityId}, staff 연결 ${uniUserId ? 'OK(individual)' : '없음(데모대학 계정 부재)'}`);
  console.log(`2) 가상 인재: 신규 학생 ${createdStudents}명 / 진단 ${createdDiag}건 (조합 ${combos.length} × ${PER_COMBO}명)`);
  console.log(`3) 멘토↔학생 매핑: ${mappingMsg}`);
  console.log(`4) 멘토 출제 미션: ${authoredMsg}`);
  console.log(`5) 교육·활동 플랫폼 제휴사: ${eduEmail} (partner ${eduPartnerId}, 콘텐츠/배너/성과 시드)`);
  await closePool();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('[seed-demo-scenario] error:', e);
  await closePool().catch(() => {});
  process.exit(1);
});
