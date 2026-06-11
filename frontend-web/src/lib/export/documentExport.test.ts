import { describe, it, expect } from 'vitest';
import { contentToLines } from './documentExport';

// 005 US5(H5): 문서 content(unknown) → 표시 라인 평탄화 검증.
describe('contentToLines', () => {
  it('문자열은 줄 단위로 분할', () => {
    expect(contentToLines('a\nb')).toEqual(['a', 'b']);
  });

  it('null/undefined는 빈 배열', () => {
    expect(contentToLines(null)).toEqual([]);
    expect(contentToLines(undefined)).toEqual([]);
  });

  it('배열은 평탄화', () => {
    expect(contentToLines(['x', 'y'])).toEqual(['x', 'y']);
  });

  it('객체는 키: 값 라인 + 중첩 헤더', () => {
    const lines = contentToLines({ name: '홍길동', skills: ['ts'] });
    expect(lines).toContain('name: 홍길동');
    expect(lines).toContain('【skills】');
    expect(lines).toContain('ts');
  });
});
