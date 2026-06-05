import { Router } from 'express';
import { validate } from '../../middlewares/requestValidator.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  candidatesHandler,
  candidatesQuerySchema,
  setConsentHandler,
  consentBodySchema,
} from './handlers.js';

// /v1/companies — 기업(enterprise) 후보 검색
export const companiesRouter: Router = Router();
companiesRouter.use(requireAuth, requireRole('enterprise'));
companiesRouter.get('/candidates', validate({ query: candidatesQuerySchema }), candidatesHandler);

// /v1/students/me/match-consent — 학생이 매칭 노출 동의 설정 (student)
export const matchConsentRouter: Router = Router();
matchConsentRouter.use(requireAuth, requireRole('student'));
matchConsentRouter.put('/', validate({ body: consentBodySchema }), setConsentHandler);

export default companiesRouter;
