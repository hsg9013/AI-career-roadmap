import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { getPool } from '../../db/pool.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// 004 US1/G1: 활동·스펙 입력 충실도 — 문서·진단 전 안내용.
// 보유 스펙은 activities 의 자격/수상/인턴/아르바이트 카테고리로 집계(재사용).

const CREDENTIAL_CATEGORIES = ['certification', 'award', 'internship', 'part_time'];

async function completenessHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    const pool = getPool();
    const [sRows] = await pool.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [
      req.auth.sub,
    ]);
    const student = (sRows as Array<{ id: number }>)[0];
    if (!student) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile required');

    const [aRows] = await pool.query(
      'SELECT COUNT(*) AS c FROM activities WHERE student_id = ? AND deleted_at IS NULL',
      [student.id],
    );
    const placeholders = CREDENTIAL_CATEGORIES.map(() => '?').join(',');
    const [cRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM activities
       WHERE student_id = ? AND deleted_at IS NULL AND category IN (${placeholders})`,
      [student.id, ...CREDENTIAL_CATEGORIES],
    );
    const activitiesCount = Number((aRows as Array<{ c: number }>)[0]?.c ?? 0);
    const credentialsCount = Number((cRows as Array<{ c: number }>)[0]?.c ?? 0);
    const ready = activitiesCount > 0;

    res.status(200).json({
      activities_count: activitiesCount,
      credentials_count: credentialsCount,
      ready_for_documents: ready,
      next_recommended_input: ready
        ? null
        : '수강·프로젝트·대외활동·자격증·인턴십 등 활동·스펙을 1건 이상 입력하면 문서·진단·로드맵에 반영됩니다.',
    });
  } catch (err) {
    next(err);
  }
}

// /v1/students/me/profile-completeness 로 마운트
const profileRouter: Router = Router();
profileRouter.get('/', requireAuth, requireRole('student'), completenessHandler);

export default profileRouter;
