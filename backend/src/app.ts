import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { rateLimit } from './middlewares/rateLimit.js';
import { checkReadiness } from './lib/health.js';
import authRouter from './modules/auth/router.js';
import studentsRouter from './modules/students/router.js';
import activitiesRouter from './modules/activities/router.js';
import gapDiagnosisRouter from './modules/gap-diagnosis/router.js';
import roadmapRouter from './modules/roadmap/router.js';
import documentsRouter from './modules/documents/router.js';
import { missionsRouter, submissionsRouter, mentorRouter } from './modules/missions/router.js';
import notificationsRouter from './modules/notifications/router.js';
import universityRouter from './modules/university/router.js';
import { companiesRouter, matchConsentRouter } from './modules/companies/router.js';
import paymentsRouter from './modules/payments/router.js';
import alumniRouter from './modules/alumni/router.js';
import jobPostingsRouter from './modules/jobpostings/router.js';
import adminRouter from './modules/admin/router.js';
import consentRouter from './modules/consent/router.js';
import catalogRouter from './modules/catalog/router.js';
import opsRouter from './modules/ops/router.js';
import feedsRouter from './modules/feeds/router.js';
import membershipRouter from './modules/membership/router.js';
import profileRouter from './modules/profile/router.js';
import adsRouter from './modules/ads/router.js';
import paidServicesRouter from './modules/paid-services/router.js';
import { partnersRouter, adminPartnersRouter, adminLicensesRouter } from './modules/partners/router.js';

// T035: 모든 미들웨어·라우터 와이어링

export function createApp(): Express {
  const app = express();

  // 보안 헤더
  app.use(helmet({
    contentSecurityPolicy: false, // CSP는 nginx에서 처리 (운영)
  }));

  // CORS — 운영 도메인 p16.sumzip.com + 로컬 dev 9516
  app.use(cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }));

  // requestId 주입
  app.use((req, _res, next) => {
    (req as express.Request & { id?: string }).id =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    next();
  });

  // 구조화 로그 (pino-http)
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request & { id?: string }).id ?? randomUUID(),
      customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    }),
  );

  // raw body 보존 — PortOne 웹훅 HMAC 서명 검증용(US3/T024).
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  // 헬스 체크 — 인증 무관
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // readyz — DB·Redis 실제 ping + S3·LLM 설정 판정 (T065)
  app.get('/readyz', (_req, res) => {
    void checkReadiness()
      .then((report) => res.status(report.status === 'ok' ? 200 : 503).json(report))
      .catch(() => res.status(503).json({ status: 'degraded', deps: { db: 'down', redis: 'down', s3: 'unknown', llm: 'unknown' } }));
  });

  // v1 API — 인증 영역은 별도 rate-limit 적용
  const v1 = express.Router();
  v1.use('/catalog', catalogRouter);
  v1.use('/ops', opsRouter);
  v1.use('/feeds', feedsRouter);
  v1.use('/auth', rateLimit({ windowSeconds: 60, max: 30, keyPrefix: 'rl:auth' }), authRouter);
  v1.use('/students/me/match-consent', matchConsentRouter);
  v1.use('/students/me/profile-completeness', profileRouter);
  v1.use('/membership', membershipRouter);
  v1.use('/ads', adsRouter);
  v1.use('/paid-services', paidServicesRouter);
  v1.use('/partners', partnersRouter);
  v1.use('/admin/partners', adminPartnersRouter);
  v1.use('/admin/licenses', adminLicensesRouter);
  v1.use('/students', studentsRouter);
  v1.use('/activities', activitiesRouter);
  v1.use('/gap-diagnosis', gapDiagnosisRouter);
  v1.use('/roadmap', roadmapRouter);
  v1.use('/documents', documentsRouter);
  v1.use('/missions', missionsRouter);
  v1.use('/submissions', submissionsRouter);
  v1.use('/mentor', mentorRouter);
  v1.use('/notifications', notificationsRouter);
  v1.use('/university', universityRouter);
  v1.use('/companies', companiesRouter);
  v1.use('/payments', paymentsRouter);
  v1.use('/alumni', alumniRouter);
  v1.use('/job-postings', jobPostingsRouter);
  v1.use('/admin', adminRouter);
  v1.use('/consent', consentRouter);
  app.use('/v1', v1);

  // 404 → 통합 에러 핸들러
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
