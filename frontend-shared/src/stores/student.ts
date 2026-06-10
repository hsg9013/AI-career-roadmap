import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getApi } from '../api/client.js';

// T052: 학생 도메인 Pinia 스토어
//   • 프로필, 목표 직무(최대 3), 갭 진단 결과 상태 + API 액션
//   • 백엔드 응답 모양은 backend OpenAPI 와 일치

export interface StudentProfile {
  id: number;
  user_id: number;
  university: string;
  major: string;
  year_in_school: number;
  expected_grad_at: string | null;
  school_email_verified: boolean;
}

export interface TargetJob {
  id: number;
  industry_code: string;
  job_role_code: string;
  priority: number;
}

export interface GapPayload {
  fulfilled: string[];
  missing: string[];
  priority_to_improve: string[];
}

export interface GapInsight {
  source: 'llm' | 'rule' | 'cache';
  narrative: string;
  suggestions: string[];
  model_version: string;
  // 003 US1(T021): 룰 폴백 사유(none=AI 정상). 사용자에겐 오류로 노출하지 않는다.
  fallback_reason?: 'none' | 'error' | 'timeout' | 'budget' | 'no_credentials';
}

export interface GapDiagnosis {
  id: number;
  target_job_id: number;
  computed_at: string;
  overall_score: number;
  payload: GapPayload;
  model_version: string;
  insight?: GapInsight;
}

export const useStudentStore = defineStore('student', () => {
  const profile = ref<StudentProfile | null>(null);
  const targetJobs = ref<TargetJob[]>([]);
  const diagnoses = ref<Record<number, GapDiagnosis>>({});
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  const hasProfile = computed(() => profile.value !== null);
  const targetJobCount = computed(() => targetJobs.value.length);
  const primaryTargetJob = computed(() =>
    targetJobs.value.find((j) => j.priority === 1) ?? targetJobs.value[0] ?? null,
  );

  function setError(err: unknown): void {
    if (err && typeof err === 'object' && 'response' in err) {
      const resp = (err as { response?: { data?: { message?: string; code?: string } } }).response;
      lastError.value = resp?.data?.message ?? resp?.data?.code ?? 'Unknown error';
    } else {
      lastError.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function fetchProfile(): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get<StudentProfile>('/students/me');
      profile.value = data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(patch: Partial<{
    university: string;
    major: string;
    year_in_school: number;
    expected_grad_at: string | null;
  }>): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().put<StudentProfile>('/students/me', patch);
      profile.value = data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTargetJobs(): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get<TargetJob[]>('/students/me/target-jobs');
      targetJobs.value = data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function replaceTargetJobs(jobs: Array<{
    industry_code: string;
    job_role_code: string;
    priority: number;
  }>): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().put<TargetJob[]>('/students/me/target-jobs', jobs);
      targetJobs.value = data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function triggerDiagnosis(targetJobId: number): Promise<GapDiagnosis> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().post<GapDiagnosis>('/gap-diagnosis', {
        target_job_id: targetJobId,
      });
      diagnoses.value = { ...diagnoses.value, [targetJobId]: data };
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchLatestDiagnosis(targetJobId: number): Promise<GapDiagnosis | null> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get<GapDiagnosis>(
        `/gap-diagnosis/latest?target_job_id=${targetJobId}`,
      );
      // insight 는 백엔드 GET /latest 응답에 포함되지 않으므로 기존 캐시 값을 유지한다.
      const previous = diagnoses.value[targetJobId];
      const merged: GapDiagnosis =
        previous && previous.id === data.id ? { ...data, insight: previous.insight } : data;
      diagnoses.value = { ...diagnoses.value, [targetJobId]: merged };
      return merged;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        // 진단 이력 없음은 에러로 표시하지 않는다.
        lastError.value = null;
        return null;
      }
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function clear(): void {
    profile.value = null;
    targetJobs.value = [];
    diagnoses.value = {};
    lastError.value = null;
  }

  return {
    profile,
    targetJobs,
    diagnoses,
    loading,
    lastError,
    hasProfile,
    targetJobCount,
    primaryTargetJob,
    fetchProfile,
    updateProfile,
    fetchTargetJobs,
    replaceTargetJobs,
    triggerDiagnosis,
    fetchLatestDiagnosis,
    clear,
  };
});
