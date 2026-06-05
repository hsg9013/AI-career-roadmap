import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateDocument, listDocuments, updateDocument } from '../../services/documents.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T033: 문서 핸들러 (US3)

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const generateBodySchema = z.object({
  doc_type: z.enum(['resume', 'coverletter', 'portfolio']),
});

export const updateParamsSchema = z.object({ docId: z.coerce.number().int().positive() });
export const updateBodySchema = z.object({
  title: z.string().max(200).optional(),
  content: z.unknown().optional(),
  status: z.enum(['draft', 'final']).optional(),
});

export async function generateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof generateBodySchema>;
    const doc = await generateDocument(userId(req), body.doc_type);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listDocuments(userId(req)));
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { docId } = req.params as unknown as z.infer<typeof updateParamsSchema>;
    const body = req.body as z.infer<typeof updateBodySchema>;
    res.status(200).json(await updateDocument(userId(req), docId, body));
  } catch (err) {
    next(err);
  }
}
