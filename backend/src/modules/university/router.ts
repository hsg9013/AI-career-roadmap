import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { studentsHandler } from './handlers.js';

const router: Router = Router();

router.use(requireAuth, requireRole('university'));
router.get('/students', studentsHandler);

export default router;
