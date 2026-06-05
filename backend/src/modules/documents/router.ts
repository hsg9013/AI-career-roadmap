import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  generateHandler,
  generateBodySchema,
  listHandler,
  updateHandler,
  updateParamsSchema,
  updateBodySchema,
} from './handlers.js';

const router: Router = Router();

router.use(requireAuth, requireRole('student'));

router.post('/', validate({ body: generateBodySchema }), generateHandler);
router.get('/', listHandler);
router.put('/:docId', validate({ params: updateParamsSchema, body: updateBodySchema }), updateHandler);

export default router;
