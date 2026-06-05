import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';
import { configureApi, useAuthStore } from 'frontend-shared';
import App from './App.vue';
import router from './router/index.js';

import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

const app = createApp(App);
app.use(createPinia());
app.use(IonicVue, { mode: 'md' });
app.use(router);

configureApi({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:9536/v1',
  getAccessToken: () => useAuthStore().accessToken,
  onUnauthorized: async () => {
    useAuthStore().clearSession();
    return null;
  },
});

router.isReady().then(() => app.mount('#app'));
