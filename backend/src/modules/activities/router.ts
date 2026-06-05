import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  listHandler,
  listQuerySchema,
  createHandler,
  activityInputSchema,
  patchHandler,
  activityPatchSchema,
  deleteHandler,
  idParamSchema,
} from './handlers.js';

// T048: activities 라우터 — 학생 자신의 활동만 다룬다.

const router: Router = Router();

router.use(requireAuth, requireRole('student'));

router.get('/', validate({ query: listQuerySchema }), listHandler);
router.post('/', validate({ body: activityInputSchema }), createHandler);

router.patch(
  '/:id',
  validate({ params: idParamSchema, body: activityPatchSchema }),
  patchHandler,
);
router.delete('/:id', validate({ params: idParamSchema }), deleteHandler);

export default router;
