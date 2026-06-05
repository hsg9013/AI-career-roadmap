import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth } from '../../middlewares/auth.js';
import { policyHandler, consentHandler, consentBodySchema } from './handlers.js';

const router: Router = Router();

router.use(requireAuth);
router.get('/policy', policyHandler);
router.post('/policy/consent', validate({ body: consentBodySchema }), consentHandler);

export default router;
