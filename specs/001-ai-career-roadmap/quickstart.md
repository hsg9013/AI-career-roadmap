# Quickstart: AI Career Roadmap & Portfolio Service

**Branch**: `001-ai-career-roadmap` | **Date**: 2026-05-22 (모바일·정산·권한 이중화 + 네트워크 표준 반영)

로컬 개발 환경에서 백엔드·웹 프런트·**모바일 앱**을 띄우고 P1 핵심 흐름(회원가입 → 프로필 입력 → 갭 진단 → 로드맵 조회)을 검증하기 위한 안내. 본 문서는 plan.md·research.md(R-1~R-8)·data-model.md·contracts/openapi.yaml의 결정을 반영한다.

## 0. 네트워크 표준값 (프로젝트 전역)

| 항목 | 값 |
|---|---|
| **운영 도메인** | `p16.sumzip.com` (HTTPS, nginx 단일 진입점) |
| **운영 API 베이스** | `https://p16.sumzip.com/api/v1` |
| **로컬 웹 (Vite dev)** | `http://localhost:9516` |
| **로컬 백엔드 API** | `http://localhost:9536/v1` |
| **로컬 docker 컨테이너 포트** | backend → 9536, frontend-web nginx → 9516, mariadb → 3306, redis → 6379, minio → 9000/9001 |

> 위 포트·도메인은 변경 금지 표준값입니다. `.env`·`vite.config.ts`·`docker-compose.yml`·`nginx.conf`·OpenAPI `servers`는 모두 이 값에 정렬되어 있습니다.

## 1. 사전 요구사항

| 도구 | 버전 | 비고 |
|------|------|------|
| Node.js | 20 LTS | `nvm install 20 && nvm use 20` |
| pnpm | 9.x | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker / Docker Compose | 최신 | 로컬 MariaDB·Redis·MinIO 구동용 |
| Git | 2.x | |
| Xcode | 16+ (macOS) | iOS 시뮬레이터·빌드 (R-6 모바일) |
| Android Studio | Hedgehog+ | Android 에뮬레이터·SDK Platform 34·Build-Tools 34 (R-6) |
| JDK | 17 (Temurin) | Android Gradle 빌드 |
| CocoaPods | 1.15+ | iOS 네이티브 의존성 (`sudo gem install cocoapods`) |
| Capacitor CLI | 6.x | `pnpm add -D @capacitor/cli` (frontend-mobile에 내장) |
| (선택) `mysql` 클라이언트 | 8.x or MariaDB 10.x | DB 점검용. **Homebrew mysql 사용 금지**, 컨테이너 클라이언트 사용 권장 |

> 팀 DB는 `mis.iptime.org:13306` (외부) / `192.168.0.91:3306` (내부)에 위치. 로컬 개발 시 운영 DB를 직접 사용하지 않고 Docker Compose의 로컬 MariaDB 인스턴스를 사용하는 것을 권장.

## 2. 저장소 부트스트랩

```bash
git clone <repo-url> mis2601 && cd mis2601
pnpm install         # backend, frontend workspace 동시 설치
cp .env.example .env # 아래 4번 항목 참조하여 채울 것
```

권장 디렉토리 구조 (plan.md "Project Structure" 참조 — 2026-05-22 R-6 모바일 도입 반영):

```
mis2601/
├── backend/
├── frontend-shared/      # Vue 컴포넌트·Pinia 스토어·composables (웹·모바일 공유)
├── frontend-web/         # Vite 5 + Vue 3.4 (브라우저)
├── frontend-mobile/      # Capacitor 6 + Ionic Vue (iOS/Android 빌드)
│   ├── ios/              # `npx cap add ios` 후 생성
│   └── android/          # `npx cap add android` 후 생성
├── shared/types/         # OpenAPI → TypeScript 자동 생성
├── infra/
│   ├── docker/
│   ├── nginx/
│   └── ci/
└── specs/001-ai-career-roadmap/
```

## 3. 인프라 기동 (Docker Compose)

```bash
cd infra/docker
docker compose up -d mariadb redis minio
```

