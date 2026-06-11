import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getApi } from '../api/client.js';

// T037: 인증 상태 Pinia 스토어
// access token은 메모리(보안), refresh는 백엔드 HttpOnly 쿠키 또는 별도 secure storage.

export type Role = 'student' | 'mentor' | 'university' | 'enterprise' | 'admin';

// 진행 중 refresh 약속(single-flight) — defineStore 팩토리 밖(모듈 스코프)에 두어
// 스토어 인스턴스가 둘 이상이어도(부팅 시 useAuthStore(pinia) vs 인터셉터의 useAuthStore())
// 단 하나의 /auth/refresh 만 비행하도록 강제한다. 회전형 refresh 토큰에서 동시/중복 요청이
// 옛 토큰을 재전송하면 백엔드 재사용 탐지가 family 를 통째로 무효화하기 때문이다.
let refreshInFlight: Promise<boolean> | null = null;

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

  // JWT access token 페이로드(서명 검증 없이 클레임만) 디코드 — sub/role/scopes 복원용.
  function decodeJwtPayload(token: string): { sub?: number; role?: Role; scopes?: string[] } | null {
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as { sub?: number; role?: Role; scopes?: string[] };
    } catch {
      return null;
    }
  }

  // 005 US2(H2): 부팅 시 refresh(HttpOnly 쿠키)로 세션 복원 — 새로고침(F5)에도 로그인 유지.
  // access token은 보안상 저장소에 두지 않고(메모리), refresh 쿠키로 부팅마다 재발급한다.
  async function doRestore(): Promise<boolean> {
    try {
      const { data } = await getApi().post<{ access_token: string }>('/auth/refresh');
      const claims = decodeJwtPayload(data.access_token);
      if (!claims?.role) {
        clearSession();
        return false;
      }
      setSession(data.access_token, {
        id: claims.sub ?? 0,
        email: '',
        role: claims.role,
        scopes: claims.scopes ?? [],
      });
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  // 모듈 스코프 refreshInFlight 를 공유해 동시/중복 refresh 를 하나로 합친다(위 주석 참조).
  async function restoreSession(): Promise<boolean> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = doRestore().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  // 401 인터셉터용 토큰 회전 — refresh 성공 시 새 access token 반환(원요청 재시도), 실패 시 null.
  async function refreshAccessToken(): Promise<string | null> {
    const ok = await restoreSession();
    return ok ? accessToken.value : null;
  }

  // 005 US2(H2): 로그아웃 — 서버 세션·refresh 쿠키 무효화 후 로컬 클리어(이후 화면이 메인으로 라우팅).
  async function logout(): Promise<void> {
    try {
      await getApi().post('/auth/logout');
    } catch {
      /* 서버 무효화 실패해도 로컬 세션은 반드시 비운다 */
    }
    clearSession();
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
    restoreSession, refreshAccessToken, logout,
    loginWithNaver, requestSchoolEmail, confirmSchoolEmail, schoolEmailStatus,
  };
});
