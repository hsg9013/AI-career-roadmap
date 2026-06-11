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
  mySubmissionsHandler,
  deleteSubmissionHandler,
  mentorFeedbackHandler,
  mentorFeedbackParamsSchema,
  mentorFeedbackBodySchema,
  mentorAssignmentsHandler,
  mentorStudentsHandler,
  mentorMissionsHandler,
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
submissionsRouter.get('/', mySubmissionsHandler); // 005 US4: 내 제출물 목록
submissionsRouter.get('/:submissionId/feedback', validate({ params: feedbackParamsSchema }), feedbackHandler);
submissionsRouter.delete('/:submissionId', validate({ params: feedbackParamsSchema }), deleteSubmissionHandler);

// 005 US4(H4): /v1/mentor — 현직자 심층 코멘트 작성 (멘토 전용)
export const mentorRouter: Router = Router();
mentorRouter.use(requireAuth, requireRole('mentor'));
mentorRouter.get('/submissions', mentorAssignmentsHandler);
mentorRouter.get('/students', mentorStudentsHandler); // 매핑 학생 목록
mentorRouter.get('/missions', mentorMissionsHandler); // 출제 미션 현황
mentorRouter.post(
  '/submissions/:submissionId/feedback',
  validate({ params: mentorFeedbackParamsSchema, body: mentorFeedbackBodySchema }),
  mentorFeedbackHandler,
);

export default missionsRouter;
