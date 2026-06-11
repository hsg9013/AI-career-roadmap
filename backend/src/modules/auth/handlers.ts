import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  registerStudent,
  login as loginService,
  rotateRefresh,
  logout as logoutService,
} from './service.js';
import {
  requestSchoolEmailVerification,
  confirmSchoolEmail,
  getSchoolEmailStatus,
} from './schoolEmail.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T046: auth 핸들러 본 구현 (router.ts 가 검증된 body 와 함께 호출)

const REFRESH_COOKIE_NAME = 'refresh_token';

function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

// SPA 는 리버스 프록시(vite dev `/api`, 운영 nginx)를 거쳐 refresh 를 호출하므로
// 브라우저가 보는 요청 경로(`/api/v1/auth/refresh`)는 백엔드 라우트(`/v1/auth/refresh`)와 다르다.
// 백엔드는 프록시 프리픽스를 알 수 없으니 쿠키 path 를 '/' 로 두어 프리픽스와 무관하게 전송되게 한다.
// (httpOnly + SameSite=Lax 로 보호. 동일 출처 요청에만 동봉.)
const REFRESH_COOKIE_PATH = '/';

function refreshCookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: REFRESH_COOKIE_PATH,
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.split('=');
    if (!rawName) continue;
    if (rawName.trim() === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(rest.join('=').trim());
    }
  }
  return null;
}

export const registerStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  university: z.string().min(1).max(120),
  major: z.string().min(1).max(120),
  year_in_school: z.number().int().min(1).max(6),
  // 001: 가입 동의란(선택) — 미지정 시 기본값(대학 통계 제공/매칭 미동의).
  university_consent_scope: z.enum(['none', 'aggregate_only', 'individual']).optional(),
  match_consent: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerStudentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof registerStudentSchema>;
    const result = await registerStudent({
      email: body.email,
      password: body.password,
      university: body.university,
      major: body.major,
      yearInSchool: body.year_in_school,
      universityConsentScope: body.university_consent_scope,
      matchConsent: body.match_consent,
    });
    res.status(201).json({
      user_id: result.userId,
      email_verification_sent: result.emailVerificationSent,
    });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof loginSchema>;
    const result = await loginService({ email: body.email, password: body.password });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    res.status(200).json({
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      role: result.role,
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const raw = readRefreshCookie(req);
    if (!raw) {
      throw new HttpError(401, 'MISSING_REFRESH', 'Refresh cookie not present');
    }
    const result = await rotateRefresh(raw);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    res.status(200).json({
      access_token: result.accessToken,
      expires_in: result.expiresIn,
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const raw = readRefreshCookie(req);
    await logoutService(raw);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// 003 US6(T043): 학교 이메일 검증 요청(.ac.kr) — 인증 필요.
export const schoolEmailSchema = z.object({ email: z.string().email() });

function authedUserId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export async function schoolEmailVerifyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof schoolEmailSchema>;
    res.status(202).json(await requestSchoolEmailVerification(authedUserId(req), body.email));
  } catch (err) {
    next(err);
  }
}

export const schoolEmailConfirmSchema = z.object({ token: z.string().min(1) });

export async function schoolEmailConfirmHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof schoolEmailConfirmSchema>;
    res.status(200).json(await confirmSchoolEmail(body.token));
  } catch (err) {
    next(err);
  }
}

export async function schoolEmailStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await getSchoolEmailStatus(authedUserId(req)));
  } catch (err) {
    next(err);
  }
}

export const __internal = { readRefreshCookie, REFRESH_COOKIE_NAME } as const;
