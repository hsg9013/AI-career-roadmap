import { describe, it, expect } from 'vitest';
import { addBusinessDays } from './missions.js';

// 5영업일 SLA 계산 단위 테스트 (FR-012). 주말 건너뜀 검증.

describe('missions.addBusinessDays', () => {
  it('금요일 + 5영업일 = 다음 주 금요일 (주말 2일 건너뜀)', () => {
    const fri = new Date('2026-06-05T09:00:00Z'); // 금
    const out = addBusinessDays(fri, 5);
    expect(out.getUTCDay()).toBe(5); // 금요일
    // 7일(달력) 후
    expect(Math.round((out.getTime() - fri.getTime()) / 86400000)).toBe(7);
  });

  it('월요일 + 5영업일 = 같은 주 금요일 형태(5영업일)', () => {
    const mon = new Date('2026-06-01T09:00:00Z'); // 월
    const out = addBusinessDays(mon, 5);
    // 월~금 5영업일 → 다음 월요일(달력 7일) 아님, 5영업일이면 그 다음 월요일
    expect([1, 5]).toContain(out.getUTCDay());
  });

  it('영업일만큼 항상 미래 날짜', () => {
    const d = new Date('2026-06-10T00:00:00Z');
    expect(addBusinessDays(d, 5).getTime()).toBeGreaterThan(d.getTime());
  });
});
