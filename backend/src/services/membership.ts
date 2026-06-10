import { getPool } from '../db/pool.js';

// 004 US6/G5: 멤버십 등급(무료/프리미엄) 정의·기능 게이팅 SSOT.
// 기존 memberships 테이블(plan, ends_at) 재사용 — 활성 멤버십이 있으면 premium, 없으면 free.

export type TierCode = 'free' | 'premium';

export interface MembershipTier {
  code: TierCode;
  name: string;
  price_month: number | null;
  features: string[];
}

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    code: 'free',
    name: '무료',
    price_month: null,
    features: [
      '역량 갭 진단(기본)',
      '로드맵 조회',
      '활동·스펙 기록',
      '앱 내 알림',
      'AI 문서 생성(횟수 제한)',
    ],
  },
  {
    code: 'premium',
    name: '프리미엄',
    price_month: 9900,
    features: [
      '무료 기능 전체 포함',
      '로드맵 심층 분석',
      '포트폴리오 진단',
      '취업 준비 패키지',
      'AI 문서 생성 무제한',
      '모바일 푸시·이메일 알림',
    ],
  },
];

// 프리미엄 전용 기능 키(게이팅 기준)
export const PREMIUM_FEATURES = [
  'roadmap_deep_analysis',
  'portfolio_diagnosis',
  'job_prep_package',
  'unlimited_ai_documents',
  'push_email_notifications',
] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

export async function getActiveTier(userId: number): Promise<TierCode> {
  const [rows] = await getPool().query(
    `SELECT 1 FROM memberships m
     JOIN students s ON s.id = m.student_id
     WHERE s.user_id = ? AND m.ends_at > NOW()
     LIMIT 1`,
    [userId],
  );
  return (rows as unknown[]).length > 0 ? 'premium' : 'free';
}

// 기능 게이팅: 프리미엄 전용 기능은 활성 프리미엄일 때만 true. 그 외(무료 기능)는 항상 true.
export async function hasFeature(userId: number, feature: PremiumFeature): Promise<boolean> {
  if (!(PREMIUM_FEATURES as readonly string[]).includes(feature)) return true;
  return (await getActiveTier(userId)) === 'premium';
}
