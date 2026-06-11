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
  // 003 US1(T018): 생성 경로(ai=AI 생성, fallback_rule=규칙 기반). 응답에만 포함될 수 있음.
  ai_source?: 'ai' | 'fallback_rule';
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

  // 005 고도화: 자동 생성 문서 삭제.
  async function remove(docId: number): Promise<void> {
    lastError.value = null;
    try {
      await getApi().delete(`/documents/${docId}`);
      await fetchAll();
    } catch (err) {
      lastError.value = extractError(err);
      throw err;
    }
  }

  return { documents, loading, lastError, fetchAll, generate, finalize, remove };
});

export interface Mission {
  id: number;
  title: string;
  industry_code: string | null;
  job_role_code: string | null;
  brief: string;
  status: string;
}

// 005 US4: 내 제출물 목록·결합 피드백 타입
export interface MySubmission {
  submission_id: number;
  mission_title: string;
  industry_code: string;
  job_role_code: string;
  state: string;
  review_status: string | null;
  submitted_at: string;
  feedback_count: number;
  has_mentor_feedback: boolean;
}
export interface FeedbackItem {
  kind: 'ai' | 'mentor';
  mentor_id: number | null;
  content: string;
  created_at: string;
}
export interface SubmissionFeedback {
  submission: { id: number; state: string; review_status: string | null; deadline: string | null };
  feedbacks: FeedbackItem[];
}

export const useMissionsStore = defineStore('missions', () => {
  const missions = ref<Mission[]>([]);
  const mySubmissions = ref<MySubmission[]>([]);
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

  async function fetchMySubmissions(): Promise<void> {
    try {
      const { data } = await getApi().get<MySubmission[]>('/submissions');
      mySubmissions.value = data;
    } catch (err) {
      lastError.value = extractError(err);
    }
  }

  // 005 고도화: 내 미션 제출물 삭제(피드백·검수배정 함께 정리).
  async function removeSubmission(submissionId: number): Promise<void> {
    lastError.value = null;
    try {
      await getApi().delete(`/submissions/${submissionId}`);
      await fetchMySubmissions();
    } catch (err) {
      lastError.value = extractError(err);
      throw err;
    }
  }

  async function feedback(submissionId: number): Promise<SubmissionFeedback> {
    const { data } = await getApi().get<SubmissionFeedback>(`/submissions/${submissionId}/feedback`);
    return data;
  }

  return { missions, mySubmissions, loading, lastError, fetchAll, submit, fetchMySubmissions, removeSubmission, feedback };
});

export interface Notification {
  id: number;
  type: string;
  channel: string;
  title: string;
  sent_at: string;
  read_at: string | null;
}

export interface NotificationSettings {
  inApp: true;
  push: boolean;
  email: boolean;
}

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);
  const settings = ref<NotificationSettings>({ inApp: true, push: true, email: true });
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

  // 003 US4(T037): 채널 설정 조회/변경. in_app 은 항상 on(서버 강제).
  async function fetchSettings(): Promise<void> {
    const { data } = await getApi().get<NotificationSettings>('/notifications/settings');
    settings.value = data;
  }

  async function updateSettings(next: { push: boolean; email: boolean }): Promise<void> {
    const { data } = await getApi().put<NotificationSettings>('/notifications/settings', next);
    settings.value = data;
  }

  // 003 US4(T034b): 디바이스 푸시 토큰 등록(모바일/웹 푸시).
  async function registerDevice(platform: 'ios' | 'android' | 'web', token: string): Promise<void> {
    await getApi().post('/notifications/devices', { platform, token });
  }

  return {
    notifications, settings, loading,
    fetchAll, markRead, fetchSettings, updateSettings, registerDevice,
  };
});

// 003 US5: 외부 수집 피드(채용·자격증·공모전).
export type FeedKind = 'jobposting' | 'certification' | 'contest';
export interface FeedItem {
  id: number;
  kind: FeedKind;
  source: string;
  external_id: string;
  title: string | null;
  freshness: 'fresh' | 'stale';
  collected_at: string;
  payload: unknown;
}

export const useFeedsStore = defineStore('feeds', () => {
  const items = ref<FeedItem[]>([]);
  const loading = ref(false);
  const kind = ref<FeedKind | ''>('');

  async function fetchItems(filter: { kind?: FeedKind } = {}): Promise<void> {
    loading.value = true;
    kind.value = filter.kind ?? '';
    try {
      const params = filter.kind ? `?kind=${filter.kind}` : '';
      const { data } = await getApi().get<FeedItem[]>(`/feeds/items${params}`);
      items.value = data;
    } finally {
      loading.value = false;
    }
  }

  // 005 고도화: '지금 새로고침' — 즉시 재수집 후 현재 필터로 재조회.
  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      await getApi().post('/feeds/refresh');
      const params = kind.value ? `?kind=${kind.value}` : '';
      const { data } = await getApi().get<FeedItem[]>(`/feeds/items${params}`);
      items.value = data;
    } finally {
      loading.value = false;
    }
  }

  return { items, loading, kind, fetchItems, refresh };
});
