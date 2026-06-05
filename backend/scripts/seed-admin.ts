import '../src/config/dotenv.js';
import bcrypt from 'bcrypt';
import { getPool, closePool } from '../src/db/pool.js';

// 관리자 계정 시드 (대시보드 로그인용). 멱등 — 이미 있으면 비밀번호만 갱신.
//   실행: pnpm --filter backend seed:admin
//   계정: admin@p16.local / admin1234!

const EMAIL = 'admin@p16.local';
const PASSWORD = 'admin1234!';

async function main(): Promise<void> {
  const pool = getPool();
  const hash = await bcrypt.hash(PASSWORD, 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, email_verified, is_active)
     VALUES (?, ?, 'admin', 1, 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin', is_active = 1`,
    [EMAIL, hash],
  );
  // eslint-disable-next-line no-console
  console.log(`관리자 계정 준비 완료 → ${EMAIL} / ${PASSWORD}`);
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-admin] error:', err);
    await closePool();
    process.exit(1);
  });
