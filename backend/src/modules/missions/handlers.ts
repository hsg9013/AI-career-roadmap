import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listMissions, submitMission, getSubmissionFeedback } from '../../services/missions.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T038: 미션 핸들러 (US4)

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const submitParamsSchema = z.object({ missionId: z.coerce.number().int().positive() });
export const submitBodySchema = z.object({
  content: z.string().min(1).max(20000),
  storage_key: z.string().max(300).optional(),
});
export const feedbackParamsSchema = z.object({ submissionId: z.coerce.number().int().positive() });

export async function listHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listMissions());
  } catch (err) {
    next(err);
  }
}

export async function submitHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { missionId } = req.params as unknown as z.infer<typeof submitParamsSchema>;
    const body = req.body as z.infer<typeof submitBodySchema>;
    const result = await submitMission(userId(req), missionId, body.content, body.storage_key);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function feedbackHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { submissionId } = req.params as unknown as z.infer<typeof feedbackParamsSchema>;
    res.status(200).json(await getSubmissionFeedback(userId(req), submissionId));
  } catch (err) {
    next(err);
  }
}
