<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useAuthStore } from 'frontend-shared';
const auth = useAuthStore();

// 역할별 네비게이션 메뉴 (인증 사용자에게 표시)
const links = computed(() => {
  const role = auth.user?.role;
  if (role === 'admin') return [{ to: '/admin', label: '관리자 대시보드' }];
  if (role === 'university') return [{ to: '/university', label: '대학 대시보드' }];
  if (role === 'enterprise') return [{ to: '/company', label: '인재 검색' }];
  return [
    { to: '/dashboard', label: '대시보드' },
    { to: '/roadmap', label: '로드맵' },
    { to: '/documents', label: '문서' },
    { to: '/missions', label: '미션' },
    { to: '/notifications', label: '알림' },
    { to: '/membership', label: '멤버십' },
    { to: '/donate', label: '기부' },
  ];
});
</script>

<template>
  <div class="app">
    <header>
      <nav>
        <RouterLink to="/" class="brand">AI Career Roadmap</RouterLink>
        <template v-if="auth.isAuthenticated">
          <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="navlink">{{ l.label }}</RouterLink>
        </template>
        <span class="grow"></span>
        <template v-if="auth.isAuthenticated">
          <span class="user">{{ auth.user?.email }}</span>
          <button @click="auth.clearSession()">로그아웃</button>
        </template>
        <RouterLink v-else to="/login">로그인</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
:root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
body { margin: 0; }
.app { min-height: 100vh; }
header { border-bottom: 1px solid #e5e7eb; padding: 0.75rem 1.25rem; }
nav { display: flex; align-items: center; gap: 1rem; max-width: 1100px; margin: 0 auto; }
.brand { font-weight: 600; font-size: 1.05rem; text-decoration: none; color: #111; }
.navlink { text-decoration: none; color: #374151; font-size: 0.9rem; padding: 0.25rem 0.1rem; }
.navlink:hover { color: #2563eb; }
.navlink.router-link-active { color: #2563eb; font-weight: 600; border-bottom: 2px solid #2563eb; }
.grow { flex: 1; }
.user { color: #555; font-size: 0.9rem; }
button { background: #fff; border: 1px solid #d1d5db; padding: 0.35rem 0.8rem; border-radius: 4px; cursor: pointer; }
button:hover { background: #f3f4f6; }
</style>
