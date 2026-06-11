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
const ROLE_BY_PARTNER: Record<string, 'university' | 'enterprise' | 'mentor' | 'edu_platform' | null> = {
  university: 'university',
  company: 'enterprise',
  mentor_org: 'mentor',
  edu_platform: 'edu_platform', // 교육·활동 플랫폼: 제휴사 포털 로그인 발급(콘텐츠·배너·성과 관리)
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
        // 010: 자체 가입 계정은 비활성(is_active=0)으로 생성 → 운영자 승인 전까지 로그인 불가(승인 게이트).
        const [uins] = await conn.query(
          'INSERT INTO users (email, password_hash, role, email_verified, is_active) VALUES (?, ?, ?, 0, 0)',
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

// ── 010: 파트너 가입 승인(운영자) ──
// 자체 가입은 partner.status='pending' + 계정 is_active=0 으로 저장된다.
// 운영자가 승인(active)하면 연결된 로그인 계정을 활성화하고, 거절/정지는 비활성 유지.
const listPartnersQuery = z.object({
  status: z.enum(['pending', 'active', 'rejected', 'suspended']).optional(),
});
async function listPartnersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.query as z.infer<typeof listPartnersQuery>;
    const [rows] = await getPool().query(
      `SELECT p.id, p.type, p.name, p.status, p.created_at,
              pa.user_id, u.email, u.is_active
       FROM partner p
       LEFT JOIN partner_account pa ON pa.partner_id = p.id
       LEFT JOIN users u ON u.id = pa.user_id
       ${status ? 'WHERE p.status = ?' : ''}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 200`,
      status ? [status] : [],
    );
    res.status(200).json({ items: rows });
  } catch (err) {
    next(err);
  }
}

const partnerStatusParams = z.object({ id: z.coerce.number().int().positive() });
const partnerStatusBody = z.object({ status: z.enum(['active', 'rejected', 'suspended']) });
async function setPartnerStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof partnerStatusParams>;
    const { status } = req.body as z.infer<typeof partnerStatusBody>;
    await withTransaction(async (conn) => {
      const [upd] = await conn.query('UPDATE partner SET status = ? WHERE id = ?', [status, id]);
      if ((upd as { affectedRows: number }).affectedRows === 0) {
        throw new HttpError(404, 'PARTNER_NOT_FOUND', '파트너를 찾을 수 없습니다.');
      }
      // 승인 시 연결된 로그인 계정 활성화, 거절·정지는 비활성화.
      const active = status === 'active' ? 1 : 0;
      await conn.query(
        `UPDATE users u JOIN partner_account pa ON pa.user_id = u.id
         SET u.is_active = ? WHERE pa.partner_id = ?`,
        [active, id],
      );
    });
    res.status(200).json({ id, status });
  } catch (err) {
    next(err);
  }
}

export const adminPartnersRouter: Router = Router();
adminPartnersRouter.use(requireAuth, requireRole('admin'));
adminPartnersRouter.get('/', validate({ query: listPartnersQuery }), listPartnersHandler);
adminPartnersRouter.patch(
  '/:id/status',
  validate({ params: partnerStatusParams, body: partnerStatusBody }),
  setPartnerStatusHandler,
);
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

// ── 교육·활동 플랫폼 제휴사 포털(role=edu_platform) ──
// 콘텐츠(자격증/공모전/대외활동)를 /feeds 로 발행 + 제휴 배너 관리 + 노출/클릭 성과.
async function resolvePartnerId(userId: number): Promise<number> {
  const [rows] = await getPool().query(
    'SELECT partner_id FROM partner_account WHERE user_id = ? LIMIT 1',
    [userId],
  );
  const pid = (rows as Array<{ partner_id: number }>)[0]?.partner_id;
  if (!pid) throw new HttpError(403, 'NO_PARTNER', '연결된 파트너가 없습니다.');
  return pid;
}
const partnerUserId = (req: Request): number => {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
};

