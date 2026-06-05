import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { diagnoseGap, getLatestDiagnosis } from '../../services/gapDiagnosis.js';
import { getGapInsight } from '../../services/recommendation/gateway.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T050: 갭 진단 핸들러
//   POST /v1/gap-diagnosis        — 새 진단 계산 + 스냅샷 저장 + 보조 insight
//   GET  /v1/gap-diagnosis/latest — 최신 스냅샷 조회

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const triggerBodySchema = z.object({
  target_job_id: z.number().int().positive(),
});

export const latestQuerySchema = z.object({
  target_job_id: z.coerce.number().int().positive(),
});

export async function triggerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof triggerBodySchema>;
    const { diagnosis, job_role } = await diagnoseGap(userId(req), body.target_job_id);

    // 보조 narrative — 외부 LLM 미설정 시 룰 기반 fallback (graceful degrade)
    const insight = await getGapInsight({
      job_role,
      fulfilled: diagnosis.payload.fulfilled,
      missing: diagnosis.payload.missing,
      priority_to_improve: diagnosis.payload.priority_to_improve,
      score: diagnosis.overall_score,
    });

    res.status(200).json({ ...diagnosis, insight });
  } catch (err) {
    next(err);
  }
}

export async function latestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof latestQuerySchema>;
    const result = await getLatestDiagnosis(userId(req), q.target_job_id);
    if (!result) {
      res.status(404).json({ code: 'NO_DIAGNOSIS_YET', message: 'No diagnosis recorded yet' });
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
