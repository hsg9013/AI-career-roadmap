import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

// T022: AES-256-GCM 컬럼 단위 암복호화 (R-8: 계좌·사업자번호 보관)
// 포맷: iv(12) || tag(16) || ciphertext  → base64 (또는 VARBINARY 그대로)

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = env.CRYPTO_DATA_KEY;
  // base64 또는 hex 둘 다 허용
  const buf = /^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 44
    ? Buffer.from(raw, 'base64')
    : Buffer.from(raw, 'hex');
  if (buf.length !== 32) {
    throw new Error(`CRYPTO_DATA_KEY must decode to 32 bytes (got ${buf.length})`);
  }
  return buf;
}

export function encryptColumn(plaintext: string): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptColumn(payload: Buffer | string): string {
  const buf = typeof payload === 'string' ? Buffer.from(payload, 'base64') : payload;
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('decryptColumn: payload too short');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
