import { getPool } from '../db/pool.js';
import { HttpError } from '../middlewares/errorHandler.js';

// T073: 개인정보 처리방침 게시 + 변경 시 재동의 (FR-025, FR-021 append-only consent_records)

export interface PolicyView {
  version: string;
  body: string;
  published_at: string;
  needs_consent: boolean;
}

async function currentPolicy(): Promise<{ version: string; body: string; published_at: string }> {
  const [rows] = await getPool().query(
    `SELECT version, body, DATE_FORMAT(published_at, '%Y-%m-%dT%H:%i:%sZ') AS published_at
     FROM privacy_policies WHERE is_current = 1 ORDER BY published_at DESC LIMIT 1`,
  );
  const row = (rows as Array<{ version: string; body: string; published_at: string }>)[0];
  if (!row) throw new HttpError(404, 'NO_POLICY', 'No current privacy policy');
  return row;
}

async function hasConsentedTo(userId: number, version: string): Promise<boolean> {
  const [rows] = await getPool().query(
    `SELECT 1 FROM consent_records
     WHERE user_id = ? AND consent_type = 'privacy_policy' AND policy_version = ? AND granted = 1
     LIMIT 1`,
    [userId, version],
  );
  return (rows as unknown[]).length > 0;
}

export async function getPolicyForUser(userId: number): Promise<PolicyView> {
  const p = await currentPolicy();
  const consented = await hasConsentedTo(userId, p.version);
  return { ...p, needs_consent: !consented };
}

// 재동의 기록 — append-only (갱신 아님). FR-021 추적성.
export async function recordConsent(userId: number, version: string): Promise<void> {
  const p = await currentPolicy();
  if (version !== p.version) {
    throw new HttpError(409, 'POLICY_VERSION_MISMATCH', `Current policy version is ${p.version}`);
  }
  await getPool().query(
    `INSERT INTO consent_records (user_id, consent_type, granted, policy_version, granted_at)
     VALUES (?, 'privacy_policy', 1, ?, CURRENT_TIMESTAMP)`,
    [userId, version],
  );
}
