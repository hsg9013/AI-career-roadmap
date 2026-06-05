import { describe, it, expect } from 'vitest';
import { __internal } from './roadmap.js';

// US2 로드맵 추천의 순수 로직 단위 테스트 (DB 무관).
// 통합 경로(생성/거부 엔드포인트)는 DB 기동 시 별도 integration 테스트로 검증.

const { itemRef, skillBoost, finalize } = __internal;

describe('roadmap.itemRef', () => {
  it('동일 입력은 동일 해시(거부가 재생성 간 유지되도록 안정적)', () => {
    const a = itemRef('Y3', 'project', 'spring', 'Spring 프로젝트');
    const b = itemRef('Y3', 'project', 'spring', 'Spring 프로젝트');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('입력이 다르면 해시가 다르다', () => {
    expect(itemRef('Y3', 'project', 'spring', 'x')).not.toBe(itemRef('Y4', 'project', 'spring', 'x'));
    expect(itemRef('Y3', 'project', 'spring', 'x')).not.toBe(itemRef('Y3', 'project', 'sql', 'x'));
  });

  it('skill 이 null 이어도 안정적으로 동작한다', () => {
    expect(itemRef('Y2', 'course', null, 't')).toHaveLength(64);
  });
});

describe('roadmap.skillBoost', () => {
  const missing = new Set(['sql']);
  const priority = new Set(['spring']);

  it('우선 역량은 1.6배', () => {
    expect(skillBoost('spring', missing, priority)).toBe(1.6);
  });
  it('부족 역량은 1.3배', () => {
    expect(skillBoost('sql', missing, priority)).toBe(1.3);
  });
  it('해당 없으면 1배, null 도 1배', () => {
    expect(skillBoost('docker', missing, priority)).toBe(1);
    expect(skillBoost(null, missing, priority)).toBe(1);
  });
  it('대소문자 무시', () => {
    expect(skillBoost('SPRING', missing, priority)).toBe(1.6);
  });
});

describe('roadmap.finalize', () => {
  function item(ref: string, period: string, score: number) {
    return {
      period,
      activity_type: 'project',
      title: ref,
      rationale: '',
      target_skill: ref,
      score,
      status: 'recommended' as const,
      item_ref: ref,
    };
  }

  it('item_ref 중복은 최고 점수만 남긴다', () => {
    const out = finalize([item('a', 'Y2', 3), item('a', 'Y2', 9), item('b', 'Y3', 1)]);
    expect(out).toHaveLength(2);
    expect(out.find((i) => i.item_ref === 'a')!.score).toBe(9);
  });

  it('상위 N(8) 으로 제한한다', () => {
    const many = Array.from({ length: 12 }, (_, i) => item(`r${i}`, 'Y2', i));
    expect(finalize(many)).toHaveLength(8);
  });

  it('period 오름차순, 동일 period 내 score 내림차순 정렬', () => {
    const out = finalize([item('a', 'Y4', 5), item('b', 'Y2', 1), item('c', 'Y2', 9)]);
    expect(out.map((i) => i.item_ref)).toEqual(['c', 'b', 'a']);
  });
});
