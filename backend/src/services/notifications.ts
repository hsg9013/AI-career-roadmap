import { getPool } from '../db/pool.js';
import { getMailer } from '../lib/mailer/index.js';
import { logger } from '../lib/logger.js';

// T041: 알림 생성/조회 + 학기말 진척 점검 스윕 (FR-013, US5)

export type NotificationChannel = 'in_app' | 'push' | 'email';

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
    await createNotification(uid, 'progress_check', '진척 점검: 활동 내역을 업데이트하고 로드맵을 갱신하세요.', {
      channel: 'in_app',
    });
    created += 1;
  }
  logger.info({ created }, '[notifications] progress-check sweep done');
  return created;
}
