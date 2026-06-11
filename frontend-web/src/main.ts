import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { configureApi, useAuthStore } from 'frontend-shared';
import App from './App.vue';
import router from './router';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// 공유 axios 클라이언트 설정 — 토큰 getter / refresh 콜백 연결
configureApi({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:9536/v1',
  getAccessToken: () => useAuthStore().accessToken,
  // 005 US2(H2): 401 시 refresh 쿠키로 access token 회전 → 원요청 재시도. 실패 시 세션 클리어.
  onUnauthorized: () => useAuthStore().refreshAccessToken(),
});

// 005 US2(H2): 부팅 시 refresh 쿠키로 세션 복원(새로고침 유지) 후 마운트.
// 복원 실패(비로그인)는 정상 흐름 — 라우터 가드가 처리한다. 차단 없이 즉시 마운트.
useAuthStore(pinia)
  .restoreSession()
  .finally(() => {
    app.mount('#app');
  });
