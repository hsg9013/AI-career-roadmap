import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { configureApi, useAuthStore } from 'frontend-shared';
import App from './App.vue';
import router from './router';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// 공유 axios 클라이언트 설정 — 토큰 getter / refresh 콜백 연결
configureApi({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:9536/v1',
  getAccessToken: () => useAuthStore().accessToken,
  // 005 US2(H2): 401 시 refresh 쿠키로 access token 회전 → 원요청 재시도. 실패 시 세션 클리어.
  onUnauthorized: () => useAuthStore().refreshAccessToken(),
});

// 005 US2(H2): 부팅 시 refresh 쿠키로 세션 복원(새로고침 유지).
//   라우터 설치(app.use(router))는 즉시 초기 내비게이션을 실행하므로, 그 전에 세션 복원을
//   끝내야 보호 라우트(/dashboard 등)에서 가드가 미인증으로 오판해 /login 으로 튕기지 않는다.
//   복원 실패(비로그인)는 정상 흐름 — 가드가 처리한다.
async function bootstrap(): Promise<void> {
  await useAuthStore(pinia).restoreSession();
  app.use(router);
  await router.isReady();
  app.mount('#app');
}

void bootstrap();
