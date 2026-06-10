import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth } from '../../middlewares/auth.js';
import { listHandler, listQuerySchema } from './handlers.js';

// 003 US5: 외부 수집 피드 조회 라우터. 인증 사용자.
const router: Router = Router();

router.use(requireAuth);
router.get('/items', validate({ query: listQuerySchema }), listHandler);

export default router;
