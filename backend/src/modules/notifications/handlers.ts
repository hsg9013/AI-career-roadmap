import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listNotifications, markRead } from '../../services/notifications.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T042: 알림 핸들러 (US5)

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const listQuerySchema = z.object({
  unread: z.coerce.boolean().optional(),
});
export const readParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function listHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    res.status(200).json(await listNotifications(userId(req), q.unread ?? false));
  } catch (err) {
    next(err);
  }
}

export async function readHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof readParamsSchema>;
    const ok = await markRead(userId(req), id);
    if (!ok) {
      res.status(404).json({ code: 'NOTIFICATION_NOT_FOUND', message: 'Not found or already read' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
