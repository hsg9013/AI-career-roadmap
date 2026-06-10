import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getApi } from '../api/client.js';

// T037: 인증 상태 Pinia 스토어
// access token은 메모리(보안), refresh는 백엔드 HttpOnly 쿠키 또는 별도 secure storage.

export type Role = 'student' | 'mentor' | 'university' | 'enterprise' | 'admin';

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
  scopes: string[];
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const user = ref<SessionUser | null>(null);

  const isAuthenticated = computed(() => accessToken.value !== null && user.value !== null);
  const hasScope = (scope: string) => user.value?.scopes.includes(scope) ?? false;

  function setSession(token: string, sessionUser: SessionUser): void {
    accessToken.value = token;
    user.value = sessionUser;
  }

  function clearSession(): void {
    accessToken.value = null;
    user.value = null;
  }

  // 003 US6(T042): 네이버 소셜 로그인 — code 로 세션 발급. created 면 신규 가입.
  async function loginWithNaver(code: string, state = ''): Promise<{ role: Role; created: boolean }> {
    const { data } = await getApi().post<{ access_token: string; role: Role; created: boolean }>(
      '/auth/social/naver',
      { code, state },
    );
    setSession(data.access_token, { id: 0, email: '', role: data.role, scopes: [] });
    return { role: data.role, created: data.created };
  }

  // 003 US6(T043): 학교 이메일 검증 요청/확인/상태.
  async function requestSchoolEmail(email: string): Promise<{ status: string; devToken?: string }> {
    const { data } = await getApi().post<{ status: string; devToken?: string }>(
      '/auth/school-email/verify',
      { email },
    );
    return data;
  }
  async function confirmSchoolEmail(token: string): Promise<{ status: string; email: string }> {
    const { data } = await getApi().post<{ status: string; email: string }>(
      '/auth/school-email/confirm',
      { token },
    );
    return data;
  }
  async function schoolEmailStatus(): Promise<{ status: string; email: string | null }> {
    const { data } = await getApi().get<{ status: string; email: string | null }>('/auth/school-email/status');
    return data;
  }

  return {
    accessToken, user, isAuthenticated, hasScope, setSession, clearSession,
    loginWithNaver, requestSchoolEmail, confirmSchoolEmail, schoolEmailStatus,
  };
});
