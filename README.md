# AI Career Roadmap & Portfolio Service

대학생을 위한 AI 기반 커리어 로드맵·포트폴리오 관리 SaaS. 백엔드 + 웹(Vue 3) + 모바일(Capacitor + Ionic Vue) 1차 동시 출시.

## 네트워크 설정 (프로젝트 표준)

| 환경 | URL |
|---|---|
| **운영 도메인** | `https://p16.sumzip.com` (nginx가 단일 도메인에서 라우팅) |
| 운영 API 베이스 | `https://p16.sumzip.com/api/v1` |
| **로컬 웹 (Vite dev)** | `http://localhost:9516` |
| **로컬 백엔드 API** | `http://localhost:9536/v1` |

> 본 프로젝트의 포트·도메인은 변경 불가 표준값입니다. 모든 설정 파일(`.env`, `vite.config.ts`, `docker-compose.yml`, `nginx.conf`, OpenAPI `servers`)이 이 값을 사용합니다.

## 아키텍처 개요

```
mis2601/
├── backend/              Node 20 + Express 4 + mysql2 (MariaDB)
├── frontend-web/         Vite 5 + Vue 3.4
├── frontend-mobile/      Capacitor 6 + Ionic Vue (iOS/Android)
├── frontend-shared/      Vue 컴포넌트·composables·Pinia 스토어 (web/mobile 공유)
├── shared/types/         OpenAPI → TypeScript 자동 생성
├── infra/                docker-compose, nginx, GitLab CI
└── specs/001-ai-career-roadmap/    Speckit 산출물 (spec/plan/tasks/...)
```

자세한 구조는 [`specs/001-ai-career-roadmap/plan.md`](specs/001-ai-career-roadmap/plan.md) 참조.

## 빠른 시작

### 1. 사전 요구사항

| 도구 | 버전 | 비고 |
|---|---|---|
| Node.js | 20 LTS | `nvm install 20 && nvm use 20` |
| pnpm | 9.x | `corepack enable && corepack prepare pnpm@9 --activate` |
| Docker / Docker Compose | 최신 | 로컬 인프라(MariaDB·Redis·MinIO) |
| Xcode (macOS) | 16+ | iOS 모바일 빌드 (R-6) |
| Android Studio | Hedgehog+ | Android 모바일 빌드 |
| JDK | 17 | Android Gradle |
| CocoaPods | 1.15+ | iOS 네이티브 의존성 |

### 2. 부트스트랩

```bash
pnpm install
cp .env.example .env             # 값 채우기
docker compose -f infra/docker/docker-compose.yml up -d
pnpm --filter backend migrate:up
pnpm dev                          # backend + web + worker 동시 기동
```

자세한 단계는 [`specs/001-ai-career-roadmap/quickstart.md`](specs/001-ai-career-roadmap/quickstart.md) 참조.

### 3. 모바일 앱 (R-6)

```bash
# 최초 1회 — 네이티브 프로젝트 생성
pnpm --filter frontend-mobile add @capacitor/ios @capacitor/android
pnpm --filter frontend-mobile exec npx cap add ios
pnpm --filter frontend-mobile exec npx cap add android

# 일상 개발 사이클
pnpm --filter frontend-mobile build
pnpm --filter frontend-mobile exec npx cap sync
pnpm --filter frontend-mobile exec npx cap run ios    # 또는 android
```

## 운영 데이터베이스

팀 DB는 외부 `mis.iptime.org:13306` / 내부 `192.168.0.91:3306` (DB·사용자: `pioneer16`). 로컬 개발은 Docker Compose의 로컬 인스턴스 사용을 권장합니다. `mis.iptime.org`를 직접 사용할 때는 Homebrew `mysql` 바이너리 대신 컨테이너 클라이언트를 사용하세요.

## 라이선스

내부 프로젝트 — TBD.
