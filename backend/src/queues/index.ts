import { Queue, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';

// T031: BullMQ 큐 정의 (R-1·R-4·R-6·R-8)
// 각 워커는 별도 파일 (backend/src/workers/*)에서 process(queueName, fn) 형태로 구현.

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

const connection: ConnectionOptions = parseRedisUrl(env.REDIS_URL);

export const queues = {
  missionReview: new Queue('mission-review', { connection }),
  notification: new Queue('notification', { connection }),
  pushDispatch: new Queue('push-dispatch', { connection }),
  externalFetch: new Queue('external-fetch', { connection }),
  recommendationPrecompute: new Queue('recommendation-precompute', { connection }),
  payoutMonthly: new Queue('payout-monthly', { connection }),
  dataExport: new Queue('data-export', { connection }),
};

export type QueueName = keyof typeof queues;

export async function closeAllQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
}
