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

// US8 결제·정산
export const usePaymentsStore = defineStore('payments', () => {
  const result = ref<unknown | null>(null);
  const payouts = ref<unknown[]>([]);
  const loading = ref(false);
  const lastError = ref<string | null>(null);
  async function checkout(amount: number, plan = 'standard'): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().post('/payments/checkout', { kind: 'membership', amount, plan });
      result.value = data;
    } catch (e) {
      lastError.value = err(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  async function fetchPayouts(): Promise<void> {
    const { data } = await getApi().get<unknown[]>('/payments/mentor-payouts');
    payouts.value = data;
  }
  return { result, payouts, loading, lastError, checkout, fetchPayouts };
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
