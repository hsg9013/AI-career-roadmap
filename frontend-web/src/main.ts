import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

const app = createApp(App);
app.use(createPinia());
// router는 T040(Phase 2)에서 등록
app.mount('#app');
