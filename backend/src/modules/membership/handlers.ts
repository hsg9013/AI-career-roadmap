import type { Request, Response, NextFunction } from 'express';
import { MEMBERSHIP_TIERS, getActiveTier } from '../../services/membership.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// 004 US6/G5: 멤버십 등급 비교표 + 내 등급 조회.

export async function tiersHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ tiers: MEMBERSHIP_TIERS });
  } catch (err) {
    next(err);
  }
}

export async function myTierHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    res.status(200).json({ tier: await getActiveTier(req.auth.sub) });
  } catch (err) {
    next(err);
  }
}
