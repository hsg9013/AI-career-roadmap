import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.js';

// T068: 계약 테스트 — contracts/openapi.yaml 의 엔드포인트가 실제로 마운트되어 있는지 검증.
// 인증 없이 호출 시 보호 라우트는 401(또는 검증 422)을 반환해야 하며 404(미마운트)는 실패로 간주.

interface ContractRoute {
  method: 'get' | 'post' | 'put';
  path: string;
  public?: boolean;
}

// openapi.yaml 의 paths 에 대응 (path 파라미터는 더미 1 로 치환)
const ROUTES: ContractRoute[] = [
  { method: 'post', path: '/v1/auth/login', public: true },
  { method: 'put', path: '/v1/students/me' },
  { method: 'post', path: '/v1/gap-diagnosis' },
  { method: 'post', path: '/v1/roadmap' },
  { method: 'post', path: '/v1/roadmap/items/1/reject' },
  { method: 'post', path: '/v1/roadmap/items/1/complete' },
  { method: 'post', path: '/v1/documents' },
  { method: 'put', path: '/v1/documents/1' },
  { method: 'post', path: '/v1/missions/1/submissions' },
  { method: 'get', path: '/v1/submissions' },
  { method: 'get', path: '/v1/submissions/1/feedback' },
  { method: 'get', path: '/v1/notifications' },
  { method: 'get', path: '/v1/university/students' },
  { method: 'get', path: '/v1/companies/candidates' },
  { method: 'post', path: '/v1/payments/checkout' },
  { method: 'get', path: '/v1/payments/mentor-payouts' },
  { method: 'post', path: '/v1/alumni/paths' },
  // 003 델타 엔드포인트 (T049)
  { method: 'get', path: '/v1/catalog/industries', public: true },
  { method: 'get', path: '/v1/catalog/industries/IT/jobs', public: true },
  { method: 'get', path: '/v1/ops/health', public: true },
  { method: 'get', path: '/v1/ops/metrics' },
  { method: 'get', path: '/v1/feeds/items' },
  { method: 'post', path: '/v1/payments/webhook', public: true },
  { method: 'get', path: '/v1/payments/1' },
  { method: 'get', path: '/v1/notifications/settings' },
  { method: 'put', path: '/v1/notifications/settings' },
  { method: 'post', path: '/v1/notifications/devices' },
  { method: 'post', path: '/v1/auth/school-email/verify' },
  { method: 'get', path: '/v1/auth/school-email/status' },
  { method: 'post', path: '/v1/auth/school-email/confirm', public: true },
  // 004 델타 엔드포인트 (T040)
  { method: 'get', path: '/v1/students/me/profile-completeness' },
  { method: 'get', path: '/v1/membership/tiers', public: true },
  { method: 'get', path: '/v1/membership/me' },
  { method: 'get', path: '/v1/paid-services', public: true },
  { method: 'post', path: '/v1/paid-services/mentoring/order' },
  { method: 'get', path: '/v1/ads/recommended-jobs' },
  { method: 'post', path: '/v1/ads/1/impression' },
  { method: 'get', path: '/v1/partners/banners', public: true },
  { method: 'post', path: '/v1/partners/banners/1/track', public: true },
  { method: 'post', path: '/v1/admin/partners' },
  { method: 'post', path: '/v1/admin/licenses' },
];

let app: Express;
beforeAll(() => {
  app = createApp();
});

describe('T068 OpenAPI 계약 — 엔드포인트 마운트', () => {
  it.each(ROUTES)('$method $path 가 마운트되어 있다 (404 아님)', async (route) => {
    const res = await request(app)[route.method](route.path).send({});
    expect(res.status).not.toBe(404);
    if (!route.public) {
      // 보호 라우트는 인증 없이 401
      expect([401, 422]).toContain(res.status);
    }
  });
});
