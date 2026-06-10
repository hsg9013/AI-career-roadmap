import { describe, it, expect } from 'vitest';
import { stripForbidden, isForbiddenField, satisfiesKAnonymity, K_ANONYMITY_MIN } from './index.js';
import { anonymize } from '../../services/recommendation/gateway.js';

// 003 G1(T008a/T021a) 회귀 테스트: FR-018(k≥5) · FR-019(민감속성 배제).

describe('privacy guard (G1)', () => {
  it('FR-019: 성별·나이·출신학교 등 민감 속성을 제거한다', () => {
    const cleaned = stripForbidden({
      job_role: 'IT/backend',
      score: 72,
      gender: 'female',
      age: 24,
      school: '한국대학교',
      university: '한국대',
      email: 'a@b.com',
      keywords: ['java', 'sql'],
    }) as Record<string, unknown>;

    expect(cleaned).toHaveProperty('job_role');
    expect(cleaned).toHaveProperty('score');
    expect(cleaned).toHaveProperty('keywords');
    for (const forbidden of ['gender', 'age', 'school', 'university', 'email']) {
      expect(cleaned).not.toHaveProperty(forbidden);
    }
  });

  it('FR-019: 중첩 객체/배열 안의 민감 속성도 제거한다', () => {
    const cleaned = stripForbidden({
      profile: { gender: 'male', major: 'cs' },
      peers: [{ age: 22, skill: 'react' }],
    }) as { profile: Record<string, unknown>; peers: Array<Record<string, unknown>> };

    expect(cleaned.profile).not.toHaveProperty('gender');
    expect(cleaned.profile).toHaveProperty('major');
    expect(cleaned.peers[0]).not.toHaveProperty('age');
    expect(cleaned.peers[0]).toHaveProperty('skill');
  });

  it('AI 경로(anonymize)가 공유 가드를 통과한다 — 민감 속성 누출 없음', () => {
    const cleaned = anonymize({ job_role: 'IT/backend', gender: 'female', age: 24, score: 80 });
    expect(cleaned).not.toHaveProperty('gender');
    expect(cleaned).not.toHaveProperty('age');
    expect(cleaned).toHaveProperty('job_role');
  });

  it('isForbiddenField 는 대소문자 무시', () => {
    expect(isForbiddenField('Gender')).toBe(true);
    expect(isForbiddenField('AGE')).toBe(true);
    expect(isForbiddenField('skills')).toBe(false);
  });

  it('FR-018: k-익명성은 최소 인원 미만을 거부한다', () => {
    expect(K_ANONYMITY_MIN).toBe(5);
    expect(satisfiesKAnonymity(4)).toBe(false);
    expect(satisfiesKAnonymity(5)).toBe(true);
  });
});
