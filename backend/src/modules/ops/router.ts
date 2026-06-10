import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { opsHealthHandler, opsMetricsHandler } from './handlers.js';

// 003 US8: 운영 헬스. 모니터링·로드밸런서 폴링용이라 공개(public).
// 003 Polish(T053): 메트릭 대시보드는 관리자 전용.

const router: Router = Router();

router.get('/health', opsHealthHandler);
router.get('/metrics', requireAuth, requireRole('admin'), opsMetricsHandler);

export default router;
