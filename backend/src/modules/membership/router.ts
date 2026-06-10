import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { tiersHandler, myTierHandler } from './handlers.js';

// /v1/membership — 등급 비교표(공개) + 내 등급(인증)
const membershipRouter: Router = Router();

membershipRouter.get('/tiers', tiersHandler);
membershipRouter.get('/me', requireAuth, myTierHandler);

export default membershipRouter;
