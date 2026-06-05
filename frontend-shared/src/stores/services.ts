import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getApi } from '../api/client.js';

// US3/US4/US5 학생 도메인 스토어 (문서/미션/알림). 응답 모양은 backend OpenAPI 와 일치.

function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { message?: string; code?: string } } }).response;
    return resp?.data?.message ?? resp?.data?.code ?? 'Unknown error';
  }
  return err instanceof Error ? err.message : String(err);
}

export type DocType = 'resume' | 'coverletter' | 'portfolio';
export interface DocumentItem {
  id: number;
  doc_type: DocType;
  version: number;
  title: string;
  content: unknown;
  status: 'draft' | 'final';
  updated_at: string;
}

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<DocumentItem[]>([]);
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get<DocumentItem[]>('/documents');
      documents.value = data;
    } catch (err) {
      lastError.value = extractError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function generate(docType: DocType): Promise<DocumentItem> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().post<DocumentItem>('/documents', { doc_type: docType });
      await fetchAll();
      return data;
    } catch (err) {
      lastError.value = extractError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function finalize(docId: number): Promise<void> {
    await getApi().put(`/documents/${docId}`, { status: 'final' });
    await fetchAll();
  }

  return { documents, loading, lastError, fetchAll, generate, finalize };
});

export interface Mission {
  id: number;
  title: string;
  industry_code: string | null;
  job_role_code: string | null;
  brief: string;
  status: string;
}

export const useMissionsStore = defineStore('missions', () => {
  const missions = ref<Mission[]>([]);
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().get<Mission[]>('/missions');
      missions.value = data;
    } catch (err) {
      lastError.value = extractError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function submit(missionId: number, content: string): Promise<{ submission_id: number; ai_feedback: string }> {
    loading.value = true;
    lastError.value = null;
    try {
      const { data } = await getApi().post<{ submission_id: number; ai_feedback: string }>(
        `/missions/${missionId}/submissions`,
        { content },
      );
      return data;
    } catch (err) {
      lastError.value = extractError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function feedback(submissionId: number): Promise<unknown> {
    const { data } = await getApi().get(`/submissions/${submissionId}/feedback`);
    return data;
  }

  return { missions, loading, lastError, fetchAll, submit, feedback };
});

export interface Notification {
  id: number;
  type: string;
  channel: string;
  title: string;
  sent_at: string;
  read_at: string | null;
}

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);
  const loading = ref(false);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    try {
      const { data } = await getApi().get<Notification[]>('/notifications');
      notifications.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function markRead(id: number): Promise<void> {
    await getApi().post(`/notifications/${id}/read`, {});
    await fetchAll();
  }

  return { notifications, loading, fetchAll, markRead };
});
