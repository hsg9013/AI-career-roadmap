import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';
import App from './App.vue';

import '@ionic/vue/css/core.css';

const app = createApp(App);
app.use(createPinia());
app.use(IonicVue, { mode: 'md' });
// router는 T041(Phase 2)에서 등록
app.mount('#app');
