import { createRouter, createWebHistory } from 'vue-router';
import { requireAuthGuard } from 'frontend-shared';
// T040/T056: 웹 라우터. 보호 라우트는 meta.requiresAuth=true 로 표시.
const routes = [
    { path: '/', name: 'home', component: () => import('../pages/Home.vue') },
    { path: '/login', name: 'login', component: () => import('../pages/Login.vue') },
    { path: '/forbidden', name: 'forbidden', component: () => import('../pages/Forbidden.vue') },
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
        meta: { requiresAuth: true },
    },
    {
        path: '/roadmap',
        name: 'roadmap',
        component: () => import('../pages/Roadmap.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/documents',
        name: 'documents',
        component: () => import('../pages/Documents.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/missions',
        name: 'missions',
        component: () => import('../pages/Missions.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/notifications',
        name: 'notifications',
        component: () => import('../pages/Notifications.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/membership',
        name: 'membership',
        component: () => import('../pages/Membership.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/donate',
        name: 'donate',
        component: () => import('../pages/AlumniDonate.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/university',
        name: 'university',
        component: () => import('../pages/University.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/company',
        name: 'company',
        component: () => import('../pages/Company.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/admin',
        name: 'admin',
        component: () => import('../pages/AdminDashboard.vue'),
        meta: { requiresAuth: true },
    },
];
export const router = createRouter({
    history: createWebHistory(),
    routes,
});
router.beforeEach(requireAuthGuard);
export default router;
