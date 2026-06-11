import { describe, it, expect } from 'vitest';
import { isMeaningfulText } from './text.js';

describe('isMeaningfulText — 키보드 난타 거부', () => {
  it('의미 없는 자음 난타는 false', () => {
    for (const s of ['sfsdfsdf', 'fsdfsd', 'sfsdfds', 'asdfghjkl', 'qwrtpsdfg']) {
      expect(isMeaningfulText(s)).toBe(false);
    }
  });

  it('한글 내용은 true', () => {
    for (const s of ['백엔드 사이드 프로젝트', '인턴십', '데이터 분석 공모전 수상']) {
      expect(isMeaningfulText(s)).toBe(true);
    }
  });

  it('정상 영문 단어/구는 true', () => {
    for (const s of ['backend internship', 'project', 'AWS certification', 'data analysis', 'strength']) {
      expect(isMeaningfulText(s)).toBe(true);
    }
  });

  it('공백/빈 문자열은 false', () => {
    expect(isMeaningfulText('')).toBe(false);
    expect(isMeaningfulText('   ')).toBe(false);
  });
});
