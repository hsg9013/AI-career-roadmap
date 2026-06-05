import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { checkoutHandler, checkoutBodySchema, mentorPayoutsHandler } from './handlers.js';

const router: Router = Router();

router.use(requireAuth);
// 결제는 학생, 정산 조회는 멘토
router.post('/checkout', requireRole('student'), validate({ body: checkoutBodySchema }), checkoutHandler);
router.get('/mentor-payouts', requireRole('mentor'), mentorPayoutsHandler);

export default router;
