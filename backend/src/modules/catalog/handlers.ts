import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listIndustries, listJobsByIndustry } from '../../services/catalog.js';

// 003 US2: 직무·산업 사전 조회 핸들러.

export const industryParamsSchema = z.object({
  industryCode: z.string().min(1).max(40),
});

export async function listIndustriesHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json(await listIndustries());
  } catch (err) {
    next(err);
  }
}

export async function listJobsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { industryCode } = req.params as z.infer<typeof industryParamsSchema>;
    res.status(200).json(await listJobsByIndustry(industryCode));
  } catch (err) {
    next(err);
  }
}
