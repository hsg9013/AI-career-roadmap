import { withTransaction } from '../db/pool.js';
import { logger } from '../lib/logger.js';

// T064: 보존기간 경과 데이터 자동 익명화 (FR-022)
// 졸업 예정일 + RETENTION_YEARS 가 지난 학생의 식별 정보를 익명화하고 audit_logs 에 기록.
// 파괴적 삭제 대신 익명화를 기본 동작으로 한다(가역 불가, 통계는 보존).

const RETENTION_YEARS = 2;

export interface RetentionResult {
  anonymized: number;
}

export async function runRetentionSweep(): Promise<RetentionResult> {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT s.id AS student_id, s.user_id
       FROM students s
       WHERE s.expected_grad_at IS NOT NULL
         AND s.expected_grad_at < (CURDATE() - INTERVAL ? YEAR)
         AND s.university <> '(anonymized)'`,
      [RETENTION_YEARS],
    );
    const targets = rows as Array<{ student_id: number; user_id: number }>;
    let anonymized = 0;

    for (const t of targets) {
      // 학생 식별 정보 익명화 (전공/대학 통계 키는 일반화)
      await conn.query(
        `UPDATE students SET university = '(anonymized)', major = '(anonymized)' WHERE id = ?`,
        [t.student_id],
      );
      // 계정 이메일을 비식별 토큰으로 치환
      await conn.query(
        `UPDATE users SET email = CONCAT('anon+', id, '@anonymized.local') WHERE id = ?`,
        [t.user_id],
      );
      await conn.query(
        `INSERT INTO audit_logs (actor_user_id, action, target_kind, target_id, meta_json)
         VALUES (NULL, 'retention_anonymize', 'student', ?, JSON_OBJECT('retention_years', ?))`,
        [t.student_id, RETENTION_YEARS],
      );
      anonymized += 1;
    }

    logger.info({ anonymized }, '[retention] sweep done');
    return { anonymized };
  });
}
