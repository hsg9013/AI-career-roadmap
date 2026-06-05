import { env } from '../../config/env.js';
import { logger } from '../logger.js';

// T030: 메일 발송 어댑터 (R-4 Naver Cloud Outbound Mailer)
// 1차에선 dev/test 환경에서 stdout 로그로 대체. 운영에서 실제 어댑터로 교체.

export interface MailMessage {
  to: string;
  subject: string;
  body: string;          // markdown
  templateCode?: string; // 'mission-review-complete', 'payment-failed', ...
}

export interface Mailer {
  send(msg: MailMessage): Promise<{ messageId: string }>;
}

class ConsoleMailer implements Mailer {
  async send(msg: MailMessage): Promise<{ messageId: string }> {
    logger.info({ to: msg.to, subject: msg.subject, template: msg.templateCode }, '[mailer:console] send');
    return { messageId: `console-${Date.now()}` };
  }
}

class NaverCloudMailer implements Mailer {
  async send(msg: MailMessage): Promise<{ messageId: string }> {
    // TODO: Phase 7(US5 알림)에서 실제 API 통합. 1차는 stub.
    logger.info({ to: msg.to, subject: msg.subject }, '[mailer:naver-cloud] send (stub)');
    return { messageId: `nc-${Date.now()}` };
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;
  mailer = env.MAILER_PROVIDER === 'naver-cloud' && env.MAILER_API_KEY
    ? new NaverCloudMailer()
    : new ConsoleMailer();
  return mailer;
}
