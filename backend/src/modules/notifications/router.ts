import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth } from '../../middlewares/auth.js';
import { listHandler, listQuerySchema, readHandler, readParamsSchema } from './handlers.js';

// 알림은 모든 역할이 수신 가능 — role 게이트 없이 requireAuth 만.
const router: Router = Router();

router.use(requireAuth);
router.get('/', validate({ query: listQuerySchema }), listHandler);
router.post('/:id/read', validate({ params: readParamsSchema }), readHandler);

export default router;
