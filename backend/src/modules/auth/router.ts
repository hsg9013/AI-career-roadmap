import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import {
  registerStudentSchema,
  registerStudentHandler,
  loginSchema,
  loginHandler,
  refreshHandler,
  logoutHandler,
} from './handlers.js';

// T032/T046: auth 라우터. 검증 + 핸들러 와이어링.

const router: Router = Router();

router.post(
  '/register/student',
  validate({ body: registerStudentSchema }),
  registerStudentHandler,
);

router.post('/login', validate({ body: loginSchema }), loginHandler);

router.post('/refresh', refreshHandler);

router.post('/logout', logoutHandler);

export default router;
