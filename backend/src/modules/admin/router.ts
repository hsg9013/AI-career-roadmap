import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  reportsHandler,
  reportsQuerySchema,
  resolveHandler,
  resolveParamsSchema,
  resolveBodySchema,
  metricsHandler,
  usageHandler,
} from './handlers.js';

const router: Router = Router();

router.use(requireAuth, requireRole('admin'));
router.get('/reports', validate({ query: reportsQuerySchema }), reportsHandler);
router.post('/reports/:id/resolve', validate({ params: resolveParamsSchema, body: resolveBodySchema }), resolveHandler);
router.get('/metrics', metricsHandler);
router.get('/usage', usageHandler);

export default router;
