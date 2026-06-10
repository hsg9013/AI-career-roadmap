import type { Request, Response, NextFunction } from 'express';
import { evaluateOpsHealth } from '../../lib/ops.js';
import { collectOpsMetrics } from '../../services/metrics.js';

// 003 US8(T033): 운영 헬스 — 상태·구성요소·마지막 백업 시각.
// 모니터링/외부 헬스체크에서 폴링. down 컴포넌트는 평가 과정에서 경보로 적재된다.

export async function opsHealthHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const report = await evaluateOpsHealth();
    const httpStatus = report.status === 'down' ? 503 : 200;
    res.status(httpStatus).json(report);
  } catch (err) {
    next(err);
  }
}

// 003 Polish(T053): 관측 대시보드 메트릭 — 폴백률·결제/발송/수집 성공률·가용성 + KPI. 관리자 전용.
export async function opsMetricsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await collectOpsMetrics());
  } catch (err) {
    next(err);
  }
}
