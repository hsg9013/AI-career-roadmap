import pino from 'pino';
import { env } from '../config/env.js';

// T020: pino 구조화 로그 + requestId 헬퍼
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'backend' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.account_no',
      '*.business_no',
      '*.token',
      '*.refresh_token',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export function withRequestId(requestId: string) {
  return logger.child({ requestId });
}
