import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listJobPostings } from '../../services/jobpostings.js';

// 채용 공고 목록 (인증 사용자). 신선도(freshness)는 응답에 그대로 노출.

export const listQuerySchema = z.object({
  industry_code: z.string().max(40).optional(),
  job_role_code: z.string().max(80).optional(),
});

export async function listHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    res.status(200).json(await listJobPostings(q));
  } catch (err) {
    next(err);
  }
}
