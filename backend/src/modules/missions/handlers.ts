import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  listMissions,
  submitMission,
  getSubmissionFeedback,
  listMySubmissions,
  addMentorFeedback,
  listMentorAssignments,
} from '../../services/missions.js';
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

// 005 US4(H4): 멘토 심층 코멘트 작성 입력.
export const mentorFeedbackParamsSchema = z.object({ submissionId: z.coerce.number().int().positive() });
export const mentorFeedbackBodySchema = z.object({ content: z.string().min(1).max(20000) });

export async function listHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 004 US3/G2: 학생 목표 직무 기준으로 미션 필터(멘토 출제 우선)
    res.status(200).json(await listMissions(userId(req)));
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

// 005 US4: 학생 본인 제출물 목록.
export async function mySubmissionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listMySubmissions(userId(req)));
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

// 005 US4(H4): 멘토가 학생 제출물에 심층 코멘트 작성.
export async function mentorFeedbackHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { submissionId } = req.params as unknown as z.infer<typeof mentorFeedbackParamsSchema>;
    const body = req.body as z.infer<typeof mentorFeedbackBodySchema>;
    res.status(201).json(await addMentorFeedback(userId(req), submissionId, body.content));
  } catch (err) {
    next(err);
  }
}

// 005 US4(H4): 멘토에게 배정된 검수 대기 제출물 목록.
export async function mentorAssignmentsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listMentorAssignments(userId(req)));
  } catch (err) {
    next(err);
  }
}