- **MariaDB**: 컨테이너 이름 `mariadb`, 포트 `localhost:3306`, root 비번 `.env`에서 설정. 초기 DB·유저는 `infra/docker/mariadb/initdb.d/`의 SQL이 자동 적용.
- **Redis**: `localhost:6379`, 비번 옵션.
- **MinIO**: 콘솔 `http://localhost:9001`, S3 엔드포인트 `http://localhost:9000`, 기본 액세스 키 `.env`에서 설정. 버킷 `portfolios`, `mission-submissions`, `mentor-attachments`, `senior-anonymized`는 부팅 스크립트가 자동 생성.

## 4. 환경 변수 (`.env`)

```dotenv
# --- 공통 ---
NODE_ENV=development
TZ=Asia/Seoul

# --- 백엔드 ---
PORT=9536
JWT_ACCESS_SECRET=replace-me-min-32-bytes
JWT_REFRESH_SECRET=replace-me-min-32-bytes
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=30

# DB (로컬 Docker)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=pioneer16
DB_PASSWORD=pioneer26
DB_NAME=pioneer16
DB_POOL_MAX=10

# Redis
REDIS_URL=redis://127.0.0.1:6379

# MinIO (S3 호환)
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_PORTFOLIOS=portfolios
S3_BUCKET_SUBMISSIONS=mission-submissions

# 외부 서비스 (개발 단계는 sandbox 키)
LLM_PROVIDER=anthropic        # or openai, naver-clova
LLM_API_KEY=
LLM_MODEL=claude-haiku-4-5

PORTONE_IMP_KEY=
PORTONE_IMP_SECRET=
# R-8: PortOne Payouts (멘토 정산)
PORTONE_PAYOUTS_API_KEY=
PORTONE_PAYOUTS_API_SECRET=
PAYOUT_MONTHLY_CRON="0 2 1 * *"           # 매월 1일 02:00 KST (R-8)
PAYOUT_WITHHOLDING_BPS=330                # 원천세 3.3% (R-8)

MAILER_PROVIDER=naver-cloud
MAILER_API_KEY=
MAILER_FROM=no-reply@example.com

# R-6: 모바일 푸시 (FCM=Android, APNs=iOS)
FCM_SERVER_KEY=
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=com.example.aicareer
APNS_KEY_P8_PATH=./secrets/AuthKey_XXXX.p8

OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_NAVER_CLIENT_ID=
OAUTH_NAVER_CLIENT_SECRET=

# --- 프론트 웹 (포트 9516) ---
VITE_API_BASE_URL=http://localhost:9536/v1
VITE_PORT=9516

# --- 프론트 모바일 (frontend-mobile/.env) ---
VITE_API_BASE_URL=http://10.0.2.2:9536/v1     # Android 에뮬레이터에서 host loopback
# iOS 시뮬레이터는 http://localhost:9536/v1 사용 가능 (capacitor.config.ts 환경별 분기)
# 운영 빌드는 https://p16.sumzip.com/api/v1
```

> **운영 DB 사용 시 주의**: `DB_HOST=mis.iptime.org`, `DB_PORT=13306`으로 설정 가능하지만, 로컬 개발 변경이 운영 데이터에 영향을 주지 않도록 별도 스키마 사용을 권장.

## 5. DB 마이그레이션·시드

```bash
# 백엔드 디렉토리에서
pnpm --filter backend run migrate:up     # db/migrations/V*.sql 순차 적용
pnpm --filter backend run seed:dev       # 직무 사전, 익명 선배 사례 샘플 등
```

마이그레이션 파일은 `backend/src/db/migrations/V001__init.sql` 등 단방향. 적용 이력은 `schema_migrations` 테이블에 기록.

## 6. 개발 서버 기동

```bash
# 백엔드 (포트 9536)
pnpm --filter backend run dev

# 웹 프런트 (포트 9516 — 프로젝트 표준)
pnpm --filter frontend-web run dev

# 백그라운드 워커 (BullMQ — 알림, 미션 SLA, 외부 데이터 갱신, 월 정산 R-8, 푸시 디스패치 R-6)
pnpm --filter backend run worker:dev
```

세 프로세스를 동시에 띄우려면 `pnpm run dev`로 묶은 루트 스크립트를 사용한다.

### 6.1 모바일 앱 (R-6, Capacitor + Ionic Vue)

