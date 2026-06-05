import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateRoadmap, rejectItem, getLatestRoadmap } from '../../services/roadmap.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T027/T028: 로드맵 핸들러 (US2)
//   POST /v1/roadmap                       — 합격 로드맵 생성 (FR-005)
//   GET  /v1/roadmap/latest?target_job_id  — 최신 로드맵 조회
//   POST /v1/roadmap/items/:itemId/reject  — 추천 거부 (FR-006)

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const generateBodySchema = z.object({
  target_job_id: z.number().int().positive(),
});

export const latestQuerySchema = z.object({
  target_job_id: z.coerce.number().int().positive(),
});

export const rejectParamsSchema = z.object({
  itemId: z.coerce.number().int().positive(),
});

export const rejectBodySchema = z.object({
  reason: z.string().max(200).optional(),
});

export async function generateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof generateBodySchema>;
    const roadmap = await generateRoadmap(userId(req), body.target_job_id);
    res.status(200).json(roadmap);
  } catch (err) {
    next(err);
  }
}

export async function latestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof latestQuerySchema>;
    const roadmap = await getLatestRoadmap(userId(req), q.target_job_id);
    if (!roadmap) {
      res.status(404).json({ code: 'NO_ROADMAP_YET', message: 'No roadmap generated yet' });
      return;
    }
    res.status(200).json(roadmap);
  } catch (err) {
    next(err);
  }
}

export async function rejectHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { itemId } = req.params as unknown as z.infer<typeof rejectParamsSchema>;
    const body = req.body as z.infer<typeof rejectBodySchema>;
    await rejectItem(userId(req), itemId, body.reason);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
