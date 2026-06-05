import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// 모노레포 루트 .env를 우선 로드한 뒤, 패키지 로컬 .env가 있으면 덮어쓰지 않고 fallback으로 사용.
// pnpm --filter backend …로 실행해도 cwd가 backend/이므로 명시적으로 루트 경로를 지정한다.

const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(here, '..', '..', '..', '.env');
const backendEnv = join(here, '..', '..', '.env');

config({ path: rootEnv, override: false });
config({ path: backendEnv, override: false });
