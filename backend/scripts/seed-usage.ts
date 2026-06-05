import '../src/config/dotenv.js';
import { getPool, closePool } from '../src/db/pool.js';

// 임의 사용 데이터 시드 (100건) — 사용자별·기간별·서비스유형별로 "정확히 균등" 분배.
//   서비스 유형 10종 × 사용자 10명 × 기간 10개월 을 교차시켜
//   각 차원(유형/사용자/기간)마다 정확히 10건씩 떨어지도록 구성한다.
//   analytics_events 테이블 사용. props_json.source='usage-seed' 로 재실행 시 멱등 처리.
//   실행: pnpm --filter backend seed:usage

const SERVICE_TYPES = [
  'gap_diagnosis',
  'roadmap',
  'documents',
  'missions',
  'notifications',
  'university',
  'companies',
  'payments',
  'alumni',
  'admin',
] as const; // 10종

const USER_BUCKETS = Array.from({ length: 10 }, (_, i) => 1001 + i); // 가상의 사용자 10명 (1001~1010)

const MONTHS = [
  '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
  '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
]; // 10개월

async function main(): Promise<void> {
  const pool = getPool();

  // 멱등: 기존 usage-seed 제거
  await pool.query(
    `DELETE FROM analytics_events WHERE JSON_EXTRACT(props_json, '$.source') = 'usage-seed'`,
  );

  const rows: Array<[number, string, string]> = []; // [user_id, event(serviceType), occurred_at]
  for (let ti = 0; ti < SERVICE_TYPES.length; ti++) {
    for (let uj = 0; uj < USER_BUCKETS.length; uj++) {
      const mIdx = (ti + uj) % MONTHS.length; // 균등 분산: 유형/사용자/기간 각 10건
      const day = ((ti * 3 + uj) % 27) + 1;
      const occurredAt = `${MONTHS[mIdx]}-${String(day).padStart(2, '0')} 10:00:00`;
      const props = JSON.stringify({
        source: 'usage-seed',
        service_type: SERVICE_TYPES[ti],
        period: MONTHS[mIdx],
        user_bucket: USER_BUCKETS[uj],
      });
      // event 컬럼에 서비스 유형을 기록 (관리자 지표 집계에서 유형별로 보이도록)
      await pool.query(
        `INSERT INTO analytics_events (user_id, event, props_json, occurred_at) VALUES (?, ?, ?, ?)`,
        [USER_BUCKETS[uj], SERVICE_TYPES[ti], props, occurredAt],
      );
      rows.push([USER_BUCKETS[uj], SERVICE_TYPES[ti], occurredAt]);
    }
  }

  // 분배 검증
  const [byType] = await pool.query(
    `SELECT event, COUNT(*) n FROM analytics_events
     WHERE JSON_EXTRACT(props_json,'$.source')='usage-seed' GROUP BY event ORDER BY event`,
  );
  const [byUser] = await pool.query(
    `SELECT user_id, COUNT(*) n FROM analytics_events
     WHERE JSON_EXTRACT(props_json,'$.source')='usage-seed' GROUP BY user_id ORDER BY user_id`,
  );
  const [byPeriod] = await pool.query(
    `SELECT JSON_UNQUOTE(JSON_EXTRACT(props_json,'$.period')) period, COUNT(*) n
     FROM analytics_events WHERE JSON_EXTRACT(props_json,'$.source')='usage-seed'
     GROUP BY period ORDER BY period`,
  );

  // eslint-disable-next-line no-console
  console.log(`총 삽입: ${rows.length}건`);
  // eslint-disable-next-line no-console
  console.log('서비스유형별:', (byType as Array<{ event: string; n: number }>).map((r) => `${r.event}=${r.n}`).join(', '));
  // eslint-disable-next-line no-console
  console.log('사용자별:', (byUser as Array<{ user_id: number; n: number }>).map((r) => `${r.user_id}=${r.n}`).join(', '));
  // eslint-disable-next-line no-console
  console.log('기간별:', (byPeriod as Array<{ period: string; n: number }>).map((r) => `${r.period}=${r.n}`).join(', '));
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-usage] error:', err);
    await closePool();
    process.exit(1);
  });
