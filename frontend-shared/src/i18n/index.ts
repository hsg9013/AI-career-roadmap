import ko from './ko.json' with { type: 'json' };

// T039: 한국어 메시지 사전 (vue-i18n 통합은 frontend-web/mobile에서 createI18n 호출 시 사용)
export const messages = { ko } as const;
export type LocaleMessages = typeof ko;

// 간단한 t() 함수 — 키 경로(예: 'auth.login')로 메시지 조회. vue-i18n 미사용 환경 fallback.
export function t(key: string, locale: keyof typeof messages = 'ko'): string {
  const parts = key.split('.');
  let cur: unknown = messages[locale];
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
}
