import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { checkout, listMentorPayouts } from '../../services/payments.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T056: 결제/정산 핸들러 (US8)

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const checkoutBodySchema = z.object({
  kind: z.enum(['membership', 'one_time']).default('membership'),
  amount: z.number().int(),
  plan: z.string().max(40).default('standard'),
});

export async function checkoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof checkoutBodySchema>;
    const result = await checkout(userId(req), body.kind, body.amount, body.plan);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function mentorPayoutsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listMentorPayouts(userId(req)));
  } catch (err) {
    next(err);
  }
}
