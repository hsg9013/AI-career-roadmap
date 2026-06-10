import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

// 003 US3(T023/T024): PortOne 결제 어댑터 (FR-020 점진 활성화).
//   • 키(PORTONE_IMP_KEY/SECRET) 미설정 dev 환경: 합성 세션 + 즉시 승인 경로(웹훅 없이도 동작).
//   • 키 설정 시: 결제창 세션 발급 후 PortOne 웹훅으로 최종 상태 확정.
// 외부 호출 실패는 throw 하지 않고 호출부가 폴백(pending 유지)하도록 한다.

export function hasPortOneCredentials(): boolean {
  return env.PORTONE_IMP_KEY.length > 0 && env.PORTONE_IMP_SECRET.length > 0;
}

export interface PortOneSession {
  /** 가맹점 거래 식별자 = pg_tx_id (멱등 키). */
  merchantUid: string;
  /** 실결제창 URL(실연동). dev 합성 세션은 null. */
  redirectUrl: string | null;
  /** dev 무키 환경에서 즉시 승인 가능한지. */
  devAutoApprove: boolean;
}

export function newMerchantUid(): string {
  return `mid_${randomUUID()}`;
}

/**
 * 결제 세션 생성. 실연동은 PortOne 결제 준비, dev 는 즉시승인 합성 세션.
 */
export function createSession(merchantUid: string): PortOneSession {
  if (!hasPortOneCredentials()) {
    return { merchantUid, redirectUrl: null, devAutoApprove: true };
  }
  // 실연동: PortOne 결제창은 클라이언트 SDK 가 imp_uid 로 진행하고, 서버는 merchant_uid 만 발급.
  // 별도 서버사이드 준비 호출이 필요하면 여기서 fetch — 현재는 merchant_uid 기반 결제창으로 충분.
  return { merchantUid, redirectUrl: null, devAutoApprove: false };
}

/**
 * 웹훅 HMAC 서명 검증. 무키 dev 는 검증을 생략(경고).
 * 서명 헤더는 PortOne 의 webhook secret 으로 raw body 를 HMAC-SHA256 한 hex.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  if (!hasPortOneCredentials()) {
    logger.warn('[portone] webhook signature check skipped (no credentials, dev mode)');
    return true;
  }
  if (!signature) return false;
  const expected = createHmac('sha256', env.PORTONE_IMP_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** dev 합성 영수증 URL. 실연동은 PortOne 영수증 URL 을 웹훅 페이로드에서 받는다. */
export function devReceiptUrl(merchantUid: string): string {
  return `https://receipts.dev.local/${merchantUid}`;
}
