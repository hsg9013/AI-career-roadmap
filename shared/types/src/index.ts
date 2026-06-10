// OpenAPI 계약에서 생성된 타입 (pnpm --filter @ai-career/shared-types gen).
//   • openapi.d.ts      ← specs/001 (기존 계약)
//   • openapi-003.d.ts  ← specs/003 실연동·안정화 델타
// 두 파일 모두 paths/components 등 동일 최상위 이름을 내보내므로 네임스페이스로 분리한다.

export * as Api from './openapi.js';
export * as Api003 from './openapi-003.js';

// 003 델타 응답 스키마 단축 별칭(프런트·백엔드 공용).
import type { components as Components003 } from './openapi-003.js';
export type Schemas003 = Components003['schemas'];
