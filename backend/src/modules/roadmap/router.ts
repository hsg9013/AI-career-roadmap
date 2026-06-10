import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  generateHandler,
  generateBodySchema,
  latestHandler,
  latestQuerySchema,
  rejectHandler,
  rejectParamsSchema,
  rejectBodySchema,
  completeHandler,
  itemParamsSchema,
} from './handlers.js';

const router: Router = Router();

router.use(requireAuth, requireRole('student'));

router.post('/', validate({ body: generateBodySchema }), generateHandler);
router.get('/latest', validate({ query: latestQuerySchema }), latestHandler);
router.post(
  '/items/:itemId/reject',
  validate({ params: rejectParamsSchema, body: rejectBodySchema }),
  rejectHandler,
);
router.post('/items/:itemId/complete', validate({ params: itemParamsSchema }), completeHandler);

export default router;
