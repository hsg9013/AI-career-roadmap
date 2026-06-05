import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  triggerHandler,
  triggerBodySchema,
  latestHandler,
  latestQuerySchema,
} from './handlers.js';

const router: Router = Router();

router.use(requireAuth, requireRole('student'));

router.post('/', validate({ body: triggerBodySchema }), triggerHandler);
router.get('/latest', validate({ query: latestQuerySchema }), latestHandler);

export default router;
