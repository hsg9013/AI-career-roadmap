import { describe, it, expect, afterAll } from 'vitest';
import { getPool, closePool } from './db/pool.js';
import { K_ANONYMITY_MIN } from './services/recommendation/kAnonymity.js';
import { anonymize } from './services/recommendation/gateway.js';

// T069: 보안 하드닝 감사 — 암호화 컬럼, k-익명성 기준, 추천 입력 PII 제거를 자동 검증.

afterAll(async () => {
  await closePool();
});

describe('T069 보안 감사', () => {
  it('민감 컬럼(payment_methods)은 VARBINARY 로 암호화 저장된다 (FR-020)', async () => {
    const [rows] = await getPool().query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'payment_methods'
         AND column_name IN ('account_no_enc', 'holder_enc')`,
    );
    const cols = rows as Array<{ column_name?: string; COLUMN_NAME?: string; data_type?: string; DATA_TYPE?: string }>;
    expect(cols.length).toBe(2);
    for (const c of cols) {
      const type = (c.data_type ?? c.DATA_TYPE ?? '').toLowerCase();
      expect(type).toBe('varbinary');
    }
  });

  it('기업 사업자번호(companies.biz_no_enc)도 VARBINARY 이다', async () => {
    const [rows] = await getPool().query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'companies' AND column_name = 'biz_no_enc'`,
    );
    const c = (rows as Array<{ data_type?: string; DATA_TYPE?: string }>)[0];
    expect((c?.data_type ?? c?.DATA_TYPE ?? '').toLowerCase()).toBe('varbinary');
  });

  it('k-익명성 최소 인원은 5 이다 (FR-019)', () => {
    expect(K_ANONYMITY_MIN).toBe(5);
  });

  it('추천 입력 anonymize 는 PII(이메일/이름/전화 등)를 제거한다 (FR-007)', () => {
    const out = anonymize({ email: 'a@b.com', name: '홍길동', phone: '010', score: 80, missing: ['sql'] });
    expect(out.email).toBeUndefined();
    expect(out.name).toBeUndefined();
    expect(out.phone).toBeUndefined();
    expect(out.score).toBe(80);
    expect(out.missing).toEqual(['sql']);
  });

  it('AI 입력 anonymize 는 민감 인구통계(성별·나이·출신학교)도 제거한다 (FR-019, T021a)', () => {
    const out = anonymize({
      job_role: 'IT/backend',
      gender: 'female',
      age: 24,
      school: '한국대학교',
      university: '한국대학교',
      hometown: '부산',
      score: 72,
      missing: ['k8s'],
    });
    for (const forbidden of ['gender', 'age', 'school', 'university', 'hometown']) {
      expect(out[forbidden]).toBeUndefined();
    }
    // 진단에 필요한 비민감 신호는 보존.
    expect(out.job_role).toBe('IT/backend');
    expect(out.score).toBe(72);
    expect(out.missing).toEqual(['k8s']);
  });

  it('students 테이블에는 추천 편향 유발 민감 속성(gender/age) 컬럼이 없다 (FR-007)', async () => {
    const [rows] = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'students'`,
    );
    const names = (rows as Array<{ column_name?: string; COLUMN_NAME?: string }>).map((r) =>
      (r.column_name ?? r.COLUMN_NAME ?? '').toLowerCase(),
    );
    expect(names).not.toContain('gender');
    expect(names).not.toContain('age');
    expect(names).not.toContain('birthday');
  });
});
