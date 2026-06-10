import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  registerStudent,
  login as loginService,
  rotateRefresh,
  logout as logoutService,
} from './service.js';
import { socialLoginNaver } from './social.js';
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

function refreshCookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/v1/auth',
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
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/v1/auth' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// 003 US6(T042): 네이버 소셜 로그인. code(+state) 로 계정 생성/연결 후 세션 발급.
export const socialNaverSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

export async function socialNaverHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof socialNaverSchema>;
    const result = await socialLoginNaver(body.code, body.state ?? '');
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    res.status(result.created ? 201 : 200).json({
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      role: result.role,
      created: result.created,
    });
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
