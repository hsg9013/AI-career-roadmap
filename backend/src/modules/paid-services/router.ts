import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/requestValidator.js';
import { getPool } from '../../db/pool.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// 004 US6/G5: 실무 단건 서비스 목록 + 건당 주문(결제는 003 결제 흐름과 연계 예정).

async function listHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await getPool().query(
      'SELECT code, name, fee FROM paid_service WHERE active = TRUE ORDER BY fee ASC',
    );
    res.status(200).json({ items: rows });
  } catch (err) {
    next(err);
  }
}

const orderParams = z.object({ code: z.string().min(1).max(40) });
async function orderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
    const { code } = req.params as unknown as z.infer<typeof orderParams>;
    const pool = getPool();
    const [svc] = await pool.query('SELECT code, fee FROM paid_service WHERE code = ? AND active = TRUE LIMIT 1', [code]);
    if (!(svc as unknown[]).length) throw new HttpError(404, 'SERVICE_NOT_FOUND', 'Unknown paid service');
    const [sRows] = await pool.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [req.auth.sub]);
    const student = (sRows as Array<{ id: number }>)[0];
    if (!student) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Student profile required');
    const [ins] = await pool.query(
      "INSERT INTO paid_service_order (student_id, service_code, status) VALUES (?, ?, 'pending')",
      [student.id, code],
    );
    res.status(201).json({
      order_id: (ins as { insertId: number }).insertId,
      service_code: code,
      status: 'pending',
      next: '결제(003 PortOne 흐름)로 진행',
    });
  } catch (err) {
    next(err);
  }
}

const paidServicesRouter: Router = Router();
paidServicesRouter.get('/', listHandler);
paidServicesRouter.post('/:code/order', requireAuth, requireRole('student'), validate({ params: orderParams }), orderHandler);

export default paidServicesRouter;
