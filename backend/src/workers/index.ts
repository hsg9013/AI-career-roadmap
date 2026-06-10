import '../config/dotenv.js';
import { Worker, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { processReviewSla } from '../services/missions.js';
import {
  runProgressCheckSweep,
  processNotificationDelivery,
  type RetryDeliveryJob,
} from '../services/notifications.js';
import { evaluateOpsHealth } from '../lib/ops.js';
import { reconcilePayments } from '../services/payments.js';
import { collectAllFeeds } from '../services/feeds/index.js';

// 워커 부트스트랩. mission-review(SLA), notification(진척 점검) 큐는 실제 핸들러 연결.
// 나머지 큐는 후속 단계 stub.

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(env.REDIS_URL);

const QUEUE_NAMES = [
  'mission-review',
  'notification',
  'push-dispatch',
  'external-fetch',
  'recommendation-precompute',
  'payout-monthly',
  'data-export',
] as const;

const workers = QUEUE_NAMES.map((name) =>
  new Worker(
    name,
    async (job) => {
      if (name === 'mission-review' && job.name === 'sla-check') {
        const { submissionId } = job.data as { submissionId: number };
        await processReviewSla(submissionId);
        return { handled: 'mission-review-sla', submissionId };
      }
      if (name === 'notification' && job.name === 'progress-check-sweep') {
        const created = await runProgressCheckSweep();
        return { handled: 'progress-check-sweep', created };
      }
      if (name === 'notification' && job.name === 'retry-delivery') {
        // 003 US4(T035): push/email 발송 실패 재시도. 실패 시 throw → BullMQ backoff 재시도.
        await processNotificationDelivery(job.data as RetryDeliveryJob);
        return { handled: 'retry-delivery' };
      }
      if (name === 'external-fetch' && job.name === 'collect-feeds') {
        // 003 US5(T039): 외부 피드 수집 + 신선도 갱신.
        const result = await collectAllFeeds();
        return { handled: 'collect-feeds', ...result };
      }
      logger.info({ queue: name, jobId: job.id, jobName: job.name }, '[worker] received (no-op stub)');
      return { stub: true };
    },
    { connection, autorun: true },
  ),
);

workers.forEach((w) => {
  w.on('ready', () => logger.info({ queue: w.name }, '[worker] ready'));
  w.on('error', (err) => logger.error({ queue: w.name, err }, '[worker] error'));
  w.on('failed', (job, err) => logger.warn({ queue: w.name, jobId: job?.id, err }, '[worker] job failed'));
});

// 003 US8(T032): 주기적 운영 헬스 모니터링 — db/redis down 시 monitor_alert(critical) 적재, 복구 시 해소.
const OPS_MONITOR_INTERVAL_MS = Number(process.env.OPS_MONITOR_INTERVAL_MS ?? 60_000);
const opsMonitorTimer = setInterval(() => {
  evaluateOpsHealth().catch((err) => logger.warn({ err }, '[ops] periodic health check failed'));
}, OPS_MONITOR_INTERVAL_MS);
opsMonitorTimer.unref();

// 003 US3(T027): 주기적 결제·멤버십 정합성 점검 — 불일치 자동 정정, 정정 불가는 운영 경보.
const RECONCILE_INTERVAL_MS = Number(process.env.PAYMENT_RECONCILE_INTERVAL_MS ?? 300_000);
const reconcileTimer = setInterval(() => {
  reconcilePayments()
    .then((r) => {
      if (r.corrected > 0 || r.flagged > 0) logger.warn(r, '[payments] reconcile result');
    })
    .catch((err) => logger.warn({ err }, '[payments] periodic reconcile failed'));
}, RECONCILE_INTERVAL_MS);
reconcileTimer.unref();

// 003 US5(T039): 일 단위 외부 피드 수집(공식 API·제휴 피드). 부팅 직후 1회 + 주기 실행.
const FEED_COLLECT_INTERVAL_MS = Number(process.env.FEED_COLLECT_INTERVAL_MS ?? env.FEED_COLLECT_INTERVAL_MS);
function runFeedCollection(): void {
  collectAllFeeds().catch((err) => logger.warn({ err }, '[feeds] scheduled collection failed'));
}
const feedTimer = setInterval(runFeedCollection, FEED_COLLECT_INTERVAL_MS);
feedTimer.unref();

logger.info(
  {
    queues: QUEUE_NAMES,
    opsMonitorIntervalMs: OPS_MONITOR_INTERVAL_MS,
    reconcileIntervalMs: RECONCILE_INTERVAL_MS,
    feedCollectIntervalMs: FEED_COLLECT_INTERVAL_MS,
  },
  '[worker] bootstrap complete',
);

async function shutdown(): Promise<void> {
  logger.info('[worker] shutting down');
  clearInterval(opsMonitorTimer);
  clearInterval(reconcileTimer);
  clearInterval(feedTimer);
  await Promise.allSettled(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
