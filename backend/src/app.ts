import express, { type Express } from 'express';

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  // 미들웨어·라우터는 Phase 2(T035)에서 와이어링
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  return app;
}