```bash
# 최초 1회 — 네이티브 프로젝트 생성
pnpm --filter frontend-mobile add @capacitor/ios @capacitor/android
pnpm --filter frontend-mobile exec npx cap add ios
pnpm --filter frontend-mobile exec npx cap add android

# 일상 개발 사이클
pnpm --filter frontend-mobile run build        # ionic build → dist/
pnpm --filter frontend-mobile exec npx cap sync # 네이티브 프로젝트로 자산 복사

# iOS 시뮬레이터로 실행 (macOS only)
pnpm --filter frontend-mobile exec npx cap run ios

# Android 에뮬레이터로 실행
pnpm --filter frontend-mobile exec npx cap run android
```

> `cap sync`는 Vue 코드 변경 시마다 실행 필요. `ionic serve`로 브라우저 미리보기는 가능하지만 푸시·바이오메트릭은 디바이스/시뮬레이터에서만 검증 가능.

## 7. P1 흐름 수동 검증 (curl)

### 7.1 학생 회원가입 → 로그인

```bash
curl -X POST http://localhost:9536/v1/auth/register/student \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@univ.ac.kr",
    "password": "Passw0rd!23",
    "university": "MIS대학교",
    "major": "경영정보학",
    "year_in_school": 3
  }'

curl -X POST http://localhost:9536/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{ "email": "test@univ.ac.kr", "password": "Passw0rd!23" }'
# -> access_token 발급. 이후 요청에 Authorization: Bearer <token>
```

### 7.2 목표 직무 등록 → 활동 등록 → 갭 진단

```bash
TOKEN="..."  # 위 응답의 access_token

curl -X PUT http://localhost:9536/v1/students/me/target-jobs \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '[{"industry_code":"IT","job_role_code":"PM","priority":1}]'

curl -X POST http://localhost:9536/v1/activities \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "category": "project",
    "title": "교내 데이터 분석 프로젝트",
    "started_at": "2025-03-01",
    "ended_at": "2025-06-15",
    "outcome": "사용자 행동 분석 보고서"
  }'

TARGET_JOB_ID="..."  # GET /v1/students/me/target-jobs에서 확인
curl -X POST http://localhost:9536/v1/gap-diagnosis \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"target_job_id\": $TARGET_JOB_ID}"
```

### 7.3 로드맵 생성·조회

```bash
curl -X POST http://localhost:9536/v1/roadmap \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"target_job_id\": $TARGET_JOB_ID}"

curl "http://localhost:9536/v1/roadmap?target_job_id=$TARGET_JOB_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### 7.4 문서 자동 생성

```bash
curl -X POST http://localhost:9536/v1/documents \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"doc_type\":\"resume\",\"template_code\":\"basic-v1\",\"target_job_id\": $TARGET_JOB_ID}"
```

### 7.5 모바일 푸시 토큰 등록 (R-6)

```bash
# 시뮬레이터 콘솔에서 발급된 device_token을 사용
curl -X POST http://localhost:9536/v1/devices/push-tokens \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"platform":"ios","device_token":"<APNs-token>","app_version":"1.0.0","os_version":"17.5"}'
```

### 7.6 학생 — 대학 측 차등 동의 토글 (R-7)

```bash
curl -X PATCH http://localhost:9536/v1/students/me/university-consent \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"scope":"individual"}'   # 또는 aggregate_only, none
```

### 7.7 대학 관리자 — 두 모드 대시보드 (R-7)

```bash
# 집계 모드 (scope=university:aggregate)
curl "http://localhost:9536/v1/partners/universities/dashboard/aggregate?cohort_year=2024" \
  -H "Authorization: Bearer $UNIV_ADMIN_TOKEN"

# 개인 모드 (scope=university:individual + 학생 동의 필요)
curl "http://localhost:9536/v1/partners/universities/students/42/progress" \
  -H "Authorization: Bearer $UNIV_ADMIN_TOKEN"
```

### 7.8 멘토 — 트랙·정산 (R-8)

```bash
# 현재 트랙 조회
curl "http://localhost:9536/v1/mentor/me/track" -H "Authorization: Bearer $MENTOR_TOKEN"

# 트랙 변경 (90일 쿨다운, 409 시 next_change_eligible_at 확인)
curl -X PATCH "http://localhost:9536/v1/mentor/me/track" \
  -H "Authorization: Bearer $MENTOR_TOKEN" -H 'Content-Type: application/json' \
  -d '{"to_track":"fixed","reason":"장기 계약 전환"}'

