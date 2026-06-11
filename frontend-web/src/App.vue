<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useAuthStore } from 'frontend-shared';
const auth = useAuthStore();
const router = useRouter();

// 005 US2(H2): 로그아웃 — 세션 파기 후 즉시 처음 메인 화면으로 이동.
async function onLogout(): Promise<void> {
  await auth.logout();
  router.replace('/');
}

// 005 US3(H3): 역할별 네비게이션 메뉴 — 권한에 맞는 서비스만 노출(권한 종속 UI).
// 권한 밖 경로는 라우터 가드(useAuthGuard)가 /forbidden 으로 차단한다.
// 005 고도화: 역할별 메뉴 + 역할별 '멤버십/SaaS 구독' 메뉴 분기.
const links = computed(() => {
  const role = auth.user?.role;
  if (role === 'admin') return [{ to: '/admin', label: '관리자 대시보드' }];
  if (role === 'university') {
    // 대학(B2G/B2B): 통계 대시보드 + 기관 라이선스 플랜 관리
    return [
      { to: '/university', label: '대학 대시보드' },
      { to: '/university-plan', label: '대학 기관 플랜 관리' },
    ];
  }
  if (role === 'enterprise') {
    // 기업(B2B): 인재 검색 + 기업 플랜 서비스
    return [
      { to: '/company', label: '인재 검색' },
      { to: '/company-plan', label: '기업 플랜 서비스' },
    ];
  }
  if (role === 'mentor') {
    // 현직자(멘토): 검수·미션·합격경험공유 + 정산/활동 등급
    return [
      { to: '/missions', label: '미션' },
      { to: '/donate', label: '합격 경험 공유' },
      { to: '/notifications', label: '알림' },
      { to: '/mentor-earnings', label: '정산 및 활동 등급' },
    ];
  }
  // student (기본): 커리어 도구 + 내 이용권/멤버십
  return [
    { to: '/dashboard', label: '대시보드' },
    { to: '/activities', label: '활동·스펙' },
    { to: '/roadmap', label: '로드맵' },
    { to: '/documents', label: '문서' },
    { to: '/missions', label: '미션' },
    { to: '/notifications', label: '알림' },
    { to: '/membership', label: '내 이용권/멤버십' },
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
          <button @click="onLogout">로그아웃</button>
        </template>
        <template v-else>
          <RouterLink to="/partner-signup" class="navlink">파트너 가입</RouterLink>
          <RouterLink to="/login">로그인</RouterLink>
        </template>
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
