import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getProfile,
  updateProfile,
  listTargetJobs,
  replaceTargetJobs,
} from './service.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T047: 학생 프로필 + 목표 직무 핸들러

function authedUserId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export async function getMeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await getProfile(authedUserId(req));
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export const updateMeSchema = z
  .object({
    university: z.string().min(1).max(120).optional(),
    major: z.string().min(1).max(120).optional(),
    year_in_school: z.number().int().min(1).max(6).optional(),
    expected_grad_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected_grad_at must be YYYY-MM-DD')
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export async function updateMeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof updateMeSchema>;
    const profile = await updateProfile(authedUserId(req), body);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function listTargetJobsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const jobs = await listTargetJobs(authedUserId(req));
    res.status(200).json(jobs);
  } catch (err) {
    next(err);
  }
}

export const replaceTargetJobsSchema = z
  .array(
    z.object({
      industry_code: z.string().min(1).max(40),
      job_role_code: z.string().min(1).max(80),
      priority: z.number().int().min(1).max(3),
    }),
  )
  .max(3, 'Maximum 3 target jobs allowed');

export async function replaceTargetJobsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof replaceTargetJobsSchema>;
    const jobs = await replaceTargetJobs(authedUserId(req), body);
    res.status(200).json(jobs);
  } catch (err) {
    next(err);
  }
}