async function portalOverviewHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pid = await resolvePartnerId(partnerUserId(req));
    const pool = getPool();
    const [[p]] = (await pool.query('SELECT id, type, name, status FROM partner WHERE id = ?', [pid])) as unknown as [Array<Record<string, unknown>>];
    const src = `partner-${pid}`;
    const [[feed]] = (await pool.query("SELECT COUNT(*) AS c FROM external_feed_item WHERE source = ?", [src])) as unknown as [Array<{ c: number }>];
    const [[banner]] = (await pool.query('SELECT COUNT(*) AS c, COALESCE(SUM(active),0) AS active FROM partner_banner WHERE partner_id = ?', [pid])) as unknown as [Array<{ c: number; active: number }>];
    const [conv] = (await pool.query(
      `SELECT bc.event, COUNT(*) AS c FROM banner_conversion bc
       JOIN partner_banner pb ON pb.id = bc.partner_banner_id
       WHERE pb.partner_id = ? GROUP BY bc.event`,
      [pid],
    )) as unknown as [Array<{ event: string; c: number }>];
    const clicks = Number(conv.find((r) => r.event === 'click')?.c ?? 0);
    const conversions = Number(conv.find((r) => r.event === 'convert')?.c ?? 0);
    res.status(200).json({
      partner: p,
      feed_count: Number(feed?.c ?? 0),
      banner_count: Number(banner?.c ?? 0),
      banner_active: Number(banner?.active ?? 0),
      clicks,
      conversions,
    });
  } catch (err) {
    next(err);
  }
}

async function portalListFeedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pid = await resolvePartnerId(partnerUserId(req));
    const [rows] = await getPool().query(
      `SELECT id, kind, title, freshness, DATE_FORMAT(collected_at, '%Y-%m-%dT%H:%i:%sZ') AS collected_at
       FROM external_feed_item WHERE source = ? ORDER BY collected_at DESC, id DESC LIMIT 100`,
      [`partner-${pid}`],
    );
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
}

const feedItemBody = z.object({
  kind: z.enum(['certification', 'contest']),
  title: z.string().min(1).max(300),
});
async function portalCreateFeedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pid = await resolvePartnerId(partnerUserId(req));
    const b = req.body as z.infer<typeof feedItemBody>;
    const src = `partner-${pid}`;
    const extId = `p${pid}-${Date.now()}`;
    await getPool().query(
      `INSERT INTO external_feed_item (kind, source, external_id, title, freshness, payload)
       VALUES (?, ?, ?, ?, 'fresh', '{}')`,
      [b.kind, src, extId, b.title],
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function portalListBannersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pid = await resolvePartnerId(partnerUserId(req));
    const [rows] = await getPool().query(
      'SELECT id, title, landing_url, discount_text, active FROM partner_banner WHERE partner_id = ? ORDER BY id DESC',
      [pid],
    );
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
}

const bannerBody = z.object({
  title: z.string().min(1).max(200),
  landing_url: z.string().url().max(400),
  discount_text: z.string().max(120).optional(),
});
async function portalCreateBannerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pid = await resolvePartnerId(partnerUserId(req));
    const b = req.body as z.infer<typeof bannerBody>;
    const [ins] = await getPool().query(
      `INSERT INTO partner_banner (partner_id, title, landing_url, discount_text, active) VALUES (?, ?, ?, ?, 1)`,
      [pid, b.title, b.landing_url, b.discount_text ?? null],
    );
    res.status(201).json({ id: (ins as { insertId: number }).insertId });
  } catch (err) {
    next(err);
  }
}

const bannerToggleParams = z.object({ id: z.coerce.number().int().positive() });
const bannerToggleBody = z.object({ active: z.boolean() });
async function portalToggleBannerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pid = await resolvePartnerId(partnerUserId(req));
    const { id } = req.params as unknown as z.infer<typeof bannerToggleParams>;
    const { active } = req.body as z.infer<typeof bannerToggleBody>;
    const [r] = await getPool().query(
      'UPDATE partner_banner SET active = ? WHERE id = ? AND partner_id = ?',
      [active ? 1 : 0, id, pid],
    );
    if ((r as { affectedRows: number }).affectedRows === 0) {
      throw new HttpError(404, 'BANNER_NOT_FOUND', '배너를 찾을 수 없습니다.');
    }
    res.status(200).json({ id, active });
  } catch (err) {
    next(err);
  }
}

export const partnerPortalRouter: Router = Router();
partnerPortalRouter.use(requireAuth, requireRole('edu_platform'));
partnerPortalRouter.get('/overview', portalOverviewHandler);
partnerPortalRouter.get('/feed-items', portalListFeedHandler);
partnerPortalRouter.post('/feed-items', validate({ body: feedItemBody }), portalCreateFeedHandler);
partnerPortalRouter.get('/banners', portalListBannersHandler);
partnerPortalRouter.post('/banners', validate({ body: bannerBody }), portalCreateBannerHandler);
partnerPortalRouter.patch('/banners/:id', validate({ params: bannerToggleParams, body: bannerToggleBody }), portalToggleBannerHandler);

export default partnersRouter;
