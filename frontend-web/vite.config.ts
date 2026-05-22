import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

// 프로젝트 표준 포트: 9516 (운영 도메인은 p16.sumzip.com — README/quickstart §0 참조)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PORT ?? 9516);
  const apiBase = env.VITE_API_BASE_URL ?? 'http://localhost:9536/v1';

  return {
    plugins: [vue()],
    server: {
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiBase.replace(/\/v1$/, ''),
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      port,
      strictPort: true,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
  };
});
