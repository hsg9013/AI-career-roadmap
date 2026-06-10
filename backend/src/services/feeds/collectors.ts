import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

// 003 US5(T038): 외부 수집 커넥터 — 공식 오픈API·제휴 피드 어댑터(소스별). FR-010(크롤링 금지).
//   • 피드 URL(env) 설정 시: 해당 JSON 피드를 fetch 해 정규화.
//   • 미설정(dev): 결정적 샘플 아이템 — 키 없이도 파이프라인(수집→upsert→신선도)을 검증.
// 각 어댑터는 throw 가능(네트워크 실패) — 호출부(runner)가 실패로 기록하고 기존 데이터를 유지한다.

export type FeedKind = 'jobposting' | 'certification' | 'contest';

export interface NormalizedItem {
  externalId: string;
  title: string;
  payload: Record<string, unknown>;
}

export interface FeedCollector {
  source: string;
  kind: FeedKind;
  collect(): Promise<NormalizedItem[]>;
}

// 공식 오픈API/제휴 피드 JSON 을 정규화. 피드 스키마는 소스마다 다르므로 mapper 주입.
async function fetchJsonFeed(
  url: string,
  mapper: (raw: unknown) => NormalizedItem[],
): Promise<NormalizedItem[]> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`feed fetch ${res.status}`);
  const data = (await res.json()) as unknown;
  return mapper(data);
}

// dev 샘플 — 소스별 결정적 데이터. external_id 고정 → 재수집 시 upsert(중복 없음).
function devSamples(source: string, kind: FeedKind, titles: string[]): NormalizedItem[] {
  return titles.map((title, i) => ({
    externalId: `${source}-sample-${i + 1}`,
    title,
    payload: { kind, title, source, sample: true },
  }));
}

function makeCollector(
  source: string,
  kind: FeedKind,
  url: string,
  sampleTitles: string[],
  mapper: (raw: unknown) => NormalizedItem[],
): FeedCollector {
  return {
    source,
    kind,
    async collect(): Promise<NormalizedItem[]> {
      if (!url) {
        logger.info({ source }, '[feeds] no feed URL — dev sample collection');
        return devSamples(source, kind, sampleTitles);
      }
      return fetchJsonFeed(url, mapper);
    },
  };
}

// 범용 mapper: 배열 또는 {items:[...]} 형태를 수용하고 id/title 키를 유연 추출.
function genericMapper(kind: FeedKind, source: string) {
  return (raw: unknown): NormalizedItem[] => {
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { items?: unknown[] })?.items)
        ? (raw as { items: unknown[] }).items
        : [];
    return arr.flatMap((r) => {
      const o = r as Record<string, unknown>;
      const externalId = String(o.id ?? o.external_id ?? o.uid ?? '');
      if (!externalId) return [];
      const title = String(o.title ?? o.name ?? '(제목 없음)');
      return [{ externalId, title, payload: { kind, source, ...o } }];
    });
  };
}

export function getCollectors(): FeedCollector[] {
  return [
    makeCollector('gov-worknet', 'jobposting', env.FEED_JOBPOSTING_URL,
      ['백엔드 개발자 채용', '데이터 분석가 채용', '프론트엔드 개발자 채용'],
      genericMapper('jobposting', 'gov-worknet')),
    makeCollector('q-net', 'certification', env.FEED_CERTIFICATION_URL,
      ['정보처리기사 시험 일정', 'SQLD 시험 일정'],
      genericMapper('certification', 'q-net')),
    makeCollector('partner-contest', 'contest', env.FEED_CONTEST_URL,
      ['전국 대학생 데이터 공모전', 'AI 아이디어 해커톤'],
      genericMapper('contest', 'partner-contest')),
    // 004 US5/T024: 교육/활동 플랫폼 파트너 콘텐츠 연계(자격증·대외활동 정보)
    makeCollector('partner-edu', 'certification', env.FEED_CERTIFICATION_URL,
      ['제휴 교육 플랫폼: 클라우드 자격 과정', '제휴 어학원: 단기 토익 과정'],
      genericMapper('certification', 'partner-edu')),
    makeCollector('partner-activity', 'contest', env.FEED_CONTEST_URL,
      ['제휴 대외활동: 글로벌 인턴십 프로그램', '제휴 공모전: UX 디자인 챌린지'],
      genericMapper('contest', 'partner-activity')),
  ];
}
