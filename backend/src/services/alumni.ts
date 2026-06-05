import { createHash, randomUUID } from 'node:crypto';
import { withTransaction } from '../db/pool.js';
import { gradeBandFor } from './recommendation/kAnonymity.js';

// T059: 선배 합격 경로 기부 — 쓰기 시 익명화(PII 비저장) + 보상 지급 (FR-018, R-3)

export interface DonateActivity {
  period: string;
  activity_type: string;
  detail: string;
  skill_tag?: string | null;
}

export interface DonateInput {
  industry_code: string;
  job_role_code: string;
  major_field: string;
  year_in_school?: number; // grade_band 산출용 (선택)
  grade_band?: string;
  success_year: number;
  activities: DonateActivity[];
}

export interface DonateResult {
  alumni_path_id: number;
  reward_type: 'badge';
  anonymized: true;
}

// 비가역 익명 식별자: 사용자와 직접 연결되지 않는 난수 기반 해시.
function makeAnonymizedId(): string {
  return createHash('sha256').update(`anon:${randomUUID()}`).digest('hex');
}

export async function donatePath(userId: number, input: DonateInput): Promise<DonateResult> {
  const gradeBand = input.grade_band ?? gradeBandFor(input.year_in_school ?? 4);

  return withTransaction(async (conn) => {
    const anonymizedId = makeAnonymizedId();
    const [ins] = await conn.query(
      `INSERT INTO alumni_paths (anonymized_id, industry_code, job_role_code, major_field, grade_band, success_year)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [anonymizedId, input.industry_code, input.job_role_code, input.major_field, gradeBand, input.success_year],
    );
    const pathId = (ins as { insertId: number }).insertId;

    for (const a of input.activities) {
      await conn.query(
        `INSERT INTO alumni_path_activities (alumni_path_id, period, activity_type, detail, skill_tag)
         VALUES (?, ?, ?, ?, ?)`,
        [pathId, a.period, a.activity_type, a.detail, a.skill_tag ?? null],
      );
    }

    // 보상 지급 — 기부자(user)는 보상 지급을 위해서만 연결, 경로 데이터와는 분리(익명).
    await conn.query(
      `INSERT INTO alumni_rewards (alumni_user_id, reward_type, amount, alumni_path_id)
       VALUES (?, 'badge', NULL, ?)`,
      [userId, pathId],
    );

    return { alumni_path_id: pathId, reward_type: 'badge', anonymized: true };
  });
}