# 정산 계좌 등록 (1원 인증 비동기 트리거)
curl -X PUT "http://localhost:9536/v1/mentor/me/payment-method" \
  -H "Authorization: Bearer $MENTOR_TOKEN" -H 'Content-Type: application/json' \
  -d '{"bank_code":"088","account_no":"110-***-******","account_holder":"홍길동","is_business":false}'

# 월 정산 내역 조회
curl "http://localhost:9536/v1/mentor/me/payouts?year=2026&month=5" \
  -H "Authorization: Bearer $MENTOR_TOKEN"
```

## 8. 테스트

```bash
# 백엔드 단위·통합
pnpm --filter backend test
pnpm --filter backend test:integration   # 별도 docker-compose 테스트 DB 기동 후

# 프론트 웹 단위
pnpm --filter frontend-web test
pnpm --filter frontend-shared test

# E2E (Playwright — 웹)
pnpm --filter frontend-web test:e2e

# 모바일 회귀(1차는 수동, P3에서 Detox/Maestro 자동화 도입 예정)
# 시뮬레이터/에뮬레이터에서 시나리오 따라 수동 검증
```

## 9. 빌드 및 컨테이너 이미지

```bash
pnpm build                                       # backend, frontend-web, frontend-mobile(JS), frontend-shared, shared/types 빌드
docker compose -f infra/docker/docker-compose.yml build
docker compose -f infra/docker/docker-compose.yml up -d
```

Nginx가 `infra/nginx/nginx.conf` 설정대로 `/api/* → backend:3000`, `/` → frontend-web 정적 자산을 서빙.

### 9.1 모바일 앱 릴리스 빌드 (R-6)

```bash
# Android (Google Play Internal Testing → Production)
pnpm --filter frontend-mobile run build
pnpm --filter frontend-mobile exec npx cap sync android
pnpm --filter frontend-mobile exec npx cap open android   # Android Studio → Build → Generate Signed Bundle (.aab)

# iOS (TestFlight → App Store)
pnpm --filter frontend-mobile run build
pnpm --filter frontend-mobile exec npx cap sync ios
pnpm --filter frontend-mobile exec npx cap open ios       # Xcode → Product → Archive → Distribute App
```

> CI 자동화: `infra/ci/.gitlab-ci.yml`의 `mobile:build:android` 잡(리눅스 러너)과 `mobile:build:ios` 잡(macOS 러너 필수, GitLab Cloud 또는 자체 Mac runner)에서 같은 절차를 수행. 코드 사이닝 인증서는 GitLab Variables(Apple App Store Connect API Key, Android Keystore base64)에 저장.

## 10. 운영 인프라 (참고)

- 운영 배포: GitLab CI `.gitlab-ci.yml`이 `main` 머지 시 이미지 빌드 → registry push → 운영 서버에서 docker compose pull/up.
- 비밀: GitLab Variables(masked + protected).
- 모니터링: `/healthz`(액세스 무인증), `/readyz`(DB·Redis·S3·LLM 의존성), 구조화 로그는 stdout → 운영 로그 수집기로 라우팅 가정.

## 11. 자주 마주치는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| `ECONNREFUSED 3306` | MariaDB 미기동 | `docker compose ps`로 컨테이너 상태 확인. `docker compose logs mariadb`. |
| Homebrew `mysql` 명령 사용 시 인증 실패 | 호환성 이슈 (Intent-Plan.md 주의 사항) | `docker exec -it mariadb mysql -u pioneer16 -ppioneer26 pioneer16` |
| LLM 호출 비용 폭증 | 캐시 미적용 | Redis 캐시 키 확인, TTL 설정 점검 |
| MinIO presigned URL 만료 | 시계 동기화 | 호스트 시간 NTP 확인 |
| 5영업일 SLA 잡 미실행 | 워커 미기동 | `worker:dev` 프로세스 확인 |

## 12. 다음 단계

- 본 quickstart로 P1 흐름이 동작함을 확인한 후, `/speckit.tasks`로 작업 분해 → `/speckit.implement` 단계 진행.
- P2(로드맵 추천 정교화·문서 자동 생성 고도화) 후 P3·P4 모듈을 단계적 추가.
- 정식 `.specify/memory/constitution.md`를 작성해 게이트를 명확히 한 뒤 `/speckit.plan` 재검토 권장.
