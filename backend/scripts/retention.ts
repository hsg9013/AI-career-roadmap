import '../src/config/dotenv.js';
import { runRetentionSweep } from '../src/services/retention.js';
import { closePool } from '../src/db/pool.js';

// T064: 보존기간 익명화 배치 실행 스크립트. cron/스케줄러에서 주기 실행.
//   pnpm --filter backend retention:run

runRetentionSweep()
  .then(async (res) => {
    // eslint-disable-next-line no-console
    console.log(`[retention] anonymized ${res.anonymized} student(s)`);
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error('[retention] error:', err);
    await closePool();
    process.exit(1);
  });
