import { getPool } from '../db/pool.js';
import { getMailer } from '../lib/mailer/index.js';
import { logger } from '../lib/logger.js';
import { queues } from '../queues/index.js';
import { sendPush } from './notifications/push.js';

// T041: 알림 생성/조회 + 학기말 진척 점검 스윕 (FR-013, US5)

export type NotificationChannel = 'in_app' | 'push' | 'email';
export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'skipped';

// 003 US4(T036): 채널별 알림 설정 (FR-009). in_app 은 항상 on, push/email 만 토글.
export interface NotificationSettings {
  inApp: true;
  push: boolean;
  email: boolean;
}

export async function getNotificationSettings(userId: number): Promise<NotificationSettings> {
  const [rows] = await getPool().query(
    `SELECT channel, enabled FROM user_notification_setting WHERE user_id = ?`,
    [userId],
  );
  // 기본값: 미설정 채널은 on(true). 명시적으로 끈 채널만 false.
  const settings: NotificationSettings = { inApp: true, push: true, email: true };
  for (const r of rows as Array<{ channel: 'push' | 'email'; enabled: number | boolean }>) {
    settings[r.channel] = Boolean(r.enabled);
  }
  return settings;
}

export async function putNotificationSettings(
  userId: number,
  next: { push: boolean; email: boolean },
): Promise<NotificationSettings> {
  const pool = getPool();
  for (const channel of ['push', 'email'] as const) {
    await pool.query(
      `INSERT INTO user_notification_setting (user_id, channel, enabled) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [userId, channel, next[channel]],
    );
  }
  return getNotificationSettings(userId);
}

/** 발송 전 채널 허용 여부 — in_app 은 항상 허용. (발송 어댑터 연동 시 사용) */
export async function isChannelEnabled(
  userId: number,
  channel: NotificationChannel,
): Promise<boolean> {
  if (channel === 'in_app') return true;
  const s = await getNotificationSettings(userId);
  return s[channel];
}

// 003 US4(T034b): 푸시 디바이스 토큰 등록/갱신. 토큰 단위 unique — 기기 소유자 이전 시 갱신.
export async function registerDevice(
  userId: number,
  platform: 'ios' | 'android' | 'web',
  token: string,
): Promise<{ registered: true }> {
  await getPool().query(
    `INSERT INTO device_token (user_id, platform, token) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform)`,
    [userId, platform, token],
  );
  return { registered: true };
}

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  opts: { channel?: NotificationChannel; payload?: Record<string, unknown> } = {},
): Promise<number> {
  const channel = opts.channel ?? 'in_app';
  const [ins] = await getPool().query(
    `INSERT INTO notifications (user_id, type, channel, title, payload_json) VALUES (?, ?, ?, ?, ?)`,
    [userId, type, channel, title, opts.payload ? JSON.stringify(opts.payload) : null],
  );
  const id = (ins as { insertId: number }).insertId;

  if (channel === 'email') {
    try {
      const [rows] = await getPool().query('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
      const email = (rows as Array<{ email: string }>)[0]?.email;
      if (email) await getMailer().send({ to: email, subject: title, body: title, templateCode: type });
    } catch (err) {
      logger.warn({ err, userId }, '[notifications] email dispatch failed (non-blocking)');
    }
  }
  // push 채널은 push-dispatch 큐/FCM·APNs 연동 지점 (후속). in_app 은 DB 저장으로 충분.
  return id;
}

// 003 US4(T035): 채널별 발송 상태 기록(멱등 upsert — notification×channel 1행).
async function recordDelivery(
  notificationId: number,
  channel: NotificationChannel,
  status: DeliveryStatus,
  opts: { retryCount?: number; lastError?: string | null } = {},
): Promise<void> {
  await getPool().query(
    `INSERT INTO notification_delivery (notification_id, channel, status, retry_count, last_error)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), retry_count = VALUES(retry_count), last_error = VALUES(last_error)`,
    [notificationId, channel, status, opts.retryCount ?? 0, opts.lastError ?? null],
  );
}

async function getUserEmail(userId: number): Promise<string | null> {
  const [rows] = await getPool().query('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
  return (rows as Array<{ email: string }>)[0]?.email ?? null;
}

// 단일 채널(push/email) 실제 발송. 성공/실패를 반환(throw 하지 않음).
async function sendChannel(
  userId: number,
  channel: 'push' | 'email',
  title: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (channel === 'push') {
      const r = await sendPush(userId, title, payload);
      return { ok: r.ok, error: r.error };
    }
    const email = await getUserEmail(userId);
    if (!email) return { ok: false, error: 'no email on file' };
    await getMailer().send({ to: email, subject: title, body: title, templateCode: type });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface DispatchResult {
  notification_id: number;
  deliveries: Record<NotificationChannel, DeliveryStatus>;
}

/**
 * 003 US4(T035): 이벤트 → 3채널 발송 라우터.
 *   • in_app: 항상 알림 행 생성 + delivery=sent (FR-008 보장).
 *   • push/email: 사용자 설정 on 일 때만 발송(off → skipped, FR-009). 실패 시 재시도 잡 등록.
 */
export async function dispatchNotification(
  userId: number,
  type: string,
  title: string,
  opts: { payload?: Record<string, unknown> } = {},
): Promise<DispatchResult> {
  const payload = opts.payload ?? {};
  const [ins] = await getPool().query(
    `INSERT INTO notifications (user_id, type, channel, title, payload_json) VALUES (?, ?, 'in_app', ?, ?)`,
    [userId, type, title, Object.keys(payload).length ? JSON.stringify(payload) : null],
  );
  const notificationId = (ins as { insertId: number }).insertId;

  const deliveries: Record<NotificationChannel, DeliveryStatus> = {
    in_app: 'sent',
    push: 'skipped',
    email: 'skipped',
  };
  await recordDelivery(notificationId, 'in_app', 'sent');

  const settings = await getNotificationSettings(userId);
  for (const channel of ['push', 'email'] as const) {
    if (!settings[channel]) {
      await recordDelivery(notificationId, channel, 'skipped');
      continue;
    }
    const r = await sendChannel(userId, channel, title, type, payload);
    if (r.ok) {
      deliveries[channel] = 'sent';
      await recordDelivery(notificationId, channel, 'sent');
    } else {
      deliveries[channel] = 'failed';
      await recordDelivery(notificationId, channel, 'failed', { lastError: r.error });
      // 실패는 재시도 잡 등록(best-effort) — 워커가 같은 delivery 행을 갱신.
      try {
        await queues.notification.add(
          'retry-delivery',
          { userId, notificationId, channel, type, title, payload },
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
        );
      } catch (err) {
        logger.warn({ err, notificationId, channel }, '[notifications] retry enqueue failed (non-blocking)');
      }
    }
  }
  return { notification_id: notificationId, deliveries };
}

// 워커 재시도 진입점 — 실패 채널 재발송. 성공 시 delivery=sent, 실패 시 retry_count 증가 후 throw(BullMQ 재시도).
export interface RetryDeliveryJob {
  userId: number;
  notificationId: number;
  channel: 'push' | 'email';
  type: string;
  title: string;
  payload: Record<string, unknown>;
}

export async function processNotificationDelivery(job: RetryDeliveryJob): Promise<void> {
  const r = await sendChannel(job.userId, job.channel, job.title, job.type, job.payload);
  if (r.ok) {
    await recordDelivery(job.notificationId, job.channel, 'sent');
    return;
  }
  // 현재 retry_count 조회 후 +1 기록.
  const [rows] = await getPool().query(
    'SELECT retry_count FROM notification_delivery WHERE notification_id = ? AND channel = ? LIMIT 1',
    [job.notificationId, job.channel],
  );
  const prev = Number((rows as Array<{ retry_count: number }>)[0]?.retry_count ?? 0);
  await recordDelivery(job.notificationId, job.channel, 'failed', { retryCount: prev + 1, lastError: r.error });
  throw new Error(`delivery retry failed: ${job.channel} — ${r.error ?? 'unknown'}`);
}

export async function listNotifications(userId: number, unreadOnly = false): Promise<unknown[]> {
  const where = unreadOnly ? 'user_id = ? AND read_at IS NULL' : 'user_id = ?';
  const [rows] = await getPool().query(
    `SELECT id, type, channel, title, payload_json,
            DATE_FORMAT(sent_at, '%Y-%m-%dT%H:%i:%sZ') AS sent_at,
            DATE_FORMAT(read_at, '%Y-%m-%dT%H:%i:%sZ') AS read_at
     FROM notifications WHERE ${where}
     ORDER BY sent_at DESC LIMIT 100`,
    [userId],
  );
  return (rows as Array<{ payload_json: unknown }>).map((r) => ({
    ...r,
    payload_json: typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json,
  }));
}

export async function markRead(userId: number, notificationId: number): Promise<boolean> {
  const [res] = await getPool().query(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND read_at IS NULL',
    [notificationId, userId],
  );
  return (res as { affectedRows: number }).affectedRows > 0;
}

// 진척 점검 스윕: 활성 로드맵이 있는 학생에게 업데이트 유도 알림 발송. (스케줄 잡에서 호출)
export async function runProgressCheckSweep(): Promise<number> {
  const [rows] = await getPool().query(
    `SELECT DISTINCT s.user_id
     FROM roadmaps r JOIN students s ON s.id = r.student_id
     WHERE r.status = 'active'`,
  );
  const userIds = (rows as Array<{ user_id: number }>).map((r) => r.user_id);
  let created = 0;
  for (const uid of userIds) {
    // 003 US4: 진척 점검은 3채널 라우터로 발송(설정 반영).
    await dispatchNotification(uid, 'progress_check', '진척 점검: 활동 내역을 업데이트하고 로드맵을 갱신하세요.');
    created += 1;
  }
  logger.info({ created }, '[notifications] progress-check sweep done');
  return created;
}
