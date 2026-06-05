import type { AccessTokenClaims } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      auth?: AccessTokenClaims;
    }
  }
}

export {};
