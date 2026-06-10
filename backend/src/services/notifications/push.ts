import { getPool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

// 003 US4(T034): 모바일 푸시 발송 어댑터(FCM/APNs). FR-020 점진 활성화.
//   • 키(FCM_SERVER_KEY / APNS_*) 미설정 dev: 시뮬레이션 성공(console) — 발송 경로는 검증하되 외부 호출 없음.
//   • 키 설정 시: 사용자 디바이스 토큰으로 FCM HTTP 발송. APNs 는 별도(현재 구조만, 토큰 없으면 skip).
// 반환: { ok, error, attempted } — 호출부(dispatch)가 delivery 상태/재시도를 기록.

export interface PushResult {
  ok: boolean;
  error?: string;
  /** 실제 전송을 시도한 토큰 수(dev 시뮬레이션은 0). */
  attempted: number;
}

export function hasPushCredentials(): boolean {
  return env.FCM_SERVER_KEY.length > 0 || env.APNS_KEY_ID.length > 0;
}

interface DeviceTokenRow {
  platform: 'ios' | 'android' | 'web';
  token: string;
}

async function loadDeviceTokens(userId: number): Promise<DeviceTokenRow[]> {
  const [rows] = await getPool().query(
    'SELECT platform, token FROM device_token WHERE user_id = ?',
    [userId],
  );
  return rows as DeviceTokenRow[];
}

// FCM 레거시 HTTP 발송(android/web 토큰). 성공 토큰 수를 반환.
async function sendFcm(tokens: string[], title: string, payload: Record<string, unknown>): Promise<number> {
  if (tokens.length === 0 || env.FCM_SERVER_KEY.length === 0) return 0;
  let sent = 0;
  for (const token of tokens) {
    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `key=${env.FCM_SERVER_KEY}`,
        },
        body: JSON.stringify({ to: token, notification: { title }, data: payload }),
      });
      if (res.ok) sent += 1;
      else logger.warn({ status: res.status }, '[push:fcm] non-2xx');
    } catch (err) {
      logger.warn({ err }, '[push:fcm] send failed');
    }
  }
  return sent;
}

/**
 * 사용자에게 푸시 발송. dev(무키)는 시뮬레이션 성공. 키 설정 시 실제 FCM 발송.
 * 토큰이 전혀 없고 자격증명이 있는 경우엔 발송 대상이 없으므로 ok=true, attempted=0.
 */
export async function sendPush(
  userId: number,
  title: string,
  payload: Record<string, unknown> = {},
): Promise<PushResult> {
  if (!hasPushCredentials()) {
    // dev 시뮬레이션 — 외부 호출 없이 성공 처리(발송 파이프라인 검증용).
    logger.info({ userId, title }, '[push:sim] dispatched (no credentials, dev)');
    return { ok: true, attempted: 0 };
  }

  const tokens = await loadDeviceTokens(userId);
  const fcmTokens = tokens.filter((t) => t.platform !== 'ios').map((t) => t.token);
  // APNs(ios) 실연동은 HTTP/2 클라이언트가 필요 — 현재는 미발송(누락 기록 회피 위해 토큰 없으면 무시).
  const iosTokens = tokens.filter((t) => t.platform === 'ios');
  if (iosTokens.length > 0) {
    logger.warn({ count: iosTokens.length }, '[push:apns] APNs 발송 미구현 — 토큰 보류');
  }

  try {
    const sent = await sendFcm(fcmTokens, title, payload);
    if (sent === 0 && fcmTokens.length > 0) {
      return { ok: false, error: 'all FCM sends failed', attempted: fcmTokens.length };
    }
    return { ok: true, attempted: fcmTokens.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message, attempted: fcmTokens.length };
  }
}
