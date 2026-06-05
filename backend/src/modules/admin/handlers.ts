import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listReports, resolveReport, metrics, usageBreakdown } from '../../services/admin.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T062: 운영자 핸들러 (role=admin)

function adminId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const reportsQuerySchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'rejected']).optional(),
});
export const resolveParamsSchema = z.object({ id: z.coerce.number().int().positive() });
export const resolveBodySchema = z.object({
  status: z.enum(['reviewing', 'resolved', 'rejected']),
  resolution: z.string().max(200).optional(),
});

export async function reportsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof reportsQuerySchema>;
    res.status(200).json(await listReports(q.status));
  } catch (err) {
    next(err);
  }
}

export async function resolveHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof resolveParamsSchema>;
    const body = req.body as z.infer<typeof resolveBodySchema>;
    await resolveReport(adminId(req), id, body.status, body.resolution);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function metricsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await metrics());
  } catch (err) {
    next(err);
  }
}

export async function usageHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await usageBreakdown());
  } catch (err) {
    next(err);
  }
}
