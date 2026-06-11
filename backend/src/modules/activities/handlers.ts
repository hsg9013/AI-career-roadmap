import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ACTIVITY_CATEGORIES,
  listActivities,
  createActivity,
  patchActivity,
  deleteActivity,
  type ActivityCategory,
} from './service.js';
import { HttpError } from '../../middlewares/errorHandler.js';

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const listQuerySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export async function listHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    const result = await listActivities(userId(req), {
      category: q.category as ActivityCategory | undefined,
      page: q.page,
      pageSize: q.page_size,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// 005 US5(H5): 기간 검증 — 종료일이 있으면 시작일보다 빠를 수 없다(진행 중이면 null).
const endNotBeforeStart = (v: { started_at?: string; ended_at?: string | null }): boolean =>
  !v.ended_at || !v.started_at || v.ended_at >= v.started_at;
const periodMsg = { message: '종료일은 시작일보다 빠를 수 없습니다.', path: ['ended_at'] };

const activityBaseSchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  started_at: dateString,
  ended_at: dateString.nullable().optional(),
  outcome: z.string().nullable().optional(),
  manual_tags: z.array(z.string().min(1).max(80)).max(20).optional(),
});

export const activityInputSchema = activityBaseSchema.refine(endNotBeforeStart, periodMsg);

export const activityPatchSchema = activityBaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' })
  .refine(endNotBeforeStart, periodMsg);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function createHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof activityInputSchema>;
    const created = await createActivity(userId(req), body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function patchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = req.params as unknown as z.infer<typeof idParamSchema>;
    const body = req.body as z.infer<typeof activityPatchSchema>;
    const updated = await patchActivity(userId(req), Number(params.id), body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = req.params as unknown as z.infer<typeof idParamSchema>;
    await deleteActivity(userId(req), Number(params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
