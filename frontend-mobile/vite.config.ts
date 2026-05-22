import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 모바일은 Capacitor가 dist/를 네이티브 셸에 번들. 개발 시 webview에서 dev 서버에 접속하려면
// server.host=0.0.0.0 + 머신 LAN IP를 capacitor.config.ts server.url에 명시.
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 9516, // 웹 dev와 동일 포트 사용. 동시에 띄울 일은 없으므로 충돌 방지 위해 frontend-mobile 단독 실행 권장
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
