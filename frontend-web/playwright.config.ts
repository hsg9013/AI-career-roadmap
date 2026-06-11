import { defineConfig, devices } from '@playwright/test';

// 005 T040: E2E(Playwright) — 새로고침 로그인 유지·로그아웃 메인 이동·권한 메뉴 종속·문서 PDF/Word 실다운로드.
// 전제: 백엔드가 :9536 에서 기동(데모 계정 seed:005 적용). 웹은 프로덕션과 동일한 /api 프록시 구성으로
//       전용 포트(:9517)에 띄워 실행 중인 dev 서버(:9516)를 건드리지 않는다.

const PORT = Number(process.env.E2E_PORT ?? 9519);
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // 데모 계정 상태 공유 → 직렬 실행.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    headless: true,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: BASE,
    // 공유 멀티유저 박스 — 이웃 사용자의 앱을 재사용하지 않도록 항상 우리 vite 를 띄운다.
    reuseExistingServer: false,
    timeout: 120_000,
    env: { E2E: '1' }, // vite HMR(wss://운영도메인) 비활성 → reload 루프 방지.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
