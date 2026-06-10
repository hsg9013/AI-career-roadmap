import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/requestValidator.js';
import { getPool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// 004 US7/G5: 타겟 채용 광고(자체 슬롯). ADS_ENABLED off 또는 미동의 학생에게는 노출하지 않는다.

async function studentId(userId: number): Promise<number | null> {
  const [rows] = await getPool().query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  return (rows as Array<{ id: number }>)[0]?.id ?? null;
}

async function adsConsented(sid: number): Promise<boolean> {
  const [rows] = await getPool().query(
    'SELECT opted_in FROM job_match_consents WHERE student_id = ? LIMIT 1',
    [sid],
  );
  return Boolean((rows as Array<{ opted_in: number }>)[0]?.opted_in);
}

async function recommendedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    if (!env.ADS_ENABLED) {
      res.status(200).json({ items: [] });
      return;
    }
    const sid = await studentId(req.auth.sub);
    if (sid == null || !(await adsConsented(sid))) {
      res.status(200).json({ items: [] }); // 미동의 미노출(FR-012)
      return;
    }
    const [tj] = await getPool().query(
      'SELECT industry_code, job_role_code FROM target_jobs WHERE student_id = ? ORDER BY priority ASC, id ASC LIMIT 1',
      [sid],
    );
    const job = (tj as Array<{ industry_code: string; job_role_code: string }>)[0];
    if (!job) {
      res.status(200).json({ items: [] });
      return;
    }
    const [ads] = await getPool().query(
      `SELECT id, title, company_id, industry_code, job_role_code, TRUE AS sponsored
       FROM job_ad
       WHERE status = 'active' AND industry_code = ? AND job_role_code = ?
         AND (starts_on IS NULL OR starts_on <= CURDATE())
         AND (ends_on IS NULL OR ends_on >= CURDATE())
       ORDER BY budget DESC, id DESC LIMIT 20`,
      [job.industry_code, job.job_role_code],
    );
    res.status(200).json({ items: ads });
  } catch (err) {
    next(err);
  }
}

const impressionParams = z.object({ adId: z.coerce.number().int().positive() });
async function impressionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    const { adId } = req.params as unknown as z.infer<typeof impressionParams>;
    const sid = await studentId(req.auth.sub);
    await getPool().query('INSERT INTO job_ad_impression (job_ad_id, student_id) VALUES (?, ?)', [
      adId,
      sid,
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

const adsRouter: Router = Router();
adsRouter.use(requireAuth, requireRole('student'));
adsRouter.get('/recommended-jobs', recommendedHandler);
adsRouter.post('/:adId/impression', validate({ params: impressionParams }), impressionHandler);

export default adsRouter;
