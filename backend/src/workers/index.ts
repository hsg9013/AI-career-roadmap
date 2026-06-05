import '../config/dotenv.js';
import { Worker, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

// 워커 부트스트랩. 각 큐별 process 함수는 Phase 3+ 에서 실제 핸들러 연결 예정.
// 현 단계는 큐 연결 + heartbeat 확인을 목적으로 한다.

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
