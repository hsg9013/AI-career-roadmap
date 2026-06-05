import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  getMeHandler,
  updateMeHandler,
  updateMeSchema,
  listTargetJobsHandler,
  replaceTargetJobsHandler,
  replaceTargetJobsSchema,
} from './handlers.js';

// T047: 학생 모듈 라우터. requireAuth + role=student 게이트.

const router: Router = Router();

router.use(requireAuth, requireRole('student'));

router.get('/me', getMeHandler);
router.put('/me', validate({ body: updateMeSchema }), updateMeHandler);
router.patch('/me', validate({ body: updateMeSchema }), updateMeHandler);

router.get('/me/target-jobs', listTargetJobsHandler);
router.put(
  '/me/target-jobs',
  validate({ body: replaceTargetJobsSchema }),
  replaceTargetJobsHandler,
);

export default router;
