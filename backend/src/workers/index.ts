import '../config/dotenv.js';
import { Worker, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { processReviewSla } from '../services/missions.js';
import { runProgressCheckSweep } from '../services/notifications.js';

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

logger.info({ queues: QUEUE_NAMES }, '[worker] bootstrap complete');

async function shutdown(): Promise<void> {
  logger.info('[worker] shutting down');
  await Promise.allSettled(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
