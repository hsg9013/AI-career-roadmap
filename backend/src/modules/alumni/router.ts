import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth } from '../../middlewares/auth.js';
import { donateHandler, donateBodySchema } from './handlers.js';

// 기부는 졸업한 선배(인증 사용자) 누구나 가능 — 별도 role 게이트 없음.
const router: Router = Router();

router.use(requireAuth);
router.post('/paths', validate({ body: donateBodySchema }), donateHandler);

export default router;
