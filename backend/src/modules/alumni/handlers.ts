import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { donatePath } from '../../services/alumni.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T060: 선배 데이터 기부 핸들러 (US9)

const ACTIVITY_TYPES = [
  'course', 'project', 'club', 'volunteer', 'contest', 'external', 'internship', 'award', 'certification',
] as const;

export const donateBodySchema = z.object({
  industry_code: z.string().min(1).max(40),
  job_role_code: z.string().min(1).max(80),
  major_field: z.string().min(1).max(80),
  year_in_school: z.number().int().min(1).max(6).optional(),
  grade_band: z.enum(['y1_2', 'y3', 'y4plus']).optional(),
  success_year: z.number().int().min(2000).max(2100),
  activities: z
    .array(
      z.object({
        period: z.string().min(1).max(40),
        activity_type: z.enum(ACTIVITY_TYPES),
        detail: z.string().min(1).max(200),
        skill_tag: z.string().max(80).nullish(),
      }),
    )
    .min(1)
    .max(40),
});

export async function donateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    const body = req.body as z.infer<typeof donateBodySchema>;
    const result = await donatePath(req.auth.sub, body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
