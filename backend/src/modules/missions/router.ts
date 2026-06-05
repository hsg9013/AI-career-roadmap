import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  listHandler,
  submitHandler,
  submitParamsSchema,
  submitBodySchema,
  feedbackHandler,
  feedbackParamsSchema,
} from './handlers.js';

// /v1/missions — 목록 + 제출
export const missionsRouter: Router = Router();
missionsRouter.use(requireAuth, requireRole('student'));
missionsRouter.get('/', listHandler);
missionsRouter.post(
  '/:missionId/submissions',
  validate({ params: submitParamsSchema, body: submitBodySchema }),
  submitHandler,
);

// /v1/submissions — 결합 피드백 조회 (OpenAPI: GET /submissions/{id}/feedback)
export const submissionsRouter: Router = Router();
submissionsRouter.use(requireAuth, requireRole('student'));
submissionsRouter.get('/:submissionId/feedback', validate({ params: feedbackParamsSchema }), feedbackHandler);

export default missionsRouter;
