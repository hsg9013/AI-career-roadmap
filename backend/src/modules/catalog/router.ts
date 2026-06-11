import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import {
  listIndustriesHandler,
  listJobsHandler,
  listAllJobsHandler,
  industryParamsSchema,
} from './handlers.js';

// 003 US2: 직무·산업 사전. 회원가입 선택지로 쓰이므로 인증 없이 공개(public).

const router: Router = Router();

router.get('/industries', listIndustriesHandler);
// 014: 전체 직무(코드→한글명) — :industryCode 보다 먼저 등록(경로 충돌 방지).
router.get('/job-roles', listAllJobsHandler);
router.get(
  '/industries/:industryCode/jobs',
  validate({ params: industryParamsSchema }),
  listJobsHandler,
);

export default router;
