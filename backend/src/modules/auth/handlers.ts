import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  registerStudent,
  login as loginService,
  rotateRefresh,
  logout as logoutService,
} from './service.js';
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

export const __internal = { readRefreshCookie, REFRESH_COOKIE_NAME } as const;
