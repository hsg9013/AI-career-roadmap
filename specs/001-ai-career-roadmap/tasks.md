---
description: "Task list for 001-ai-career-roadmap implementation — regenerated 2026-05-22 (R-6 mobile, R-7 dual-mode RBAC, R-8 mentor hybrid payouts)"
---

# Tasks: AI 기반 커리어 로드맵 및 포트폴리오 관리 서비스

**Input**: Design documents from `/Users/pioneer16/mis2601/specs/001-ai-career-roadmap/`

**Prerequisites**: plan.md, spec.md, research.md(R-1~R-8), data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 사용자가 TDD를 명시적으로 요청하지 않았으므로 본 tasks.md는 구현 태스크만 포함한다. 단, R-7(권한 이중화)과 R-8(정산 계산)은 회귀 위험이 높아 해당 모듈에 한해 단위 테스트를 권장한다. 전체 테스트 트리는 `/speckit.tasks --with-tests`로 재생성 가능.

**Organization**: 태스크는 spec.md의 10개 User Story별로 그룹화되어 각각 독립적으로 구현·검증·배포할 수 있다. 2026-05-22 갱신 결정 3건(웹+모바일 동시·대학 이중 모드·멘토 하이브리드 보상)을 전 페이즈에 걸쳐 반영했다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일이고 의존성이 없어 병렬 실행 가능
- **[Story]**: US1~US10 — 어떤 User Story에 속하는지
- 절대 경로 또는 저장소 루트(`/Users/pioneer16/mis2601/`) 기준 상대 경로 명시

## Path Conventions

