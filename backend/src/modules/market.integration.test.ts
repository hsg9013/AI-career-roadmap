import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { MEMBERSHIP_TIERS, hasFeature } from '../services/membership.js';
import { satisfiesKAnonymity } from '../lib/privacy/index.js';

// 004 T041: 통합 테스트 — 멤버십 게이팅·광고/제휴 동의 노출(미노출 기본)·k-익명성.

let app: Express;
beforeAll(() => {
  app = createApp();
});

describe('004 멤버십 등급·게이팅', () => {
  it('GET /v1/membership/tiers 는 무료·프리미엄 2단계를 반환한다', async () => {
    const res = await request(app).get('/v1/membership/tiers');
    expect(res.status).toBe(200);
    const codes = (res.body.tiers as Array<{ code: string }>).map((t) => t.code);
    expect(codes).toContain('free');
    expect(codes).toContain('premium');
  });

  it('MEMBERSHIP_TIERS 정의가 일관된다', () => {
    expect(MEMBERSHIP_TIERS).toHaveLength(2);
    const premium = MEMBERSHIP_TIERS.find((t) => t.code === 'premium');
    expect(premium?.features.length).toBeGreaterThan(0);
  });

  it('비-프리미엄(무료) 기능 키는 게이팅 없이 허용된다(DB 불필요)', async () => {
    // 프리미엄 전용 키가 아니면 항상 true (단락 평가)
    await expect(hasFeature(0, 'some_free_feature' as never)).resolves.toBe(true);
  });
});

describe('004 광고·제휴 노출(동의/플래그 기본 off → 미노출)', () => {
  it('GET /v1/paid-services 는 실무 단건 서비스를 반환한다', async () => {
    const res = await request(app).get('/v1/paid-services');
    expect(res.status).toBe(200);
    expect((res.body.items as unknown[]).length).toBeGreaterThanOrEqual(4);
  });

  it('GET /v1/partners/banners 는 AFFILIATE off 기본에서 빈 목록(미노출)', async () => {
    const res = await request(app).get('/v1/partners/banners');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('GET /v1/ads/recommended-jobs 는 무인증 시 401(동의·인증 게이트)', async () => {
    const res = await request(app).get('/v1/ads/recommended-jobs');
    expect(res.status).toBe(401);
  });
});

describe('004 k-익명성(표본 ≥5)', () => {
  it('표본 4명은 미달, 5명은 충족', () => {
    expect(satisfiesKAnonymity(4)).toBe(false);
    expect(satisfiesKAnonymity(5)).toBe(true);
  });
});
