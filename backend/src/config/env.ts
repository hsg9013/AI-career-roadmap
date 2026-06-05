import { z } from 'zod';

// T016: zod 기반 .env 검증. 필수 키 누락 시 부팅 실패.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('Asia/Seoul'),

  PORT: z.coerce.number().int().default(9536),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be ≥32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be ≥32 chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().default(30),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:9516,https://p16.sumzip.com')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_USER: z.string().default('pioneer16'),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().default('pioneer16'),
  DB_POOL_MAX: z.coerce.number().int().default(10),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  S3_ENDPOINT: z.string().default('http://127.0.0.1:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET_PORTFOLIOS: z.string().default('portfolios'),
  S3_BUCKET_SUBMISSIONS: z.string().default('mission-submissions'),
  S3_BUCKET_DATA_EXPORTS: z.string().default('data-exports'),
  S3_BUCKET_INVOICES: z.string().default('invoices'),

  // 외부 통합 — 개발에선 비어 있을 수 있어 optional
  LLM_PROVIDER: z.string().default('anthropic'),
  LLM_API_KEY: z.string().optional().default(''),
  LLM_MODEL: z.string().default('claude-haiku-4-5'),

  PORTONE_IMP_KEY: z.string().optional().default(''),
  PORTONE_IMP_SECRET: z.string().optional().default(''),
  PORTONE_PAYOUTS_API_KEY: z.string().optional().default(''),
  PORTONE_PAYOUTS_API_SECRET: z.string().optional().default(''),
  PAYOUT_MONTHLY_CRON: z.string().default('0 2 1 * *'),
  PAYOUT_WITHHOLDING_BPS: z.coerce.number().int().default(330),

  MAILER_PROVIDER: z.string().default('naver-cloud'),
  MAILER_API_KEY: z.string().optional().default(''),
  MAILER_FROM: z.string().default('no-reply@p16.sumzip.com'),

  FCM_SERVER_KEY: z.string().optional().default(''),
  APNS_KEY_ID: z.string().optional().default(''),
  APNS_TEAM_ID: z.string().optional().default(''),
  APNS_BUNDLE_ID: z.string().default('com.sumzip.p16'),
  APNS_KEY_P8_PATH: z.string().optional().default(''),

  OAUTH_GOOGLE_CLIENT_ID: z.string().optional().default(''),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  OAUTH_NAVER_CLIENT_ID: z.string().optional().default(''),
  OAUTH_NAVER_CLIENT_SECRET: z.string().optional().default(''),

  // 컬럼 암호화용 (T022 aesGcm) — 32바이트 base64 또는 hex
  CRYPTO_DATA_KEY: z
    .string()
    .min(44, 'CRYPTO_DATA_KEY must be ≥32 raw bytes (base64 ≥44 chars)')
    .optional()
    .default('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[env] validation failed:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  cached = parsed.data;
  return cached;
}

export const env = loadEnv();
