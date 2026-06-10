// 003 US1 G1(T008a): 공유 프라이버시 가드 SSOT.
//
// 두 불변식을 한 곳에서 보장한다:
//   • FR-018 k-익명성(k≥5): 선배 코호트 표본이 최소 인원 이상일 때만 개인화에 사용.
//     → 기존 recommendation/kAnonymity 를 단일 진입점으로 재노출.
//   • FR-019 민감속성 배제: 추천·매칭·AI 입력에서 성별·나이·출신학교 등 민감 정보를 제거.
//
// AI/추천/매칭 경로는 외부(LLM)·교차(매칭) 전달 전에 반드시 stripForbidden 을 통과시킨다.

export {
  K_ANONYMITY_MIN,
  satisfiesKAnonymity,
  cohortCount,
  cohortKey,
  gradeBandFor,
  type Cohort,
} from '../../services/recommendation/kAnonymity.js';

// 직접 식별 가능한 PII.
const PII_FIELDS = [
  'email',
  'name',
  'phone',
  'user_id',
  'userid',
  'sub',
  'address',
  'password',
  'token',
] as const;

// FR-019 민감 인구통계 속성(추천·매칭 산출에서 사용 금지).
const SENSITIVE_ATTR_FIELDS = [
  'gender',
  'sex',
  'age',
  'birthday',
  'birth',
  'birthdate',
  'dob',
  'school',
  'university',
  'alma_mater',
  'hometown',
  'race',
  'religion',
  'disability',
] as const;

export const FORBIDDEN_FIELDS: ReadonlySet<string> = new Set<string>(
  [...PII_FIELDS, ...SENSITIVE_ATTR_FIELDS].map((f) => f.toLowerCase()),
);

export function isForbiddenField(key: string): boolean {
  return FORBIDDEN_FIELDS.has(key.toLowerCase());
}

/**
 * 외부(LLM)·교차(매칭) 전달용 안전 사본. PII + 민감 인구통계 속성을 제거한다.
 * 중첩 객체/배열도 재귀적으로 정리해 민감 키가 깊은 곳에 숨어 전달되는 것을 막는다.
 */
export function stripForbidden(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((v) => stripForbidden(v));
  if (input !== null && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (isForbiddenField(k)) continue;
      out[k] = stripForbidden(v);
    }
    return out;
  }
  return input;
}
