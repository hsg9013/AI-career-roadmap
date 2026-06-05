import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

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

  return { accessToken, user, isAuthenticated, hasScope, setSession, clearSession };
});
