import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listFeedItems, collectAllFeeds } from '../../services/feeds/index.js';

// 003 US5(T041): 외부 수집 피드 조회. freshness(fresh/stale) 를 응답에 그대로 노출 → 웹 '최신 아님' 표시.

export const listQuerySchema = z.object({
  kind: z.enum(['jobposting', 'certification', 'contest']).optional(),
  source: z.string().max(60).optional(),
  freshness: z.enum(['fresh', 'stale']).optional(),
});

export async function listHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    res.status(200).json(await listFeedItems(q));
  } catch (err) {
    next(err);
  }
}

// 005 고도화: '지금 새로고침' — 외부/제휴 피드를 즉시 재수집(+신선도 갱신) 후 요약 반환.
//   (공식 오픈API·제휴 피드 upsert. 미설정 dev 환경은 결정적 샘플 재생성.)
export async function refreshHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const r = await collectAllFeeds();
    res.status(200).json({ ok: true, sources: r.runs.length, staled: r.staled });
  } catch (err) {
    next(err);
  }
}
