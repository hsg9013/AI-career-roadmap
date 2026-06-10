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
  return { usage, loading, lastError, fetchUsage };
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
