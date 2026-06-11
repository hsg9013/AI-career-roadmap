import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { requireAuthGuard } from 'frontend-shared';

// T040/T056: 웹 라우터. 보호 라우트는 meta.requiresAuth=true 로 표시.

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('../pages/Home.vue') },
  { path: '/login', name: 'login', component: () => import('../pages/Login.vue') },
  // 005 US3(H3): 파트너 자체 회원가입 — 무인증 공개.
  { path: '/partner-signup', name: 'partner-signup', component: () => import('../pages/PartnerSignup.vue') },
  { path: '/forbidden', name: 'forbidden', component: () => import('../pages/Forbidden.vue') },
  {
    path: '/school-email',
    name: 'school-email',
    component: () => import('../pages/SchoolEmailVerify.vue'),
    meta: { requiresAuth: true },
  },
  {
    // 이메일 링크 확정 — 토큰 기반이라 무인증 접근 허용.
    path: '/school-email/confirm',
    name: 'school-email-confirm',
    component: () => import('../pages/SchoolEmailConfirm.vue'),
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('../pages/Onboarding.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../pages/Dashboard.vue'),
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/activities',
    name: 'activities',
    component: () => import('../pages/Activities.vue'),
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/roadmap',
    name: 'roadmap',
    component: () => import('../pages/Roadmap.vue'),
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/documents',
    name: 'documents',
    component: () => import('../pages/Documents.vue'),
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/missions',
    name: 'missions',
    component: () => import('../pages/Missions.vue'),
    meta: { requiresAuth: true, roles: ['student', 'mentor'] },
  },
  {
    path: '/feeds',
    name: 'feeds',
    component: () => import('../pages/Feeds.vue'),
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('../pages/Notifications.vue'),
    meta: { requiresAuth: true, roles: ['student', 'mentor'] },
  },
  {
    path: '/membership',
    name: 'membership',
    component: () => import('../pages/Membership.vue'),
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/donate',
    name: 'donate',
    component: () => import('../pages/AlumniDonate.vue'),
    // 11번: 합격 경험 공유(합격 경로 기부)는 멘토(현직자) 전용.
    meta: { requiresAuth: true, roles: ['mentor'] },
  },
  {
    path: '/university',
    name: 'university',
    component: () => import('../pages/University.vue'),
    meta: { requiresAuth: true, roles: ['university'] },
  },
  {
    path: '/company',
    name: 'company',
    component: () => import('../pages/Company.vue'),
    meta: { requiresAuth: true, roles: ['enterprise'] },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../pages/AdminDashboard.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  // 005 고도화: 역할별 맞춤 멤버십/플랜 페이지
  {
    path: '/mentor-earnings',
    name: 'mentor-earnings',
    component: () => import('../pages/MentorEarnings.vue'),
    meta: { requiresAuth: true, roles: ['mentor'] },
  },
  {
    path: '/company-plan',
    name: 'company-plan',
    component: () => import('../pages/CompanyPlan.vue'),
    meta: { requiresAuth: true, roles: ['enterprise'] },
  },
  {
    path: '/university-plan',
    name: 'university-plan',
    component: () => import('../pages/UniversityPlan.vue'),
    meta: { requiresAuth: true, roles: ['university'] },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(requireAuthGuard);

export default router;
