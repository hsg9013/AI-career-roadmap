import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { requireAuthGuard } from 'frontend-shared';

// T041 (R-6): 모바일 라우터 — Ionic 스택 네비. web router와 라우트 정의 공유 가능하지만
// 모바일 전용 페이지(푸시 인박스 등)를 위해 분리.

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  { path: '/home', component: () => import('../pages/Home.vue') },
  { path: '/login', name: 'login', component: () => import('../pages/Login.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(requireAuthGuard);

export default router;
