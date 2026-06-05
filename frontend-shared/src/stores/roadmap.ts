import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getApi } from '../api/client.js';

// US2 로드맵 Pinia 스토어 — 생성/조회/거부. 응답 모양은 backend OpenAPI 와 일치.

export type RoadmapSource = 'cohort' | 'fallback';

export interface RoadmapItem {
  id: number;
  period: string;
  activity_type: string;
  title: string;
  rationale: string;
  target_skill: string | null;
  score: number;
  status: 'recommended' | 'accepted' | 'rejected' | 'done';
  item_ref: string;
}

export interface Roadmap {
  id: number;
  target_job_id: number;
  status: 'draft' | 'active' | 'completed';
  source: RoadmapSource;
  cohort_key: string | null;
  cohort_size: number;
  generated_at: string;
  model_version: string;
  notice: string | null;
  items: RoadmapItem[];
}

export const useRoadmapStore = defineStore('roadmap', () => {
  const roadmaps = ref<Record<number, Roadmap>>({});
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  function setError(err: unknown): void {
    if (err && typeof err === 'object' && 'response' in err) {
      const resp = (err as { response?: { data?: { message?: string; code?: string } } }).response;
      lastError.value = resp?.data?.message ?? resp?.data?.code ?? 'Unknown error';
    } else {
      lastError.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function generate(targetJobId: number): Promise<Roadmap> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().post<Roadmap>('/roadmap', { target_job_id: targetJobId });
      roadmaps.value = { ...roadmaps.value, [targetJobId]: data };
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchLatest(targetJobId: number): Promise<Roadmap | null> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get<Roadmap>(`/roadmap/latest?target_job_id=${targetJobId}`);
      roadmaps.value = { ...roadmaps.value, [targetJobId]: data };
      return data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        lastError.value = null;
        return null;
      }
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // FR-006: 추천 거부 후 재생성하여 거부 항목이 제외된 최신 로드맵을 반영
  async function rejectAndRefresh(
    targetJobId: number,
    itemId: number,
    reason?: string,
  ): Promise<Roadmap> {
    loading.value = true;
    lastError.value = null;
    try {
      await getApi().post(`/roadmap/items/${itemId}/reject`, { reason });
      const { data } = await getApi().post<Roadmap>('/roadmap', { target_job_id: targetJobId });
      roadmaps.value = { ...roadmaps.value, [targetJobId]: data };
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function clear(): void {
    roadmaps.value = {};
    lastError.value = null;
  }

  return { roadmaps, loading, lastError, generate, fetchLatest, rejectAndRefresh, clear };
});
