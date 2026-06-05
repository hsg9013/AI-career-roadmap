import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

// T023: 통합 에러 핸들러. contracts/openapi.yaml의 Error 스키마 형태로 응답.

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = (req as Request & { id?: string }).id;

  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.flatten(),
      requestId,
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message, details: err.details, requestId });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err, requestId, path: req.path }, '[unhandled error]');
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId });
}
