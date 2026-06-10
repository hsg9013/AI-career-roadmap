import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getApi } from '../api/client.js';

// US6/US7/US8/US9 역할별·결제·기부 스토어. 응답 모양은 backend OpenAPI 와 일치.

function err(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: { data?: { message?: string; code?: string } } }).response;
    return r?.data?.message ?? r?.data?.code ?? 'Unknown error';
  }
  return e instanceof Error ? e.message : String(e);
}

// US6 대학(B2G)
export const useUniversityStore = defineStore('university', () => {
  const view = ref<unknown | null>(null);
  const loading = ref(false);
  const lastError = ref<string | null>(null);
  async function fetchStudents(): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get('/university/students');
      view.value = data;
    } catch (e) {
      lastError.value = err(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  return { view, loading, lastError, fetchStudents };
});

// US7 기업(B2B)
export interface Candidate {
  student_id: number;
  major: string;
  year_in_school: number;
  target_industry: string;
  target_role: string;
  latest_score: number | null;
}
export const useCompaniesStore = defineStore('companies', () => {
  const candidates = ref<Candidate[]>([]);
  const loading = ref(false);
  const lastError = ref<string | null>(null);
  async function search(q: { industry_code?: string; job_role_code?: string }): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const params = new URLSearchParams();
      if (q.industry_code) params.set('industry_code', q.industry_code);
      if (q.job_role_code) params.set('job_role_code', q.job_role_code);
      const { data } = await getApi().get<Candidate[]>(`/companies/candidates?${params.toString()}`);
      candidates.value = data;
    } catch (e) {
      lastError.value = err(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  return { candidates, loading, lastError, search };
});

// 관리자 사용 지표 (대시보드 차트)
export interface UsageBucket { key: string; count: number }
export interface UsageBreakdown {
  byType: UsageBucket[];
  byPeriod: UsageBucket[];
  byUser: UsageBucket[];
  total: number;
}
export const useAdminStore = defineStore('admin', () => {
  const usage = ref<UsageBreakdown | null>(null);
  const loading = ref(false);
  const lastError = ref<string | null>(null);
  async function fetchUsage(): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get<UsageBreakdown>('/admin/usage');
      usage.value = data;
    } catch (e) {
      lastError.value = err(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  // 004 US5/US9: 파트너 등록·라이선스 등록(운영자)
  const lastPartnerId = ref<number | null>(null);
  async function createPartner(input: {
    type: 'university' | 'company' | 'mentor_org' | 'edu_platform' | 'tech_partner';
    name: string;
    consent_scope?: 'none' | 'stats' | 'individual';
  }): Promise<void> {
    lastError.value = null;
    try {
      const { data } = await getApi().post('/admin/partners', input);
      lastPartnerId.value = (data as { id: number }).id;
    } catch (e) {
      lastError.value = err(e);
      throw e;
    }
  }
  async function createLicense(input: {
    partner_id: number;
    type: 'university_saas' | 'company_recruit';
    scope?: 'stats' | 'individual';
    seats?: number;
    fee_year?: number;
    commission_rate?: number;
  }): Promise<void> {
    lastError.value = null;
    try {
      await getApi().post('/admin/licenses', input);
    } catch (e) {
      lastError.value = err(e);
      throw e;
    }
  }
  return { usage, loading, lastError, lastPartnerId, fetchUsage, createPartner, createLicense };
});

// US8/US3 결제·정산
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';
export interface CheckoutResult {
  payment_id: number;
  status: PaymentStatus;
  membership_ends_at: string | null;
  pg_tx_id: string;
  receipt_url: string | null;
  redirect_url: string | null;
}
export interface PaymentView {
  id: number;
  kind: string;
  amount: number;
  status: PaymentStatus;
  pg_tx_id: string | null;
  receipt_url: string | null;
  created_at: string;
  membership_ends_at: string | null;
}

export const usePaymentsStore = defineStore('payments', () => {
  const result = ref<CheckoutResult | null>(null);
  const payment = ref<PaymentView | null>(null);
  const payouts = ref<unknown[]>([]);
  const loading = ref(false);
  const lastError = ref<string | null>(null);
  async function checkout(amount: number, plan = 'standard'): Promise<CheckoutResult> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().post<CheckoutResult>('/payments/checkout', { kind: 'membership', amount, plan });
      result.value = data;
      // 실연동(pending+redirect)일 때 결제창으로 이동.
      if (data.status === 'pending' && data.redirect_url && typeof window !== 'undefined') {
        window.location.assign(data.redirect_url);
      }
      return data;
    } catch (e) {
      lastError.value = err(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  // 003 US3(T028): 결제 상태·영수증 조회(웹훅 확정 후 폴링/새로고침용).
  async function fetchPayment(paymentId: number): Promise<PaymentView | null> {
    loading.value = true;
    try {
      const { data } = await getApi().get<PaymentView>(`/payments/${paymentId}`);
      payment.value = data;
      return data;
    } catch (e) {
      lastError.value = err(e);
      return null;
    } finally {
      loading.value = false;
    }
  }
  async function fetchPayouts(): Promise<void> {
    const { data } = await getApi().get<unknown[]>('/payments/mentor-payouts');
    payouts.value = data;
  }
  return { result, payment, payouts, loading, lastError, checkout, fetchPayment, fetchPayouts };
});

// US9 선배 기부
export interface DonateActivityInput {
  period: string;
  activity_type: string;
  detail: string;
  skill_tag?: string;
}
export const useAlumniStore = defineStore('alumni', () => {
  const result = ref<unknown | null>(null);
  const loading = ref(false);
  const lastError = ref<string | null>(null);
  async function donate(payload: {
    industry_code: string;
    job_role_code: string;
    major_field: string;
    grade_band: string;
    success_year: number;
    activities: DonateActivityInput[];
  }): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().post('/alumni/paths', payload);
      result.value = data;
    } catch (e) {
      lastError.value = err(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  return { result, loading, lastError, donate };
});

// 004 US6/US7/US8: 멤버십 등급·실무 과금·추천 광고·제휴 배너
export interface MembershipTier {
  code: 'free' | 'premium';
  name: string;
  price_month: number | null;
  features: string[];
}
export interface PaidServiceItem {
  code: string;
  name: string;
  fee: number;
}
export interface JobAdItem {
  id: number;
  title: string;
  company_id: number | null;
  industry_code: string;
  job_role_code: string;
  sponsored: boolean;
}
export interface BannerItem {
  id: number;
  title: string;
  image_url: string | null;
  landing_url: string;
  discount_text: string | null;
  sponsored: boolean;
}

export const useMembershipStore = defineStore('membership', () => {
  const tiers = ref<MembershipTier[]>([]);
  const myTier = ref<string | null>(null);
  const paidServices = ref<PaidServiceItem[]>([]);
  const recommendedAds = ref<JobAdItem[]>([]);
  const banners = ref<BannerItem[]>([]);
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  async function fetchTiers(): Promise<void> {
    try {
      const { data } = await getApi().get('/membership/tiers');
      tiers.value = (data as { tiers: MembershipTier[] }).tiers;
    } catch (e) {
      lastError.value = err(e);
    }
  }
  async function fetchMyTier(): Promise<void> {
    try {
      const { data } = await getApi().get('/membership/me');
      myTier.value = (data as { tier: string }).tier;
    } catch (e) {
      lastError.value = err(e);
    }
  }
  async function fetchPaidServices(): Promise<void> {
    try {
      const { data } = await getApi().get('/paid-services');
      paidServices.value = (data as { items: PaidServiceItem[] }).items;
    } catch (e) {
      lastError.value = err(e);
    }
  }
  async function orderPaidService(code: string): Promise<void> {
    await getApi().post(`/paid-services/${code}/order`, {});
  }
  async function fetchAds(): Promise<void> {
    try {
      const { data } = await getApi().get('/ads/recommended-jobs');
      recommendedAds.value = (data as { items: JobAdItem[] }).items;
    } catch (e) {
      lastError.value = err(e);
    }
  }
  async function fetchBanners(): Promise<void> {
    try {
      const { data } = await getApi().get('/partners/banners');
      banners.value = (data as { items: BannerItem[] }).items;
    } catch (e) {
      lastError.value = err(e);
    }
  }
  async function trackBanner(id: number, event: 'click' | 'convert'): Promise<void> {
    try {
      await getApi().post(`/partners/banners/${id}/track`, { event });
    } catch {
      /* 집계 실패는 사용자 흐름을 막지 않음 */
    }
  }

  return {
    tiers, myTier, paidServices, recommendedAds, banners, loading, lastError,
    fetchTiers, fetchMyTier, fetchPaidServices, orderPaidService, fetchAds, fetchBanners, trackBanner,
  };
});

// 004 US1/G1: 활동·스펙 입력(수기). category 로 활동/스펙 모두 표현(part_time 포함).
export type ActivityCategory =
  | 'course' | 'project' | 'club' | 'volunteer' | 'contest' | 'external'
  | 'internship' | 'award' | 'certification' | 'part_time';

export interface ActivityItem {
  id: number;
  category: ActivityCategory;
  title: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
}

export interface ProfileCompleteness {
  activities_count: number;
  credentials_count: number;
  ready_for_documents: boolean;
  next_recommended_input: string | null;
}

export const useActivitiesStore = defineStore('activities', () => {
  const items = ref<ActivityItem[]>([]);
  const completeness = ref<ProfileCompleteness | null>(null);
  const suggestedSkills = ref<string[]>([]); // 004: 목표 직무 요구역량 키워드(태그 후보)
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  // 004: 활동에 붙일 역량 태그 후보 = 학생 1순위 목표 직무의 요구역량 키워드.
  // 이 태그가 activity_tags 에 저장되어 갭 진단 점수에 반영된다.
  async function fetchSuggestedSkills(): Promise<void> {
    try {
      const { data: tjs } = await getApi().get('/students/me/target-jobs');
      const first = (tjs as Array<{ industry_code: string; job_role_code: string }>)[0];
      if (!first) { suggestedSkills.value = []; return; }
      const { data: jobs } = await getApi().get(`/catalog/industries/${first.industry_code}/jobs`);
      const list = (jobs as { items?: Array<{ code: string; competencies?: string[] }> }).items ?? [];
      const job = list.find((j) => j.code === first.job_role_code);
      suggestedSkills.value = job?.competencies ?? [];
    } catch (e) {
      lastError.value = err(e);
    }
  }

  async function fetchList(): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get('/activities');
      items.value = (data as { items: ActivityItem[] }).items;
    } catch (e) {
      lastError.value = err(e);
    } finally {
      loading.value = false;
    }
  }
  async function fetchCompleteness(): Promise<void> {
    try {
      const { data } = await getApi().get('/students/me/profile-completeness');
      completeness.value = data as ProfileCompleteness;
    } catch (e) {
      lastError.value = err(e);
    }
  }
  async function create(input: {
    category: ActivityCategory;
    title: string;
    started_at: string;
    description?: string;
    ended_at?: string;
    outcome?: string;
    manual_tags?: string[];
  }): Promise<void> {
    lastError.value = null;
    try {
      await getApi().post('/activities', input);
      await fetchList();
      await fetchCompleteness();
    } catch (e) {
      lastError.value = err(e);
      throw e;
    }
  }
  async function remove(id: number): Promise<void> {
    try {
      await getApi().delete(`/activities/${id}`);
      await fetchList();
      await fetchCompleteness();
    } catch (e) {
      lastError.value = err(e);
    }
  }

  return { items, completeness, suggestedSkills, loading, lastError, fetchSuggestedSkills, fetchList, fetchCompleteness, create, remove };
});
