import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// 프로젝트 표준 포트: 9516 (운영 도메인은 p16.sumzip.com — README/quickstart §0 참조)
// 모노레포 루트의 .env 를 단일 진실 공급원으로 삼는다.
const ENV_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, '');
  const port = Number(env.VITE_PORT ?? 9516);
  // /api 프록시 대상은 항상 절대 URL이어야 함. 운영 도메인 경유와 동일하게
  // SPA에서는 same-origin /api/v1 을 쓰고 vite가 9536으로 리라이트한다.
  const backendOrigin = env.VITE_BACKEND_ORIGIN ?? 'http://localhost:9536';

  return {
    plugins: [vue()],
    envDir: ENV_DIR,
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      allowedHosts: ['p16.sumzip.com', 'localhost', '192.168.0.19'],
      hmr: {
        host: 'p16.sumzip.com',
        clientPort: 443,
        protocol: 'wss',
      },
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port,
      strictPort: true,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
  };
});
