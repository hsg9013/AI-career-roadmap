import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  checkoutHandler,
  checkoutBodySchema,
  mentorPayoutsHandler,
  getPaymentHandler,
  paymentIdParamsSchema,
  webhookHandler,
} from './handlers.js';

const router: Router = Router();

// 웹훅은 PG 서버가 호출 — 인증 없이 서명으로 검증(requireAuth 앞에 배치).
router.post('/webhook', webhookHandler);

router.use(requireAuth);
// 결제는 학생, 정산 조회는 멘토
router.post('/checkout', requireRole('student'), validate({ body: checkoutBodySchema }), checkoutHandler);
router.get('/mentor-payouts', requireRole('mentor'), mentorPayoutsHandler);
router.get('/:id', validate({ params: paymentIdParamsSchema }), getPaymentHandler);

export default router;
