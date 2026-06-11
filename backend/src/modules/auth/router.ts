import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth } from '../../middlewares/auth.js';
import {
  registerStudentSchema,
  registerStudentHandler,
  loginSchema,
  loginHandler,
  refreshHandler,
  logoutHandler,
  schoolEmailSchema,
  schoolEmailVerifyHandler,
  schoolEmailConfirmSchema,
  schoolEmailConfirmHandler,
  schoolEmailStatusHandler,
} from './handlers.js';

// T032/T046 + 003 US6(T042/T043): auth 라우터. 검증 + 핸들러 와이어링.

const router: Router = Router();

router.post(
  '/register/student',
  validate({ body: registerStudentSchema }),
  registerStudentHandler,
);

router.post('/login', validate({ body: loginSchema }), loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);

// 학교 이메일 검증 — 요청·상태는 인증 필요, 확인(이메일 링크)은 토큰만으로.
router.post('/school-email/verify', requireAuth, validate({ body: schoolEmailSchema }), schoolEmailVerifyHandler);
router.get('/school-email/status', requireAuth, schoolEmailStatusHandler);
router.post('/school-email/confirm', validate({ body: schoolEmailConfirmSchema }), schoolEmailConfirmHandler);

export default router;
