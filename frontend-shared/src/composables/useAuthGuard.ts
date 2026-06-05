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
  return true;
};
