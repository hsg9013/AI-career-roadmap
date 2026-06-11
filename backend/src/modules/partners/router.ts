import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/requestValidator.js';
import { getPool } from '../../db/pool.js';
import { withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// 004 US8/G5: 외부 교육 제휴 배너(자체 집계). AFFILIATE_ENABLED off 시 미노출.
// 004 US5/G4: 파트너 운영자 수동 등록(admin). 004 US9: 라이선스 등록(admin).

// ── 제휴 배너(공개 조회) ──
async function bannersHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.AFFILIATE_ENABLED) {
      res.status(200).json({ items: [] });
      return;
    }
    const [rows] = await getPool().query(
      `SELECT id, title, image_url, landing_url, discount_text, TRUE AS sponsored
       FROM partner_banner WHERE active = TRUE ORDER BY id DESC LIMIT 20`,
    );
    res.status(200).json({ items: rows });
  } catch (err) {
    next(err);
  }
}

const trackParams = z.object({ id: z.coerce.number().int().positive() });
const trackBody = z.object({ event: z.enum(['click', 'convert']) });
async function trackHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof trackParams>;
    const { event } = req.body as z.infer<typeof trackBody>;
    const sid = req.auth
      ? ((await getPool().query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [req.auth.sub]))[0] as Array<{ id: number }>)[0]?.id ?? null
      : null;
    await getPool().query(
      'INSERT INTO banner_conversion (partner_banner_id, student_id, event) VALUES (?, ?, ?)',
      [id, sid, event],
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ── 005 US3(H3): 파트너 자체 회원가입 ──
// 004의 '운영자 수동 등록'과 조화: 자체 가입은 역할 계정을 발급하되 partner.status='pending'(운영자 활성화 게이트).
const ROLE_BY_PARTNER: Record<string, 'university' | 'enterprise' | 'mentor' | null> = {
  university: 'university',
  company: 'enterprise',
  mentor_org: 'mentor',
  edu_platform: null, // 교육·활동 플랫폼: 제휴 배너 제공자 — 로그인 역할 없음(파트너 레코드만)
};
const signupBody = z.object({
  partner_type: z.enum(['university', 'company', 'mentor_org', 'edu_platform']),
  org_name: z.string().min(1).max(160),
  contact_email: z.string().email().max(200),
  password: z.string().min(8).max(100).optional(),
});
async function signupHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body as z.infer<typeof signupBody>;
    const role = ROLE_BY_PARTNER[b.partner_type];
    const result = await withTransaction(async (conn) => {
      const [pins] = await conn.query(
        "INSERT INTO partner (type, name, consent_scope, status) VALUES (?, ?, 'stats', 'pending')",
        [b.partner_type, b.org_name],
      );
      const partnerId = (pins as { insertId: number }).insertId;
      let accountCreated = false;
      if (role) {
        if (!b.password) throw new HttpError(400, 'PASSWORD_REQUIRED', '이 파트너 유형은 로그인 비밀번호가 필요합니다.');
        const [ex] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [b.contact_email]);
        if ((ex as unknown[]).length) throw new HttpError(409, 'EMAIL_EXISTS', '이미 가입된 이메일입니다.');
        const hash = await bcrypt.hash(b.password, 10);
        const [uins] = await conn.query(
          'INSERT INTO users (email, password_hash, role, email_verified, is_active) VALUES (?, ?, ?, 0, 1)',
          [b.contact_email, hash, role],
        );
        await conn.query('INSERT INTO partner_account (partner_id, user_id) VALUES (?, ?)', [
          partnerId,
          (uins as { insertId: number }).insertId,
        ]);
        accountCreated = true;
      }
      return { partner_id: partnerId, partner_type: b.partner_type, role, status: 'pending', account_created: accountCreated };
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export const partnersRouter: Router = Router();
partnersRouter.get('/banners', bannersHandler);
partnersRouter.post('/banners/:id/track', validate({ params: trackParams, body: trackBody }), trackHandler);
partnersRouter.post('/signup', validate({ body: signupBody }), signupHandler);

// ── 파트너 등록(운영자) ──
const partnerInput = z.object({
  type: z.enum(['university', 'company', 'mentor_org', 'edu_platform', 'tech_partner']),
  name: z.string().min(1).max(160),
  consent_scope: z.enum(['none', 'stats', 'individual']).optional(),
  user_id: z.number().int().positive().optional(),
});
async function createPartnerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    const body = req.body as z.infer<typeof partnerInput>;
    const [ins] = await getPool().query(
      'INSERT INTO partner (type, name, consent_scope, registered_by) VALUES (?, ?, ?, ?)',
      [body.type, body.name, body.consent_scope ?? 'stats', req.auth.sub],
    );
    const partnerId = (ins as { insertId: number }).insertId;
    if (body.user_id) {
      await getPool().query('INSERT INTO partner_account (partner_id, user_id) VALUES (?, ?)', [
        partnerId,
        body.user_id,
      ]);
    }
    res.status(201).json({ id: partnerId, type: body.type, name: body.name });
  } catch (err) {
    next(err);
  }
}

export const adminPartnersRouter: Router = Router();
adminPartnersRouter.use(requireAuth, requireRole('admin'));
adminPartnersRouter.post('/', validate({ body: partnerInput }), createPartnerHandler);

// ── 라이선스 등록(운영자) US9 ──
const licenseInput = z.object({
  partner_id: z.number().int().positive(),
  type: z.enum(['university_saas', 'company_recruit']),
  scope: z.enum(['stats', 'individual']).optional(),
  seats: z.number().int().nonnegative().optional(),
  fee_year: z.number().int().nonnegative().optional(),
  commission_rate: z.number().nonnegative().optional(),
});
async function createLicenseHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body as z.infer<typeof licenseInput>;
    const [ins] = await getPool().query(
      `INSERT INTO license_contract (partner_id, type, scope, seats, fee_year, commission_rate)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [b.partner_id, b.type, b.scope ?? null, b.seats ?? null, b.fee_year ?? null, b.commission_rate ?? null],
    );
    res.status(201).json({ id: (ins as { insertId: number }).insertId });
  } catch (err) {
    next(err);
  }
}

export const adminLicensesRouter: Router = Router();
adminLicensesRouter.use(requireAuth, requireRole('admin'));
adminLicensesRouter.post('/', validate({ body: licenseInput }), createLicenseHandler);

export default partnersRouter;
