import { defineConfig } from 'vitest/config';

// 모노레포 루트 .env 를 테스트 시작 전에 로드.
// (src/config/env.ts 가 import 시점에 zod 검증을 돌리므로 setupFiles 보다 먼저 동작해야 함)
export default defineConfig({
  test: {
    setupFiles: ['./src/test/setupEnv.ts'],
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
