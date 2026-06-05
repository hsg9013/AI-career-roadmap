import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodTypeAny } from 'zod';

// T024: zod 기반 요청 검증 래퍼. body/query/params 분리 검증.

type ValidatedRequest<B, Q, P> = Request<
  P extends ZodTypeAny ? P['_output'] : Record<string, string>,
  unknown,
  B extends ZodTypeAny ? B['_output'] : unknown,
  Q extends ZodTypeAny ? Q['_output'] : Record<string, string>
>;

export interface ValidateOptions<B extends ZodTypeAny, Q extends ZodTypeAny, P extends ZodTypeAny> {
  body?: B;
  query?: Q;
  params?: P;
}

export function validate<
  B extends ZodTypeAny = ZodTypeAny,
  Q extends ZodTypeAny = ZodTypeAny,
  P extends ZodTypeAny = ZodTypeAny,
>(opts: ValidateOptions<B, Q, P>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (opts.body) req.body = (opts.body as ZodSchema).parse(req.body);
      if (opts.query) req.query = (opts.query as ZodSchema).parse(req.query) as Request['query'];
      if (opts.params) req.params = (opts.params as ZodSchema).parse(req.params) as Request['params'];
      next();
    } catch (err) {
      next(err);
    }
  };
}

export type { ValidatedRequest };
