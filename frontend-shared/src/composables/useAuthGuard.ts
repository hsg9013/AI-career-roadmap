import type { NavigationGuard } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

// T038: 라우트 가드 — 미인증 시 /login 리다이렉트.
// router meta.requiresAuth=true 인 라우트에만 적용.

export const requireAuthGuard: NavigationGuard = (to) => {
  const auth = useAuthStore();
  if (to.meta?.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  // 특정 scope 요구
  const required = to.meta?.requiresScopes as string[] | undefined;
  if (required && !required.every((s) => auth.hasScope(s))) {
    return { name: 'forbidden' };
  }
  // 005 고도화: 역할 전용 라우트(meta.roles) — 권한 밖이면 자기 역할 홈으로 분기(완전 독점).
  const roles = to.meta?.roles as string[] | undefined;
  if (roles && roles.length > 0 && !(auth.user && roles.includes(auth.user.role))) {
    const ROLE_HOME: Record<string, string> = {
      student: '/dashboard', mentor: '/missions', enterprise: '/company',
      university: '/university', admin: '/admin',
    };
    const home = auth.user ? ROLE_HOME[auth.user.role] : undefined;
    // 자기 홈 자체가 막히는 경우(이상 상태)만 forbidden — 그 외엔 홈으로 리다이렉트(루프 방지).
    return home && to.path !== home ? home : { name: 'forbidden' };
  }
  return true;
};
