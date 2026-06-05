import type { Request, Response, NextFunction } from 'express';
import { getUniversityStudents } from '../../services/university.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T046: 대학 현황 핸들러 (US6, role=university)

export async function studentsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    res.status(200).json(await getUniversityStudents(req.auth.sub));
  } catch (err) {
    next(err);
  }
}
