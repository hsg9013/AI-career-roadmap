import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { searchCandidates, setMatchConsent } from '../../services/companies.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T050: 기업 후보 검색(enterprise) + 학생 매칭 동의 설정(student)

export const candidatesQuerySchema = z.object({
  industry_code: z.string().max(40).optional(),
  job_role_code: z.string().max(80).optional(),
});
export const consentBodySchema = z.object({ opted_in: z.boolean() });

export async function candidatesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof candidatesQuerySchema>;
    res.status(200).json(await searchCandidates(q));
  } catch (err) {
    next(err);
  }
}

export async function setConsentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    const body = req.body as z.infer<typeof consentBodySchema>;
    await setMatchConsent(req.auth.sub, body.opted_in);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