- **Backend**: `backend/src/`
- **Web 프런트**: `frontend-web/src/` (Vite 5 + Vue 3.4)
- **Mobile 프런트**: `frontend-mobile/src/` (Capacitor 6 + Ionic Vue, R-6)
- **공유 컴포넌트·스토어**: `frontend-shared/src/` (web·mobile에서 import)
- **공유 타입**: `shared/types/` (OpenAPI → TS 자동 생성)
- **인프라**: `infra/docker/`, `infra/nginx/`, `infra/ci/`
- 저장소 루트: `/Users/pioneer16/mis2601/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 프로젝트 초기화, 5-워크스페이스 모노레포, 도구 체인, 인프라 컨테이너

- [x] T001 저장소 루트에 pnpm 모노레포 초기화: `package.json`(workspaces: ["backend","frontend-web","frontend-mobile","frontend-shared","shared/types"]), `pnpm-workspace.yaml`, `.npmrc`, `.gitignore`, `.editorconfig`, `README.md` 골격
- [x] T002 [P] `backend/`를 TypeScript 5.x + Express 4.x로 초기화: `backend/package.json`, `backend/tsconfig.json`, `backend/src/app.ts`, `backend/src/server.ts` 빈 골격 (포트 9536)
- [x] T003 [P] `frontend-web/`를 Vite 5 + Vue 3.4 + TypeScript로 초기화: `frontend-web/package.json`, `frontend-web/vite.config.ts`(포트 9516), `frontend-web/tsconfig.json`, `frontend-web/src/main.ts`, `App.vue`, `index.html`
- [x] T004 [P] `frontend-mobile/`를 Capacitor 6 + Ionic Vue로 초기화 (R-6): `frontend-mobile/package.json`(deps: `@ionic/vue`, `@ionic/vue-router`, `@capacitor/core`, `@capacitor/cli`), `frontend-mobile/ionic.config.json`, `frontend-mobile/capacitor.config.ts`(appId: `com.sumzip.p16`), `frontend-mobile/src/main.ts`(IonicVue 플러그인 등록), `App.vue`, `vite.config.ts`
- [x] T005 [P] `frontend-shared/` 패키지 초기화 (R-6): `frontend-shared/package.json`(type=module, exports: `./components`, `./composables`, `./stores`, `./api`, `./i18n`), `frontend-shared/tsconfig.json`. Vue 3.4 + Pinia 2 + vue-router를 peerDependency로 선언
- [x] T006 [P] `shared/types/` 패키지 초기화: `shared/types/package.json`(name: `@ai-career/shared-types`), `shared/types/tsconfig.json`. OpenAPI → TS 변환 스크립트(`openapi-typescript ../../specs/001-ai-career-roadmap/contracts/openapi.yaml -o ./src/openapi.d.ts`) 설정, `pnpm run gen` 노출
- [x] T007 [P] 공통 lint·format: 루트 `eslint.config.mjs`(typescript-eslint + vue), `.prettierrc`, `.prettierignore`, 루트 스크립트 `pnpm run lint`, `pnpm run format`
- [x] T008 [P] 루트 `.env.example` 작성 (quickstart.md §4 기준 — JWT, DB, Redis, MinIO, PortOne, PortOne Payouts(R-8), FCM/APNs(R-6), 메일러, OAuth, CORS allowlist=p16.sumzip.com)
- [x] T009 `infra/docker/docker-compose.yml` 작성: **backend(9536)**, **frontend-web nginx(9516)**, mariadb 10.x(3306), redis 7(6379), minio(9000/9001), prod profile nginx(80/443) 서비스. `infra/docker/mariadb/initdb.d/00-init.sql`로 `pioneer16` DB·유저 초기화. 헬스체크 포함
- [x] T010 [P] `infra/docker/backend.Dockerfile` 멀티스테이지(builder + runtime, non-root user `app`, **EXPOSE 9536**, healthcheck `/healthz`)
- [x] T011 [P] `infra/docker/frontend-web.Dockerfile` 멀티스테이지(vite build → nginx alpine 정적 서빙, **EXPOSE 9516**, `frontend-web.nginx.conf` 컨테이너 내부 라우팅)
- [x] T012 [P] `infra/nginx/nginx.conf`: `server_name p16.sumzip.com`, HTTPS + HSTS·CSP·X-Frame 등 보안 헤더, `/api/* → backend:9536`, `/ → frontend-web:9516`, gzip, rate-limit(api_general 20r/s, api_auth 5r/s), Let's Encrypt 인증서 경로 명시
- [x] T013 [P] `infra/ci/.gitlab-ci.yml` 골격: stages = `lint → test → build → mobile_build → image → deploy`. `mobile_build_android`(cimg/android), `mobile_build_ios`(macOS 러너), `image_backend`/`image_frontend_web`(docker-in-docker), `deploy_prod`(environment: production, url p16.sumzip.com)
- [~] T014 [P] `frontend-mobile`에 iOS/Android 네이티브 프로젝트 추가: **부분 완료** — `frontend-mobile/.gitignore`(빌드 산출물 제외), `README.md`에 `npx cap add` 명령 안내 작성. 실제 `cap add ios|android` 실행은 macOS+Xcode/Android Studio 도구 의존이므로 **사용자가 로컬에서 직접 실행 필요**. 실행 후 생성되는 `ios/`·`android/` 디렉터리는 본 저장소에 커밋
- [x] T015 루트 `pnpm run dev` 스크립트 추가: `concurrently`로 backend dev(9536), frontend-web dev(9516), backend worker 동시 기동

**Checkpoint**: 워크스페이스·인프라·도구 체인 준비 완료. Phase 2 진행 가능.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 의존하는 공통 기반 — DB 마이그레이션, 인증, 권한, 미들웨어, 공유 어댑터, 프런트 라우터·스토어 골격

**⚠️ CRITICAL**: 본 단계 완료 전에는 어떤 User Story도 시작할 수 없다.

### 백엔드 인프라

- [ ] T016 `backend/src/config/env.ts`: zod 기반 .env 검증 모듈(필수 키 누락 시 부팅 실패)
- [ ] T017 `backend/src/db/pool.ts`: mysql2/promise Pool, prepared statement 강제, idle timeout 설정
- [ ] T018 `backend/src/db/migrate.ts`: SQL 파일 기반 마이그레이션 러너 (`schema_migrations` 테이블, 단방향 적용). pnpm 스크립트 `migrate:up`, `migrate:status`
- [ ] T019 [P] `backend/src/db/migrations/V001__init_users.sql`: `users`, `social_accounts`, `refresh_tokens` 테이블 (data-model.md §P1)
- [ ] T020 [P] `backend/src/lib/logger.ts`: pino 구조화 로그 + requestId 헬퍼
- [ ] T021 [P] `backend/src/lib/jwt.ts`: 액세스/refresh 발급·검증, **scope 클레임 빌더** (R-5/R-7), key 로테이션 인터페이스
- [ ] T022 [P] `backend/src/lib/crypto/aesGcm.ts`: 컬럼 단위 AES-GCM 암복호화 유틸 (계좌·사업자번호용 — R-8)
- [ ] T023 [P] `backend/src/middlewares/errorHandler.ts`: 통합 에러 핸들러, contracts/openapi.yaml `Error` 스키마 형태 응답
- [ ] T024 [P] `backend/src/middlewares/requestValidator.ts`: zod 기반 요청 검증 래퍼(`validate(schema)(req,res,next)`)
- [ ] T025 [P] `backend/src/middlewares/auth.ts`: Bearer JWT 검증 + `req.auth = { userId, role, scopes[] }` 주입
- [ ] T026 [P] `backend/src/middlewares/scopeGuard.ts` (**R-7**): 요구 scope 검사 미들웨어 — `scopeGuard('university:individual')` 형태. 누락 시 403
- [ ] T027 [P] `backend/src/middlewares/auditLogger.ts`: 민감 액션(`audit_logs` 적재)용 미들웨어 + 라이브러리 함수 — FR-019, FR-033, FR-034 강제 적재
- [ ] T028 [P] `backend/src/middlewares/rateLimit.ts`: Redis 기반 IP·사용자별 rate limit
- [ ] T029 [P] `backend/src/lib/storage/minio.ts`: presigned URL 발급·검증(만료 15분), 버킷별 헬퍼
- [ ] T030 [P] `backend/src/lib/mailer/index.ts`: Naver Cloud Outbound Mailer 어댑터 + 한국어 마크다운 템플릿 로더
- [ ] T031 [P] `backend/src/queues/index.ts`: BullMQ 큐 정의 — `mission-review`, `notification`, `external-fetch`, `recommendation-precompute`, `payout-monthly`(R-8), `push-dispatch`(R-6)

### 백엔드 도메인 골격

- [ ] T032 `backend/src/modules/auth/router.ts` 골격 + `POST /auth/register/student`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` 미구현 핸들러 자리. JWT scope 클레임은 권한별로 발급되도록 빌더 호출
- [ ] T033 [P] `backend/src/db/migrations/V002__init_students.sql`: `students` 테이블 + `university_consent_scope` 컬럼 (R-7) + `university_id` 인덱스
- [ ] T034 [P] `backend/src/db/migrations/V003__init_consent_audit.sql`: `consent_records`, `audit_logs` 테이블
- [ ] T035 `backend/src/app.ts`: 모든 미들웨어 와이어링 — helmet, cors(allowlist), rate-limit, requestId, logger, errorHandler

### 프런트 골격 (R-6 — frontend-shared 중심 설계)

- [ ] T036 [P] `frontend-shared/src/api/client.ts`: axios 인스턴스 + 응답 인터셉터(401 → refresh 1회 → 재시도) + `shared/types`의 OpenAPI 타입 import
- [ ] T037 [P] `frontend-shared/src/stores/auth.ts`: Pinia 스토어 — 로그인 상태·access/refresh 토큰(보안 저장: web=메모리+secure cookie, mobile=Capacitor Preferences)
- [ ] T038 [P] `frontend-shared/src/composables/useAuthGuard.ts`: 라우트 가드 — 미인증 시 로그인 페이지 리다이렉트
- [ ] T039 [P] `frontend-shared/src/i18n/ko.json` + `i18n.ts`: 한국어 메시지 사전 + vue-i18n 부트스트랩
- [ ] T040 [P] `frontend-web/src/router/index.ts`: vue-router 4 라우터 — 인증/공개 라우트 분리. `useAuthGuard` 등록
- [ ] T041 [P] `frontend-mobile/src/router/index.ts` (R-6): `@ionic/vue-router`의 `createRouter` + `IonRouterOutlet`. web과 라우트 정의는 동일 import하되 모바일 전용 페이지(푸시 인박스 등) 추가
- [ ] T042 [P] `frontend-web/src/App.vue` 골격 + 레이아웃 컴포넌트(헤더·사이드바)
- [ ] T043 [P] `frontend-mobile/src/App.vue` 골격 — `IonApp + IonRouterOutlet`, 다크 모드 대응(R-6)

**Checkpoint**: Foundation ready — 각 User Story를 병렬로 시작할 수 있다.

---

## Phase 3: User Story 1 — 학생: 프로필 입력 및 역량 갭 진단 (Priority: P1) 🎯 MVP

**Goal**: 학생이 회원가입·프로필 입력 후 목표 직무 1~3개를 선택하면 시스템이 직무 요구 역량과 학생의 현재 보유 역량을 비교한 **갭 진단 결과**를 제공한다. (FR-001~008, US1)

**Independent Test**: 회원가입 → 프로필 입력(대학·학과·학년) → 목표 직무 등록 → 갭 진단 호출 → 보유/부족 역량과 우선순위 점수가 응답으로 반환되는지 확인. quickstart.md §7.1~7.2.

### Implementation for US1

- [x] T044 [P] [US1] `backend/src/db/migrations/V004__init_target_jobs_activities.sql`: `target_jobs`(학생당 max 3, FR-009), `activities`, `activity_tags`, `job_requirements` 테이블
- [x] T045 [P] [US1] `backend/src/db/migrations/V005__init_gap_diagnoses.sql`: `gap_diagnoses` 테이블
- [x] T046 [US1] `backend/src/modules/auth/handlers.ts`: 회원가입·로그인·refresh·logout 본 구현(bcrypt 12, 5회 실패 잠금, refresh 회전). `backend/src/modules/auth/handlers.test.ts`(스코프 발급 회귀 방지 단위 테스트)
- [x] T047 [US1] `backend/src/modules/students/handlers.ts`: `GET/PUT /students/me`, `PUT /students/me/target-jobs`(중복·최대 3개 검증). 의존: T046
- [x] T048 [P] [US1] `backend/src/modules/activities/handlers.ts`: `POST/PATCH/DELETE /activities` + `GET /activities` (페이징·필터). 자동 태깅은 비동기 큐(`recommendation-precompute`)로 위임
- [x] T049 [US1] `backend/src/services/gapDiagnosis.ts`: 직무 요구 역량 ↔ 학생 보유 역량(활동·자격·교육) 매칭 알고리즘 — 보유 점수·우선순위 산출. 결과를 `gap_diagnoses`에 스냅샷 저장
- [x] T050 [US1] `backend/src/modules/gap-diagnosis/handlers.ts`: `POST /gap-diagnosis`, `GET /gap-diagnosis/latest`. 의존: T047, T048, T049
- [x] T051 [P] [US1] `backend/src/services/recommendation/gateway.ts`: 외부 LLM Gateway 인터페이스 (R-1) — anonymizer 거친 입력만 전달, Redis 캐시(TTL 24h), 외부 장애 시 룰 기반 fallback. US1에서는 갭 진단 부가 분석에 한해 호출
- [x] T052 [P] [US1] `frontend-shared/src/stores/student.ts`: Pinia 스토어 — 프로필·목표 직무·갭 진단 결과 상태
- [x] T053 [P] [US1] `frontend-shared/src/components/StudentProfileForm.vue`: 프로필 입력 폼 (web/mobile 공유)
- [x] T054 [P] [US1] `frontend-shared/src/components/TargetJobPicker.vue`: 산업 코드 + 직무 코드 선택(최대 3)
- [x] T055 [P] [US1] `frontend-shared/src/components/GapDiagnosisChart.vue`: 보유/부족 역량 차트
- [x] T056 [US1] `frontend-web/src/pages/Onboarding.vue` + `Dashboard.vue`: 회원가입 후 온보딩 페이지 + 대시보드에 갭 진단 결과 표시. 의존: T053, T054, T055
- [ ] T057 [US1] `frontend-mobile/src/pages/Onboarding.vue` + `Dashboard.vue` (R-6): `IonPage` 래핑, 모바일 키보드 UX 최적화. frontend-shared 컴포넌트 재사용. 의존: T053, T054, T055
- [ ] T058 [US1] `frontend-web/src/router/index.ts` + `frontend-mobile/src/router/index.ts`에 `/onboarding`, `/dashboard` 라우트 등록
- [ ] T059 [P] [US1] `backend/src/modules/students/handlers.test.ts`: target_jobs 최대 3 검증 단위 테스트

**Checkpoint**: US1 MVP 완료. 회원가입 → 프로필 → 갭 진단까지 web/mobile 모두 동작.

---

## Phase 4: User Story 2 — 학생: 데이터 기반 합격 로드맵 추천 (Priority: P2)

**Goal**: 학생의 갭 진단 결과와 익명화된 선배 합격 경로(k≥5)를 기반으로 **개인화 로드맵**을 생성·추천한다. 학생은 항목 상태(예정/진행/완료)를 갱신할 수 있다. (FR-009~016, US2)

**Independent Test**: US1로 갭 진단 결과를 만든 학생이 `POST /roadmap` 호출 → 로드맵 항목 목록 응답 → `PATCH /roadmap/items/{id}/status`로 상태 변경 가능.

### Implementation for US2

- [ ] T060 [P] [US2] `backend/src/db/migrations/V006__init_roadmaps.sql`: `roadmaps`, `roadmap_items`, `recommendation_rationale`, `recommendation_feedback`, `senior_success_cases` 테이블
- [ ] T061 [P] [US2] `backend/src/services/anonymizer/kAnonymity.ts`: k-익명성(k≥5) 계산·검증 + 마스킹 유틸. FR-013, FR-029 강제
- [ ] T062 [US2] `backend/src/services/recommendation/roadmapBuilder.ts`: 갭 진단 + senior_success_cases(k≥5) → 로드맵 항목 생성 알고리즘. 룰 기반 매칭 + LLM 분석 결합(R-1)
- [ ] T063 [US2] `backend/src/modules/roadmap/handlers.ts`: `POST /roadmap`(생성), `GET /roadmap?target_job_id=...`, `PATCH /roadmap/items/{id}/status`, `POST /roadmap/items/{id}/feedback`(거부 학습 — FR-014)
- [ ] T064 [P] [US2] `backend/src/workers/recommendationPrecompute.ts`: 야간 배치 — 활성 학생의 로드맵을 미리 계산해 Redis 캐시
- [ ] T065 [P] [US2] `frontend-shared/src/stores/roadmap.ts`: Pinia 스토어
- [ ] T066 [P] [US2] `frontend-shared/src/components/RoadmapTimeline.vue`: 항목 카드 + 상태 토글
- [ ] T067 [P] [US2] `frontend-shared/src/components/RoadmapRationaleDrawer.vue`: 추천 근거 표시(선배 사례·요구 역량 매핑)
- [ ] T068 [US2] `frontend-web/src/pages/Roadmap.vue` + `frontend-mobile/src/pages/Roadmap.vue` (R-6): 로드맵 목록·상세. 의존: T066, T067
- [ ] T069 [US2] 라우터에 `/roadmap` 등록 (web + mobile)

**Checkpoint**: US2 완료. 학생은 갭 진단 기반의 로드맵을 받고 진척도를 갱신할 수 있다.

---

## Phase 5: User Story 3 — 학생: 활동 자동 정리 및 포트폴리오/이력서 생성 (Priority: P2)

**Goal**: 학생이 입력한 활동·미션 결과물을 자동으로 카테고리·태깅하고, AI를 활용해 이력서·자기소개서·포트폴리오 PDF/링크를 생성한다. (FR-017~021, US3)

**Independent Test**: 활동 5건 이상 보유한 학생이 `POST /documents`로 이력서 초안 생성 요청 → `generated_documents` 행 생성·LLM 호출 → `POST /documents/{id}/export` → PDF·공유 링크 URL 응답.

### Implementation for US3

- [ ] T070 [P] [US3] `backend/src/db/migrations/V007__init_generated_documents.sql`: `generated_documents`, `document_versions` 테이블
- [ ] T071 [P] [US3] `backend/src/services/anonymizer/llmInput.ts`: LLM 입력 익명화 — 실명·연락처·민감 식별자 제거
- [ ] T072 [US3] `backend/src/services/documentGenerator.ts`: 활동 → 이력서/자기소개서/포트폴리오 LLM 프롬프트 빌더 + PDF 생성(puppeteer-core 또는 pdfkit). MinIO 업로드, presigned URL 발급
- [ ] T073 [US3] `backend/src/modules/documents/handlers.ts`: `POST /documents`(생성), `GET /documents`(목록), `POST /documents/{id}/export`(PDF·링크). 의존: T072
- [ ] T074 [P] [US3] `backend/src/services/activityAutoTagger.ts`: 활동 → 태그 자동 분류(FR-016). LLM + 룰 기반 캐시
- [ ] T075 [P] [US3] `frontend-shared/src/components/DocumentEditor.vue`: 섹션별 편집·재생성 UI
- [ ] T076 [US3] `frontend-web/src/pages/Documents.vue` + `frontend-mobile/src/pages/Documents.vue` (R-6): 목록·편집·내보내기
- [ ] T077 [US3] 라우터에 `/documents` 등록 (web + mobile)

**Checkpoint**: US3 완료. 활동 데이터로부터 이력서·포트폴리오를 자동 생성하고 공유 가능.

---

## Phase 6: User Story 4 — 학생: 실무 미션 수행 및 하이브리드 피드백 수신 (Priority: P3)

**Goal**: 학생이 멘토가 등록한 실무 미션을 수행·제출하면 AI가 1차 자동 피드백(루브릭 기반)을 제공하고, 5영업일 내 멘토 코멘트가 누적된다. (FR-022~026, US4)

**Independent Test**: 학생이 미션 목록 조회 → 제출 → AI 피드백 즉시 응답 → 5영업일 내 멘토 코멘트 추가 → `mission_submissions.status='reviewed'`.

### Implementation for US4

- [ ] T078 [P] [US4] `backend/src/db/migrations/V008__init_missions.sql`: `mentors`, `missions`, `mission_submissions`, `ai_feedback_reports`, `mentor_comments`, `mentor_quality_metrics` 테이블. `mentors.mentor_track` 컬럼 포함(R-8 준비)
- [ ] T079 [US4] `backend/src/modules/missions/handlers.ts`: `GET /missions`(필터), `POST /missions/{id}/submit`(파일 업로드는 MinIO presigned), `GET /missions/submissions/me`
- [ ] T080 [P] [US4] `backend/src/services/aiFeedbackGenerator.ts`: 미션 루브릭 + 학생 제출물 → LLM 분석 → `ai_feedback_reports` 적재
- [ ] T081 [US4] `backend/src/workers/missionReviewSla.ts`: `mission-review-sla` 잡 — 5영업일 만료 시 **2단계 분기 (FR-024)** — (a) `services/mentorAssignment.ts`로 활성·평점·도메인 일치 다른 멘토 1명 재할당 시도 (재할당 가능 시 SLA 시계 +2영업일 부여), (b) 재할당 풀이 비면 `status='ai_fallback'`로 AI 보강 피드백 발송. 두 분기 모두 멘토 활성도·재할당 카운트 누적
- [ ] T082 [P] [US4] `frontend-shared/src/components/MissionBoard.vue` + `MissionSubmissionForm.vue`
- [ ] T083 [US4] `frontend-web/src/pages/Missions.vue` + `frontend-mobile/src/pages/Missions.vue` (R-6): 모바일에서는 카메라(@capacitor/camera)로 결과물 촬영 업로드 지원
- [ ] T084 [US4] 라우터에 `/missions` 등록 (web + mobile)

**Checkpoint**: US4 완료. 학생은 미션을 수행·제출하고 AI+멘토 하이브리드 피드백을 받는다.

---

## Phase 7: User Story 5 — 학생: 주기적 진척도 점검 및 알림 (Priority: P3)

**Goal**: 학생에게 로드맵 항목 마감 임박·미션 검수 완료·외부 일정(채용 마감)을 인앱·이메일·**모바일 푸시**로 알린다. 학생은 채널별 수신 동의를 토글한다. (FR-026~028, US5)

**Independent Test**: 학생이 마감 3일 전 로드맵 항목 보유 → 야간 잡 실행 → 인앱·이메일·푸시(R-6) 알림 발송 → `notification_events.status='delivered'`.

### Implementation for US5

- [ ] T085 [P] [US5] `backend/src/db/migrations/V009__init_notifications.sql`: `notification_preferences`, `notification_events`, `schedule_items` 테이블
- [ ] T086 [P] [US5] `backend/src/db/migrations/V022__init_push_tokens.sql` (R-6): `push_tokens` 테이블 (data-model.md R-6 섹션)
- [ ] T087 [US5] `backend/src/modules/notifications/handlers.ts`: `GET/PUT /notifications/preferences`, `GET /notifications/inbox`
- [ ] T088 [US5] `backend/src/modules/mobile/handlers.ts` (R-6): `POST /devices/push-tokens`, `DELETE /devices/push-tokens/{tokenId}` — 기존 (platform, device_token)이 타 사용자에 매핑 시 그쪽 `is_active=0`
- [ ] T089 [P] [US5] `backend/src/services/push/fcm.ts` + `apns.ts` (R-6): FCM/APNs 발송 어댑터. APNs는 `.p8` 인증서로 JWT 생성
- [ ] T090 [US5] `backend/src/workers/pushDispatcher.ts` (R-6): `push-dispatch` 잡 처리 — 이벤트 → 토큰 조회 → 플랫폼 분기 발송 → 실패 토큰 비활성화
- [ ] T091 [US5] `backend/src/workers/notificationDispatcher.ts`: 인앱·이메일·푸시 통합 라우팅 — `notification_preferences` 채널별 분기. 동일 알림 1일 1회 제한
- [ ] T092 [P] [US5] `frontend-shared/src/composables/usePushRegister.ts` (R-6): Capacitor `PushNotifications` 권한 요청 → 토큰 수신 → `POST /devices/push-tokens` 호출. web 환경에서는 no-op
- [ ] T093 [P] [US5] `frontend-shared/src/components/NotificationInbox.vue` + `NotificationPreferenceForm.vue`
- [ ] T094 [US5] `frontend-web/src/pages/Notifications.vue` + `frontend-mobile/src/pages/Notifications.vue` (R-6)
- [ ] T095 [US5] 라우터에 `/notifications` 등록 (web + mobile). mobile App.vue에서 부트 시 `usePushRegister` 실행

**Checkpoint**: US5 완료. 인앱·이메일·푸시 3채널 알림이 동작하고 사용자 채널 동의를 따른다.

---

## Phase 8: User Story 6 — 현직자(멘토): 미션 등록 및 코멘트 작성, **트랙·정산 (R-8)** (Priority: P3)

**Goal**: 검증된 멘토가 미션을 등록·수정하고, 제출물에 코멘트를 남기며, **자신의 정산 트랙(정액/수수료)을 관리**한다. (FR-022, FR-025, FR-045, US6 + R-8)

**Independent Test**:
1. 미션 CRUD: 멘토 검증된 사용자 → `POST /missions` → 운영자 승인 후 학생에게 노출.
2. R-8: 멘토가 `GET /mentor/me/track` → 현재 `commission` 확인 → `PATCH /mentor/me/track` `to_track='fixed'` → 90일 쿨다운 미경과 시 409, 경과 시 `mentor_track_history` 적재 + `mentors.mentor_track='fixed'`.
3. 정산 조회: `GET /mentor/me/payouts?year=2026&month=5` → 빈 배열(잡 미실행) 또는 row 응답.

### Implementation for US6

- [ ] T096 [P] [US6] `backend/src/db/migrations/V010__init_moderation_queue.sql`: `moderation_queue_items` 테이블 (멘토·미션 승인 큐)
- [ ] T097 [P] [US6] `backend/src/db/migrations/V021__init_mentor_payouts.sql` (R-8): `commission_rates`, `mentor_track_history`, `payment_methods`, `mentor_payouts` 테이블 (data-model.md R-8 섹션)
- [ ] T098 [P] [US6] `backend/src/db/migrations/V011__init_compensation_ledger.sql`: `mentor_compensation_ledger`, `senior_contribution_ledger` 테이블
- [ ] T099 [US6] `backend/src/modules/missions/mentorHandlers.ts`: 멘토용 — `POST /missions`(검수 큐 enqueue), `PATCH /missions/{id}`, `POST /missions/submissions/{id}/comment`
- [ ] T100 [P] [US6] `backend/src/modules/mentor/trackHandlers.ts` (R-8): `GET /mentor/me/track`(현재 트랙 + `next_change_eligible_at` 계산), `PATCH /mentor/me/track`(90일 쿨다운 + `mentor_track_history` 적재). 단위 테스트 필수
- [ ] T101 [P] [US6] `backend/src/modules/mentor/paymentMethodHandlers.ts` (R-8): `PUT /mentor/me/payment-method` — 계좌·사업자번호 AES-GCM 암호화(T022 사용) + 1원 인증 비동기 트리거(`bullmq:payment-verify` 잡)
- [ ] T102 [P] [US6] `backend/src/modules/mentor/payoutHandlers.ts` (R-8): `GET /mentor/me/payouts?year=&month=` — `mentor_payouts` 조회 응답
- [ ] T103 [US6] `backend/src/services/payout/calculator.ts` (R-8): 직전월 `mentor_compensation_ledger` 합산 → 트랙·시기에 맞는 `commission_rates` 조회 → `gross_krw/withholding_krw/net_krw` 계산 → `mentor_payouts` UPSERT(UNIQUE 키로 중복 차단). 단위 테스트 필수
- [ ] T104 [US6] `backend/src/workers/payoutMonthly.ts` (R-8): `payout-monthly` 잡 — cron `PAYOUT_MONTHLY_CRON`(매월 1일 02:00 KST) → 직전월 대상 멘토 순회 → T103 호출 → 운영자 검수 대기(`status='pending'`)
- [ ] T105 [P] [US6] `backend/src/services/mentorQualityMetrics.ts`: 코멘트 작성 후 `mentor_quality_metrics` 갱신 + **임계치 미달 가드 (FR-025)**: 직전 90일 평균 검수 시간 > 7영업일 OR 학생 만족도 < 3.5 OR 활성도 < 30% 중 하나라도 충족 시 `mentor_quality_metrics.assignment_blocked_until` 설정(자동 해제 30일). 별도 함수 `isMentorAssignable(mentorId)`를 `services/mentorAssignment.ts`(T081에서 사용)·`missionsHandlers.ts` 미션 배정 시점에서 호출하여 신규 배정 차단
- [ ] T106 [P] [US6] `frontend-shared/src/components/MentorMissionEditor.vue` + `MentorSubmissionInbox.vue`
- [ ] T107 [P] [US6] `frontend-shared/src/components/MentorTrackPanel.vue` (R-8): 현재 트랙 + 변경 신청 폼 + 쿨다운 안내
- [ ] T108 [P] [US6] `frontend-shared/src/components/MentorPayoutHistory.vue` (R-8): 월 정산 내역 표
- [ ] T109 [US6] `frontend-web/src/pages/MentorConsole.vue` + `frontend-mobile/src/pages/MentorConsole.vue` (R-6): 멘토 콘솔 — 미션·정산 통합 화면
- [ ] T110 [US6] 라우터에 `/mentor/console` 등록 (web + mobile)

**Checkpoint**: US6 완료. 멘토는 미션을 등록·코멘트하고, 자신의 트랙을 변경(쿨다운 검증)하며, 월 정산 내역을 확인한다.

---

## Phase 9: User Story 7 — 대학 관리자: 학생 진로 준비 현황 모니터링, **이중 모드 (R-7)** (Priority: P3)

**Goal**: 대학 관리자(취업지원센터·학과)는 (a) 학생 동의 없이도 가능한 **집계 통계 모드**와, (b) 학생 차등 동의가 있을 때만 가능한 **개인 단위 모드** 두 가지를 분리 제공받는다. (FR-034~036, US7 + R-7)

**Independent Test**:
1. 집계: scope=`university:aggregate` 토큰으로 `GET /partners/universities/dashboard/aggregate?cohort_year=2024&department=경영` → 셀별 k<5 마스킹 검증.
2. 개인 단위 (성공): 학생 A의 `university_consent_scope='individual'` + admin의 scope=`university:individual` + 대학 ID 일치 → `GET /partners/universities/students/{A}/progress` → 200 응답 + `audit_logs.action='university_view_individual'` 적재.
3. 개인 단위 (실패): 위 조건 중 하나라도 불충족 → 403.

### Implementation for US7

- [ ] T111 [P] [US7] `backend/src/db/migrations/V023__init_university_admins.sql` (R-7): `universities`, `university_admins`(scope: aggregate_only / aggregate_and_individual), `university_licenses` 테이블
- [ ] T112 [P] [US7] `backend/src/db/migrations/V024__alter_students_university_consent.sql` (R-7): `students.university_consent_scope ENUM('none','aggregate_only','individual') DEFAULT 'aggregate_only'` 컬럼 추가 (T033에서 이미 포함했다면 본 마이그레이션은 인덱스만 추가 — 중복 ALTER 회피)
- [ ] T113 [US7] `backend/src/modules/auth/universityScope.ts` (R-7): 로그인 시 `university_admins.scope`를 JWT `scope` 클레임 배열로 변환(`aggregate_only`→`["university:aggregate"]`, `aggregate_and_individual`→`["university:aggregate","university:individual"]`)
- [ ] T114 [US7] `backend/src/modules/students/consentHandlers.ts` (R-7): `PATCH /students/me/university-consent` — `students.university_consent_scope` 갱신 + `consent_records` 새 행 적재. 단위 테스트 필수
- [ ] T115 [US7] `backend/src/modules/partners/universities/aggregateHandlers.ts` (R-7): `GET /partners/universities/dashboard/aggregate` — `scopeGuard('university:aggregate')` + `university_id = admin.university_id` 필터 + k<5 셀 자동 마스킹. 의존: T061
- [ ] T116 [US7] `backend/src/modules/partners/universities/individualHandlers.ts` (R-7): `GET /partners/universities/students/{studentId}/progress` — `scopeGuard('university:individual')` + 학생측 `university_consent_scope='individual'` AND `students.university_id = admin.university_id` 3중 검증 + `auditLogger`로 `action='university_view_individual'` 강제 적재. 단위 테스트 필수 (회귀 위험 큼)
- [ ] T117 [P] [US7] `frontend-shared/src/components/UniversityConsentToggle.vue` (R-7): 학생 마이페이지에서 동의 범위 토글 — none / aggregate_only / individual
- [ ] T118 [P] [US7] `frontend-shared/src/components/UnivAggregateDashboard.vue` (R-7): 집계 통계 차트(셀 마스킹 표시)
- [ ] T119 [P] [US7] `frontend-shared/src/components/UnivStudentProgressPanel.vue` (R-7): 개인 단위 진척도 — 학생 동의 없을 시 빈 상태 안내
- [ ] T120 [US7] `frontend-web/src/pages/UniversityDashboard.vue`: 두 모드 토글 + `UnivAggregateDashboard` + (권한 시) `UnivStudentProgressPanel`. 의존: T118, T119
- [ ] T121 [US7] `frontend-mobile/src/pages/UniversityDashboard.vue` (R-6): 모바일 응답형 레이아웃
- [ ] T122 [US7] `frontend-web/src/pages/MyPage.vue`(학생 마이페이지)에 `UniversityConsentToggle` 통합 + 라우터 등록
- [ ] T123 [P] [US7] 보안 회귀 단위 테스트: `backend/src/modules/partners/universities/individualHandlers.test.ts` — 3중 조건 각각의 음/양성 케이스 (R-7)

**Checkpoint**: US7 완료. 대학 관리자는 두 모드를 명확히 분리해서 사용하고, 학생은 차등 동의를 자유롭게 토글한다.

---

## Phase 10: User Story 8 — 기업 HR: 직무 요구사항 등록 및 인재 매칭 (Priority: P4)

**Goal**: 기업 HR가 직무를 등록하면 시스템이 학생 풀에서 매칭 후보를 익명 핸들로 제시하고, 학생 동의 후 컨택 가능하게 한다. (FR-037~040, US8)

**Independent Test**: 기업 사용자 `POST /partners/enterprises/job-postings` → 매칭 잡 실행 → 익명 핸들 목록 → `POST /partners/enterprises/contact-requests` → 학생에게 알림 발송(US5와 연동).

### Implementation for US8

- [ ] T124 [P] [US8] `backend/src/db/migrations/V012__init_partners_enterprise.sql`: `enterprises`, `enterprise_hrs`, `job_postings`, `contact_requests` 테이블
- [ ] T125 [US8] `backend/src/modules/partners/enterprises/handlers.ts`: `POST /partners/enterprises/job-postings`, `POST /partners/enterprises/contact-requests`
- [ ] T126 [P] [US8] `backend/src/services/enterpriseMatcher.ts`: 학생 풀 매칭 + 익명 핸들 매핑(reverse map은 백엔드 보관)
- [ ] T127 [P] [US8] `frontend-shared/src/components/JobPostingForm.vue` + `CandidateMatchList.vue`
- [ ] T128 [US8] `frontend-web/src/pages/EnterpriseConsole.vue` + `frontend-mobile/src/pages/EnterpriseConsole.vue` (R-6)
- [ ] T129 [US8] 라우터에 `/enterprise/console` 등록 (web + mobile)

**Checkpoint**: US8 완료. 기업 HR가 직무 등록·매칭·컨택까지 일관된 흐름 완성.

---

## Phase 11: User Story 9 — 학생: 멤버십 결제 및 단건 결제 (**결제 도메인 본체**) (Priority: P4)

**Goal**: 학생이 PortOne을 통해 멤버십 정기결제·단건 결제를 진행하고, 결제 실패·환불·정기 재시도가 안정적으로 처리된다. R-3·R-8과 결합되어 PG·정산·세금 도메인이 통합 완성된다. (FR-041~044, US9 + R-3 + R-8)

**Independent Test**:
1. 멤버십: `POST /payments/checkout` → PortOne 결제창 → 성공 웹훅(`POST /payments/webhook/portone`) → `memberships.status='active'` + `payment_transactions.status='approved'`.
2. 정기결제: 빌링키 발급 후 한 달 뒤 BullMQ 잡 → 자동 결제 시도 → 실패 시 D+0/D+1/D+3 재시도.
3. 환불: 운영자 또는 학생 요청 → PortOne 환불 API → `payment_transactions.status='refunded'`.

### Implementation for US9

- [ ] T130 [P] [US9] `backend/src/db/migrations/V020__init_payments_core.sql`: `memberships`, `payment_transactions` 테이블
- [ ] T131 [US9] `backend/src/lib/portone/client.ts` (R-3): PortOne REST 클라이언트 + 멱등성 키 + 서명 검증 유틸
- [ ] T132 [US9] `backend/src/modules/payments/checkoutHandlers.ts`: `POST /payments/checkout`(주문 생성·결제 URL 반환), `POST /payments/webhook/portone`(서명 검증·멤버십 상태 전이), `POST /payments/refunds/{txId}`
- [ ] T133 [US9] `backend/src/workers/billingRetry.ts`: 정기결제 실패 시 D+0/D+1/D+3 재시도. 3회 실패 시 `memberships.status='past_due'` + 사용자 알림(US5와 연동)
- [ ] T134 [US9] `backend/src/services/payment/portoneSync.ts`: PortOne 거래 상태와 로컬 `payment_transactions` 정합성 정기 점검(보조 잡)
- [ ] T135 [US9] T097(`commission_rates`)의 초기 데이터 시드: `pnpm --filter backend run seed:commission-rates` — 정액 30분 30,000원 / 수수료 2000bps(20%) 행 삽입 (R-8 정책 시작점)
- [ ] T136 [US9] `backend/src/services/payout/payoutDispatcher.ts` (R-8): T104가 생성한 `mentor_payouts.status='approved'` 행을 PortOne Payouts API로 송금 요청 → `paid_at`, `external_payout_id` 갱신, 실패 시 `failure_reason` 적재
- [ ] T137 [P] [US9] `frontend-shared/src/components/MembershipPicker.vue` + `CheckoutModal.vue`
- [ ] T138 [P] [US9] `frontend-shared/src/components/PaymentHistory.vue`
- [ ] T139 [US9] `frontend-web/src/pages/Billing.vue` + `frontend-mobile/src/pages/Billing.vue` (R-6): 모바일은 인앱 결제 정책 검토 필요(현재 모델은 인앱 결제 우회 가능하나 스토어 정책 변동 모니터링 — 운영 메모)
- [ ] T140 [US9] 라우터에 `/billing` 등록 (web + mobile)
- [ ] T141 [P] [US9] `backend/src/modules/payments/checkoutHandlers.test.ts`: 웹훅 서명 검증·멱등성 단위 테스트
- [ ] T142 [P] [US9] `backend/src/services/payout/calculator.test.ts` (R-8): 정액 트랙 / 수수료 트랙 / 원천세 3.3% 계산 회귀 테스트

**Checkpoint**: US9 완료. 멤버십·단건 결제·환불·재시도·멘토 정산 송금까지 결제 도메인 전 흐름이 통합 동작.

---

## Phase 12: User Story 10 — 선배(졸업생/취업자): 합격 경로 데이터 기부 및 익명화 동의 (Priority: P4)

**Goal**: 졸업생·취업 성공자가 자신의 합격 경로를 익명화 옵션을 선택해 기부하고, 시스템은 k-익명성을 검증한 데이터만 추천 풀에 포함한다. (FR-029~031, US10)

**Independent Test**: 선배가 `POST /senior-contributions` → 익명화 처리 → `senior_success_cases` 적재 → k 재계산 잡 실행 → `k_anonymity_level≥5`인 행만 추천 풀에 노출.

### Implementation for US10

- [ ] T143 [P] [US10] `backend/src/db/migrations/V013__init_senior_contributions.sql`: `senior_contributions`(미가공) → 익명화 후 `senior_success_cases`(공개) 매핑
- [ ] T144 [US10] `backend/src/modules/seniors/handlers.ts`: `POST /senior-contributions`, `GET /senior-contributions/me`, `POST /senior-contributions/{id}/revoke`(철회 → 추천 풀 제외)
- [ ] T145 [US10] `backend/src/workers/anonymizeSenior.ts`: 기부 적재 후 즉시 익명화·k 계산. `senior-anonymize-recompute` 잡으로 정기 재계산
- [ ] T146 [P] [US10] `frontend-shared/src/components/SeniorContributionForm.vue`(익명화 옵션 명시)
- [ ] T147 [US10] `frontend-web/src/pages/SeniorContribute.vue` + `frontend-mobile/src/pages/SeniorContribute.vue` (R-6)
- [ ] T148 [US10] 라우터에 `/senior/contribute` 등록 (web + mobile)
- [ ] T149 [P] [US10] `backend/src/services/anonymizer/kAnonymity.test.ts`: k=5 경계·복합 준식별자 단위 테스트

**Checkpoint**: US10 완료. 모든 User Story가 독립적으로 동작 가능.

---

## Phase 13: Critical/High Remediation (2026-05-22 `/speckit.analyze` 후속 보강)

**Purpose**: `/speckit.analyze`에서 식별된 Critical/High 갭(C1·C2·C3·C4·C5·C6) 해소를 위한 횡단 도메인 태스크. 본 페이즈는 P3·P4 일부 스토리에 기능을 추가·통합하므로 **해당 스토리 페이즈와 병행 또는 직후에 수행**하는 것이 자연스럽다(아래 의존 참조).

### 14.1 학생 개인정보 권리 (FR-004 / GAP C2)

- [ ] T165 [P] [US1+] `backend/src/db/migrations/V025__init_data_subject_requests.sql`: `data_subject_requests`(action: export/delete, status: pending/processing/ready/expired, requested_at, fulfilled_at, download_url, expires_at), `retention_schedule`(student_id, anonymize_due_at) 테이블
- [ ] T166 [US1+] `backend/src/modules/students/dataRightsHandlers.ts`: `POST /students/me/data-export`(요청 → 비동기 잡 enqueue), `GET /students/me/data-export/{requestId}`(상태·다운로드 URL), `POST /students/me/account-deletion`(30일 유예 시작), `POST /students/me/account-deletion/cancel`(유예 중 취소)
- [ ] T167 [US1+] `backend/src/workers/dataExportBuilder.ts`: 학생 전체 도메인 데이터 수집 → ZIP+JSON 패키지 생성 → MinIO 업로드 → presigned URL(7일 유효)·이메일 발송
- [ ] T168 [US1+] `backend/src/workers/retentionSweep.ts`: 야간 잡 — `retention_schedule` 만료 학생을 안전 익명화(식별 컬럼 nullify, k-익명성 유지), 30일 유예 만료된 탈퇴 요청 자동 처리. 사전 90/30/7일 알림 발송
- [ ] T169 [P] [US1+] `frontend-shared/src/components/DataRightsPanel.vue`: 내보내기·탈퇴 요청 UI (web/mobile 공유). 라우터 등록은 `/mypage/privacy`

### 14.2 동의 5종 통합 (FR-031 / GAP C4)

- [ ] T170 [P] [US1+] `backend/src/db/migrations/V026__init_consent_categories.sql`: `consent_categories`(code, label, is_required, description) 마스터 시드 행 5건(service_use, university_share, enterprise_share, anonymous_dataset, marketing). `consent_records.category_code FK` 컬럼 추가
- [ ] T171 [US1+] `backend/src/modules/students/consentMatrixHandlers.ts`: `GET /students/me/consents`(5종 현재 상태 + 시점 이력), `PATCH /students/me/consents`(부분 갱신, 각 항목별 `consent_records` 새 행 적재). T114(university 단독) handler는 본 통합 엔드포인트로 **deprecate** 또는 wrapper로 위임
- [ ] T172 [P] [US1+] `frontend-shared/src/components/ConsentMatrix.vue`: 5종 토글 매트릭스 + 시점 이력 expandable. 마이페이지 `/mypage/consent`에 통합

### 14.3 정기 리포트 (FR-026 / FR-028 / GAP C3)

- [ ] T173 [P] [US5+] `backend/src/db/migrations/V027__init_periodic_reports.sql`: `periodic_reports`(student_id, period_kind: quarterly/semester_end, period_start, period_end, payload_json, generated_at, sent_at)
- [ ] T174 [US5+] `backend/src/services/periodicReportBuilder.ts`: 로드맵 달성률·완료 활동·신규 추천 후보·다가오는 일정 집계 → payload_json 생성
- [ ] T175 [US5+] `backend/src/workers/periodicReportScheduler.ts`: cron — 분기 마지막날·학기 종료일(3월말/6월말/9월말/12월말 추가)에 전 활성 학생 대상 T174 호출 → `notification_events` 발생(이메일+푸시+인앱)
- [ ] T176 [P] [US5+] `backend/src/modules/students/reportsHandlers.ts`: `GET /students/me/reports`(목록), `GET /students/me/reports/{id}`(상세)
- [ ] T177 [P] [US5+] `frontend-shared/src/components/PeriodicReportView.vue` + `frontend-web/src/pages/Reports.vue` + `frontend-mobile/src/pages/Reports.vue` (R-6)

### 14.4 채용 성사·수수료 청구 (FR-040 / GAP C1)

- [ ] T178 [P] [US8+] `backend/src/db/migrations/V028__init_enterprise_billings.sql`: `enterprise_billings`(enterprise_id, placement_id, fee_bps, fee_krw, status: draft/issued/paid/refunded, issued_at, paid_at, external_invoice_id), `placements`(student_id, enterprise_id, job_posting_id, start_date, salary_krw NULL, contract_kind, confirmed_by_student_at, confirmed_by_enterprise_at)
- [ ] T179 [US8+] `backend/src/modules/partners/enterprises/placementHandlers.ts`: `POST /partners/enterprises/placements`(학생·기업 양측 보고 — 양측 컨펌 시 확정), `POST /partners/enterprises/placements/{id}/cancel`(90일 내 환급)
- [ ] T180 [US8+] `backend/src/services/enterpriseBilling/feeCalculator.ts`: 확정 시점에 기업 계약의 `placement_fee_bps`로 청구 금액 계산 → `enterprise_billings` draft 생성
- [ ] T181 [US8+] `backend/src/workers/invoiceGenerator.ts`: draft → PDF 청구서 생성(MinIO) → 기업 HR 이메일 발송 → 운영자 검수 큐(`moderation_queue_items.kind='enterprise_billing'`)
- [ ] T182 [US8+] `backend/src/services/enterpriseBilling/portoneCollector.ts`: 운영자 승인된 청구서 → PortOne 결제 요청 → 웹훅 수신 → `status='paid'`
- [ ] T183 [P] [US8+] `frontend-shared/src/components/PlacementReportForm.vue` + `EnterpriseBillingHistory.vue`

### 14.5 선배 기여 인센티브 (FR-046 / GAP C6)

- [ ] T184 [P] [US10+] `backend/src/db/migrations/V029__init_senior_rewards.sql`: `senior_reward_ledger`(contributor_token, kind: cash/credit/badge, amount_krw NULL, credit_units NULL, badge_code NULL, reason, accrued_at, settled_at), `senior_badges`(code, name, criteria_json)
- [ ] T185 [US10+] `backend/src/services/seniorRewards.ts`: 기부 적재(T144) + k-익명성 통과(T145) 시 자동 — 현금 5,000원 적립, 크레딧 500원 적립, 기준 도달 시 뱃지 발급
- [ ] T186 [P] [US10+] `backend/src/modules/seniors/rewardsHandlers.ts`: `GET /senior/contributions/me/rewards`(적립·사용 내역 + 현재 뱃지)
- [ ] T187 [US10+] `backend/src/workers/seniorPayout.ts`: 분기 단위 cash 송금(PortOne Payouts 재사용, 멘토 정산과 동일 인프라). 사업자 정보 미보유 기여자는 크레딧으로만 적립
- [ ] T188 [P] [US10+] `frontend-shared/src/components/SeniorRewardsPanel.vue` + 마이페이지 통합

### 14.6 비즈니스 메트릭 측정 인프라 (SC-001~SC-020 / GAP C5)

- [ ] T189 [P] (cross) `backend/src/db/migrations/V030__init_analytics_events.sql`: `analytics_events`(event_code, user_id, properties_json, occurred_at) — 파티셔닝 또는 월별 인덱스
- [ ] T190 [P] (cross) `backend/src/lib/analytics/tracker.ts`: 백엔드 이벤트 송신 함수 + 표준 이벤트 키 카탈로그(예: `student.gap_diagnosis.completed`, `student.roadmap.item_completed`, `mentor.review.delivered_within_sla`, `payment.subscription.churned`)
- [ ] T191 [P] (cross) `frontend-shared/src/lib/analytics/client.ts`: 프런트 이벤트 송신(axios 기반 비동기 큐, 오프라인 시 IndexedDB/Capacitor Preferences 버퍼)
- [ ] T192 (cross) `backend/src/workers/successCriteriaAggregator.ts`: 일 단위 잡 — `analytics_events`에서 SC-001~SC-020 KPI를 집계해 `success_criteria_snapshots` 적재
- [ ] T193 [P] (cross) `backend/src/modules/admin/kpiHandlers.ts`: `GET /admin/kpi?from=&to=` — 운영자 대시보드용 KPI 응답
- [ ] T194 [P] (cross) `frontend-web/src/pages/AdminKpiDashboard.vue`: SC-001~SC-020 시각화 (운영자 전용 web 페이지, 모바일 제외)

**Checkpoint**: Phase 13 완료 시 `/speckit.analyze` Critical 3건 + High 6건 모두 해소. 잔여 MEDIUM/LOW finding은 Polish 또는 별도 사이클에서 처리.

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: 다수 스토리에 걸친 마무리·품질·보안·문서·운영성 작업

- [ ] T150 [P] 통합 헬스/레디니스 엔드포인트: `backend/src/modules/admin/healthHandlers.ts` — `GET /healthz`(액세스 무인증), `GET /readyz`(DB·Redis·MinIO·LLM 외부 의존성 ping)
- [ ] T151 [P] 운영자 검수 큐: `backend/src/modules/admin/moderationHandlers.ts` — `GET /admin/moderation-queue`, `POST /admin/moderation-queue/{id}/approve|reject`
- [ ] T152 [P] 외부 데이터 수집 워커: `backend/src/workers/externalDataFetch.ts` — 채용·자격증·일정 일 단위 갱신 (FR-006)
- [ ] T153 [P] 백엔드 보안 헤더·CORS·CSRF 최종 점검 + `infra/SECURITY.md` 작성(키 로테이션·인시던트 절차)
- [ ] T154 [P] 관측성: 백엔드 metrics 엔드포인트(prom-client) — 큐 길이, 외부 API 지연, DB pool 사용률
- [ ] T155 [P] frontend-shared `npm exports` map 검증 — tree-shaking 동작, web·mobile 빌드에서 dead code 제거 확인
- [ ] T156 [P] Capacitor 플러그인 추가 점검 (R-6): `@capacitor/preferences`(보안 저장), `@capacitor/biometric-authentication`(커뮤니티, 선택), `@capacitor/app`(딥링크)
- [ ] T157 [P] 모바일 푸시 토큰 위생: 비활성 토큰 30일 후 hard delete 잡(`workers/pushTokenCleanup.ts`, R-6)
- [ ] T158 [P] OpenAPI → shared/types 자동 생성 CI 검사: `shared/types/src/openapi.d.ts`가 contracts/openapi.yaml과 동기화되지 않으면 CI 실패
- [ ] T159 [P] quickstart.md §7 시나리오 자동 검증 스크립트 `scripts/smoke.sh`: 새로운 환경에서 회원가입→갭진단→로드맵→문서 1회 통과
- [ ] T160 [P] `infra/ci/.gitlab-ci.yml`에 deploy 단계 채우기: staging(feature 브랜치) + prod(main) + 자동 롤백 훅
- [ ] T161 [P] 문서 정리: `README.md` 갱신(5-워크스페이스 다이어그램), `infra/RUNBOOK.md`(운영 점검·장애 대응)
- [ ] T162 [P] 백엔드 로깅 PII 마스킹 점검 — 이메일·전화·계좌·사업자번호 출력 금지
- [ ] T163 운영자 결제·정산 대시보드: `/admin/payouts` — 월 정산 검수·승인 UI(웹 전용) (R-8)
- [ ] T164 `/speckit.analyze` 실행 후 잔여 일관성 이슈 해소

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능, T001 이후 T002~T015는 다수가 `[P]`
- **Foundational (Phase 2)**: Setup 완료 후 시작. T016 → T035 일부 직렬, 미들웨어·라이브러리는 `[P]`. **이 단계가 끝나야 어떤 User Story도 시작할 수 없음**
- **US1 (Phase 3, P1, MVP)**: Foundational 완료 후 시작. MVP 후보
- **US2~US3 (Phase 4~5, P2)**: Foundational 완료 후 시작. US1과 병렬 가능(인력 여유 시)
- **US4~US7 (Phase 6~9, P3)**: Foundational 완료 후 시작. **US6은 R-8 정산 도메인의 일부를 선행 — US9의 PortOne Payouts 송금 단계와 결합**
- **US8~US10 (Phase 10~12, P4)**: P3 일부와 병렬 가능. **US9는 US6의 R-8 마이그레이션(V021)에 의존** — 동일 PR 또는 V021을 US9로 옮기는 결정 필요(현재는 US6에 배치)
- **Polish (Phase 13)**: 모든 원하는 User Story 완료 후

### Cross-Story 의존 (R-6/R-7/R-8 관련)

- T097 (V021 mentor_payouts 마이그레이션, R-8)은 **US6과 US9 양쪽에서 사용**. US6에서 먼저 적용.
- T086 (V022 push_tokens, R-6)은 US5 전용이지만, 다른 모바일 페이지가 푸시를 활성화하는 시점에 토큰이 있어야 함 — US5 전 또는 US5 시작 시점에 마이그레이션 적용.
- T112 (V024 students.university_consent_scope ALTER, R-7)는 **T033(V002)에서 이미 컬럼을 포함하기로 했으면 중복 ALTER 회피** — 한쪽으로 통일.
- T136 (payoutDispatcher, R-8)은 T104(payoutMonthly) 출력에 의존. US6 + US9 모두 완료된 뒤 활성화.

### Within Each User Story

- Models(마이그레이션) → Services → Endpoints → UI components → Pages → Router 등록
- 같은 파일을 건드리는 두 태스크는 직렬(예: T040/T041은 다른 라우터 파일이므로 `[P]`)
- 보안·정산 회귀 위험 모듈(R-7/R-8) 단위 테스트는 구현 직후 같은 페이즈 내에서 작성

### Parallel Opportunities

- Phase 1 마이크업: T002~T013은 거의 모두 `[P]`
- Phase 2 미들웨어·라이브러리(T019~T031)는 대부분 `[P]`
- 각 User Story 내에서 마이그레이션·UI 컴포넌트는 `[P]`로 표시된 항목 병렬 가능
- 인력이 충분하면 P3 4개 스토리(US4·US5·US6·US7)를 4트랙 병렬 가능

---

## Parallel Example: User Story 1 (MVP)

```bash
# Phase 3 US1 마이그레이션·UI 컴포넌트 병렬 착수
Task: "T044 [US1] backend/src/db/migrations/V004__init_target_jobs_activities.sql"
Task: "T045 [US1] backend/src/db/migrations/V005__init_gap_diagnoses.sql"
Task: "T052 [US1] frontend-shared/src/stores/student.ts"
Task: "T053 [US1] frontend-shared/src/components/StudentProfileForm.vue"
Task: "T054 [US1] frontend-shared/src/components/TargetJobPicker.vue"
Task: "T055 [US1] frontend-shared/src/components/GapDiagnosisChart.vue"

# 위 6개 완료 후 직렬: T046(auth) → T047(students) → T048(activities) → T049(gap service) → T050(endpoint)
# 그 후 페이지: T056(web) + T057(mobile) 병렬
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Phase 1 (Setup, T001~T015)** — 5-워크스페이스 모노레포·인프라 컨테이너 준비
2. **Phase 2 (Foundational, T016~T043)** — JWT scope/scopeGuard 포함 인증·DB·미들웨어 + 프런트 라우터·스토어 골격
3. **Phase 3 (US1, T044~T059)** — 회원가입 → 프로필 → 갭 진단 web+mobile
4. **STOP & VALIDATE**: quickstart.md §7.1~7.2 시나리오로 web/mobile 검증
5. 사내 데모 또는 베타 출시

### Incremental Delivery (P1 → P2 → P3 → P4)

1. MVP(US1) 완료 후 US2(로드맵) → US3(문서) 순차 출시 (P2)
2. P3 4스토리 — 인력 따라 1~4트랙 병렬. **US6과 US9는 R-8 마이그레이션 공유로 인접 출시 권장**
3. P4 — US8(기업) → US9(결제·정산 통합) → US10(선배 기부)
4. Phase 13 Polish

### Parallel Team Strategy (4명 가정)

- 팀 전체가 Phase 1+2 완료
- 이후 트랙:
  - 개발자 A: US1 → US2 → US3 (P1·P2 학생 도메인)
  - 개발자 B: US4 → US5 (P3 미션·알림)
  - 개발자 C: US6 + US9 (R-8 정산 통합 — 한 사람이 도메인 일관성 유지)
  - 개발자 D: US7 (R-7 권한 이중화 + 보안 회귀 테스트)
  - US8·US10은 P4에서 합류

---

## Notes

- 본 tasks.md는 2026-05-22 결정(웹+모바일 동시·대학 이중 모드·멘토 하이브리드 보상)을 반영해 옛 200-태스크 버전으로부터 재생성됐다. 옛 버전은 `tasks-2026-05-15-backup.md`에 보존.
- `[P]`는 다른 파일·의존성 없음. 같은 파일을 건드리는 두 태스크는 직렬.
- 각 User Story는 독립 검증·배포 가능해야 한다 — checkpoint에서 정지하고 quickstart.md 시나리오 검증 후 다음 단계.
- 보안·정산 단위 테스트(T046, T100, T103, T114, T116, T123, T141, T142, T149)는 회귀 위험이 큰 모듈로 사실상 필수.
- git 미사용 상태이므로 `/speckit.implement` 직전에 `git init` + 초기 커밋(현 spec/plan/tasks 산출물) 권장.
- `.specify/memory/constitution.md`가 placeholder이므로 정식 출범 시 `/speckit.constitution` 단계로 명문화 권장.
