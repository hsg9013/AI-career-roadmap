import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { configureApi, useAuthStore } from 'frontend-shared';
import App from './App.vue';
import router from './router/index.js';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// 공유 axios 클라이언트 설정 — 토큰 getter / refresh 콜백 연결
configureApi({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:9536/v1',
  getAccessToken: () => useAuthStore().accessToken,
  onUnauthorized: async () => {
    // refresh 흐름은 Phase 3 US1 에서 구현
    useAuthStore().clearSession();
    return null;
  },
});

app.mount('#app');
