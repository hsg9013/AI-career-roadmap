import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listFeedItems } from '../../services/feeds/index.js';

// 003 US5(T041): 외부 수집 피드 조회. freshness(fresh/stale) 를 응답에 그대로 노출 → 웹 '최신 아님' 표시.

export const listQuerySchema = z.object({
  kind: z.enum(['jobposting', 'certification', 'contest']).optional(),
  source: z.string().max(60).optional(),
  freshness: z.enum(['fresh', 'stale']).optional(),
});

export async function listHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    res.status(200).json(await listFeedItems(q));
  } catch (err) {
    next(err);
  }
}
