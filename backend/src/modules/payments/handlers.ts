import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  checkout,
  listMentorPayouts,
  getPayment,
  handleWebhook,
  type WebhookEventType,
} from '../../services/payments.js';
import { HttpError } from '../../middlewares/errorHandler.js';

// T056 / 003 US3(T023/T024/T028): 결제·정산·웹훅 핸들러

function userId(req: Request): number {
  if (!req.auth) throw new HttpError(401, 'UNAUTHENTICATED', 'Auth required');
  return req.auth.sub;
}

export const checkoutBodySchema = z.object({
  kind: z.enum(['membership', 'one_time']).default('membership'),
  amount: z.number().int(),
  plan: z.string().max(40).default('standard'),
  // 005 US6(H6): 데모 가상 시나리오 — 테스트모드에서 성공/실패 강제(등급 변경 시연).
  force_result: z.enum(['success', 'fail']).optional(),
});

export async function checkoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof checkoutBodySchema>;
    const result = await checkout(userId(req), body.kind, body.amount, body.plan, body.force_result);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export const paymentIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function getPaymentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof paymentIdParamsSchema>;
    res.status(200).json(await getPayment(userId(req), id));
  } catch (err) {
    next(err);
  }
}

export async function mentorPayoutsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listMentorPayouts(userId(req)));
  } catch (err) {
    next(err);
  }
}

// PortOne 웹훅 상태 문자열 → 내부 이벤트 타입. 비종결 상태(ready 등)는 무시.
function mapStatus(raw: string): WebhookEventType | null {
  switch (raw.toLowerCase()) {
    case 'paid':
    case 'succeeded':
      return 'paid';
    case 'failed':
    case 'failure':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'canceled';
    case 'refunded':
    case 'partial_refunded':
      return 'refunded';
    default:
      return null;
  }
}

// PortOne 페이로드는 버전별로 키가 다르다 — merchant_uid / paymentId, status / type 등을 유연 수용.
const webhookBodySchema = z.object({
  merchant_uid: z.string().optional(),
  paymentId: z.string().optional(),
  imp_uid: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  event_id: z.string().optional(),
  receipt_url: z.string().optional(),
});

export async function webhookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = webhookBodySchema.parse(req.body ?? {});
    const merchantUid = body.merchant_uid ?? body.paymentId;
    const rawStatus = body.status ?? body.type;
    if (!merchantUid || !rawStatus) {
      throw new HttpError(400, 'INVALID_WEBHOOK', 'merchant_uid and status are required');
    }
    const eventType = mapStatus(rawStatus);
    if (!eventType) {
      // 비종결 이벤트는 200 으로 ack(재시도 방지)하되 미처리.
      res.status(200).json({ status: 'ignored' });
      return;
    }

    const signature =
      (req.headers['webhook-signature'] as string | undefined) ??
      (req.headers['x-portone-signature'] as string | undefined);
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? JSON.stringify(req.body ?? {});

    const result = await handleWebhook(rawBody, signature, {
      eventId: body.event_id,
      merchantUid,
      eventType,
      receiptUrl: body.receipt_url ?? null,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
