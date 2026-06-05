import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth } from '../../middlewares/auth.js';
import { listHandler, listQuerySchema } from './handlers.js';

const router: Router = Router();

router.use(requireAuth);
router.get('/', validate({ query: listQuerySchema }), listHandler);

export default router;
