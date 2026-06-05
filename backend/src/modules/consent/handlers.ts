import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPolicyForUser, recordConsent } from '../../services/consent.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T073: 처리방침 조회 + 재동의 핸들러

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const consentBodySchema = z.object({ version: z.string().min(1).max(20) });

export async function policyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await getPolicyForUser(userId(req)));
  } catch (err) {
    next(err);
  }
}

export async function consentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof consentBodySchema>;
    await recordConsent(userId(req), body.version);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
