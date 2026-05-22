# Implementation Plan: AI 기반 커리어 로드맵 및 포트폴리오 관리 서비스

**Branch**: `001-ai-career-roadmap` | **Date**: 2026-05-22 | **Spec**: `/Users/pioneer16/mis2601/specs/001-ai-career-roadmap/spec.md`

**Input**: Feature specification from `/Users/pioneer16/mis2601/specs/001-ai-career-roadmap/spec.md` (2026-05-22 갱신: FR-034 대학 이중 모드, Assumptions 1차 플랫폼 = 웹+모바일 동시, Assumptions 멘토 하이브리드 보상)

## Summary

대학생 대상 AI 기반 커리어 로드맵·포트폴리오 관리 SaaS의 구현 계획. **2026-05-22 갱신 결정 반영**:

- **1차 출시 = 웹 + 모바일 앱(iOS·Android) 동시**. 동일 Vue 3.4 + TypeScript 코드베이스를 **Capacitor 6 + Ionic Vue**로 래핑하여 단일 컴포넌트 자산을 양 플랫폼에 공급(R-6).
- **대학 대시보드는 두 모드 분리 제공**(집계/개인). JWT `scope` 클레임 + 학생측 `university_consent_scope` 차등 동의로 권한 이중화(R-7).
- **멘토 보상은 하이브리드**(정액 트랙 + 수수료 트랙). `mentor_track` + `commission_rates` + `mentor_payouts` + `payment_methods` 4-테이블로 정산 도메인 신설, PortOne Payouts 연동(R-8).

백엔드는 Express 4 + mysql2(MariaDB 10.x, mis.iptime.org:13306), 큐는 BullMQ on Redis, 객체 저장은 MinIO, 결제는 PortOne(빌링+Payouts), 메일은 Naver Cloud Outbound Mailer, 모바일 푸시는 FCM/APNs. spec.md의 10개 User Story와 35개 Key Entity를 P1→P2→P3→P4 4단계로 인도해 구현한다.

## Network Standards (변경 불가)

| 항목 | 값 |
|---|---|
| 운영 도메인 | `p16.sumzip.com` (HTTPS) |
| 운영 API 베이스 | `https://p16.sumzip.com/api/v1` (nginx가 단일 도메인에서 라우팅) |
| 로컬 웹 (Vite dev) | `http://localhost:9516` |
| 로컬 백엔드 API | `http://localhost:9536/v1` |

위 값은 프로젝트 표준값이며 `.env`·`vite.config.ts`·`docker-compose.yml`·`nginx.conf`·OpenAPI `servers`에 모두 동일하게 적용된다.

## Technical Context

**Language/Version**: TypeScript 5.x (backend/frontend-web/frontend-mobile 공통), Node.js 20 LTS (backend·CI), Java 17 (Android Gradle 빌드 환경), Xcode 16 / Swift 5.10 (iOS 빌드 환경)

**Primary Dependencies**:
- backend: Express 4.x, mysql2 (Promise pool), zod, bcrypt, jsonwebtoken, ioredis, bullmq, pino, @aws-sdk/client-s3 (MinIO), @portone/server-sdk (또는 REST 직호출)
- frontend-web: Vue 3.4, Vite 5, vue-router 4, Pinia 2, @vueuse/core, axios, openapi-typescript(자동 타입 생성)
- frontend-mobile: **Capacitor 6 + @ionic/vue + @ionic/vue-router** + 위의 Vue/Pinia/axios 자산 공유. Capacitor 플러그인: `@capacitor/push-notifications`, `@capacitor/preferences`, `@capacitor/camera`, `@capacitor/biometric-authentication`(커뮤니티)
- shared: `frontend-shared/`(Vue 컴포넌트·composables·Pinia 스토어 공유), `shared/types/`(OpenAPI → TypeScript 자동 생성)
- 테스트: Vitest(단위), Playwright(E2E 웹), Detox 또는 Maestro(E2E 모바일, P3 이후 도입)

**Storage**:
- MariaDB 10.x (mis.iptime.org:13306, DB `pioneer16`) — 메타데이터·관계형 데이터
- MinIO (자체호스팅, S3 호환) — 미션 제출물·이력서·문서 등 파일
- Redis 7 — 세션 캐시, BullMQ 큐, rate-limit

**Testing**: Vitest + Supertest(API), Playwright(웹 E2E), 모바일 수동 회귀(1차) → P3에 자동화 도입

**Target Platform**:
- 백엔드: Linux 컨테이너 (Docker, nginx 리버스 프록시)
- 프런트 웹: 모던 브라우저(Chrome/Safari/Edge/Firefox 최신 2개 메이저, IE/구 Edge 미지원)
- 프런트 모바일: iOS 15+ (App Store), Android 9+ (API 28, Google Play)

**Project Type**: web + mobile (단일 백엔드 API + 두 개 프런트 빌드 타깃 + 1개 공유 패키지)

**Performance Goals**:
- 로드맵 생성 API p95 < 2.0s (외부 LLM 호출 포함, 캐시 우회 시)
- 일반 CRUD API p95 < 200ms
- 모바일 앱 콜드 스타트 < 3s (네이티브 셸 + 웹 자산 프리로드)
- 푸시 알림 발송 시 → 디바이스 도달 p95 < 5s

**Constraints**:
- 한국 PIPA·정보통신망법 준수, k-익명성 5 이상 강제
- 미션 검수 SLA 5영업일 (FR-024)
- 모든 민감 DB 컬럼(계좌·사업자번호·주민번호)은 AES-GCM 암호화 컬럼 단위 저장
- mis.iptime.org 단일 인스턴스 MariaDB → 향후 replica 도입 전까지 단일 장애점 인지

**Scale/Scope**:
- 1년차 활성 학생 5천 ~ 1만명, 멘토 200 ~ 500명, 동시 접속 500
- 모바일 앱 다운로드 1년 차 2만 ~ 4만 (Android 70% / iOS 30% 가정)
- 학생당 평균 활동·로드맵 항목 50~200개

## Constitution Check

`.specify/memory/constitution.md`는 현재 템플릿 상태(placeholder만 존재)이므로 명시적 게이트 위반은 없다. 단, Speckit 표준 가드라인을 자체 적용:

| 게이트 | 상태 | 비고 |
|---|---|---|
| 명세 ↔ 계획 일치 | ✅ | spec.md 2026-05-22 갱신본 기준, R-6/R-7/R-8 결정 명시 |
| Tests-first 원칙 | ⚠️ 부분 | 본 계획에서는 구현 태스크 우선 진행, 통합 테스트는 P2 마무리 시점 도입(tasks.md `--with-tests`로 재생성 가능) |
| 단일 책임 모듈 경계 | ✅ | backend는 도메인별 디렉터리(auth/students/missions/payments/university 등) |
| Observability | ✅ | pino 구조화 로그 + requestId, /healthz·/readyz |
| 비밀 분리 | ✅ | .env 분리, DB 비밀번호·PG 키·JWT 키는 GitLab Variables(masked + protected) |
| Constitution 자체 미정 (placeholder) | 추후 작성 | 본 프로젝트 진행 중 별도 `/speckit.constitution` 단계로 명문화 권장 |

**위반 없음** — Phase 0/1 진행 가능.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-career-roadmap/
├── plan.md              # 본 파일 (2026-05-22 재생성)
├── research.md          # R-1~R-8 결정·근거
├── data-model.md        # DDL + R-6/R-7/R-8 신규 도메인
├── quickstart.md        # 로컬 개발 환경 부트
├── contracts/openapi.yaml # 도메인별 REST 계약
├── checklists/requirements.md
└── tasks.md             # `/speckit.tasks`로 별도 재생성 예정 (R-6/R-7/R-8 반영)
```

### Source Code (repository root: `/Users/pioneer16/mis2601/`)

```text
backend/                 # Node 20 + Express 4 + TypeScript
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/env.ts                     # zod 기반 .env 검증
│   ├── db/
│   │   ├── pool.ts                       # mysql2 promise pool
│   │   ├── migrate.ts                    # SQL 마이그레이션 러너
│   │   └── migrations/
│   │       ├── V001__init_users.sql
│   │       ├── V002__init_students.sql   # university_consent_scope 포함
│   │       ├── V003__init_consent_audit.sql
│   │       ├── ...
│   │       ├── V020__init_payments_core.sql       # memberships, payment_transactions
│   │       ├── V021__init_mentor_payouts.sql      # R-8: commission_rates, mentor_payouts, payment_methods, mentor_track_history
│   │       ├── V022__init_push_tokens.sql         # R-6
│   │       └── V023__init_university_admins.sql   # R-7
│   ├── middlewares/
│   │   ├── auth.ts                       # JWT 검증
│   │   ├── scopeGuard.ts                 # R-7: scope 클레임 검사
│   │   ├── auditLogger.ts                # 민감 액션 audit_logs 적재
│   │   ├── errorHandler.ts
│   │   ├── rateLimit.ts
│   │   └── requestValidator.ts
│   ├── modules/
│   │   ├── auth/                         # 회원가입·로그인·OAuth·refresh
│   │   ├── students/                     # students CRUD + university-consent 토글
│   │   ├── activities/
│   │   ├── gap-diagnosis/
│   │   ├── roadmap/
│   │   ├── documents/
│   │   ├── missions/
│   │   ├── mentor/                       # R-8: track 조회/변경, payment-method, payouts
│   │   ├── payments/                     # PortOne 결제·Payouts·웹훅
│   │   ├── partners/
│   │   │   ├── universities/             # R-7: aggregate, individual 두 컨트롤러 분리
│   │   │   └── enterprises/
│   │   ├── notifications/                # 인앱·이메일·푸시 라우팅
│   │   ├── mobile/                       # R-6: push token 등록/삭제
│   │   └── admin/
│   ├── services/
│   │   ├── recommendation/               # 외부 LLM gateway + 룰 매칭
│   │   ├── anonymizer/                   # k-익명성 계산·검증
│   │   ├── payout/                       # R-8: 월 정산 계산 잡
│   │   └── push/                         # R-6: FCM/APNs 라우터
│   ├── lib/
│   │   ├── logger.ts                     # pino
│   │   ├── mailer/                       # Naver Cloud Outbound Mailer
│   │   ├── storage/                      # MinIO presigned URL
│   │   ├── crypto/                       # AES-GCM 컬럼 암호화
│   │   └── jwt.ts                        # 발급/검증 + scope 빌더
│   └── workers/
│       ├── missionReviewSla.ts           # 5영업일 만료 처리
│       ├── recommendationPrecompute.ts
│       ├── payoutMonthly.ts              # R-8: 매월 1일 02:00 KST
│       ├── pushDispatcher.ts             # R-6
│       └── externalDataFetch.ts          # 채용·자격증 일 단위 갱신
├── tests/                                # Vitest + Supertest
└── package.json

frontend-shared/         # Vue 컴포넌트·composables·Pinia 스토어 (web/mobile 공통)
├── src/
│   ├── components/      # 도메인 컴포넌트(웹/모바일 양쪽에서 사용)
│   ├── composables/     # useAuth, useRoadmap 등
│   ├── stores/          # Pinia (auth, student, roadmap, ...)
│   ├── api/             # axios 인스턴스 + OpenAPI 타입 import
│   └── i18n/            # 한국어 메시지
└── package.json         # type=module, exports로 트리쉐이킹

frontend-web/            # Vite 5 + Vue 3.4 (브라우저 빌드)
├── src/
│   ├── main.ts          # createApp + frontend-shared 모듈 mount
│   ├── App.vue
│   ├── router/          # vue-router 4 (웹 전용 라우트 포함)
│   └── pages/           # 페이지 단위 SFC (대시보드/로드맵/문서/...)
├── vite.config.ts
└── package.json

frontend-mobile/         # Capacitor 6 + Ionic Vue (iOS/Android 빌드)
├── src/
│   ├── main.ts          # createApp + IonicVue 플러그인 + frontend-shared mount
│   ├── App.vue          # IonApp + IonRouterOutlet
│   ├── router/          # @ionic/vue-router (스택 네비)
│   └── pages/           # 모바일 특화 페이지 (탭바·푸시 알림 인박스 등)
├── ios/                 # `npx cap add ios` 산출물
├── android/             # `npx cap add android` 산출물
├── capacitor.config.ts
├── ionic.config.json
└── package.json

shared/types/            # OpenAPI → TypeScript 타입 자동 생성
├── src/
│   ├── openapi.d.ts     # `openapi-typescript ../specs/001-ai-career-roadmap/contracts/openapi.yaml -o openapi.d.ts`
│   └── index.ts
└── package.json

infra/
├── docker/
│   ├── docker-compose.yml          # mariadb·redis·minio·backend·frontend-web
│   ├── backend.Dockerfile
│   ├── frontend-web.Dockerfile     # vite build → nginx 정적 서빙
│   └── mariadb/initdb.d/00-init.sql
├── nginx/
│   └── nginx.conf                  # /api → backend, /(웹) → frontend-web 정적
└── ci/
    └── .gitlab-ci.yml              # lint→test→build→mobile:build:android/ios→deploy

package.json             # 루트 pnpm workspaces: backend, frontend-web, frontend-mobile, frontend-shared, shared/types
pnpm-workspace.yaml
.npmrc
.gitignore
.editorconfig
eslint.config.mjs
.prettierrc
README.md
.env.example
```

**Structure Decision**: pnpm 모노레포 + 5개 워크스페이스(`backend`, `frontend-web`, `frontend-mobile`, `frontend-shared`, `shared/types`). 단일 백엔드, 두 프런트 빌드 타깃, 한 공유 패키지로 코드 중복 없이 web/mobile을 동시 출시. 모바일 빌드 잡(`mobile:build:ios` macOS 러너 필요)은 GitLab CI에서 분기.

## Phase 0 Output

**`research.md`** — 8개 결정 사항:

| # | 영역 | 결정 |
|---|---|---|
| R-1 | AI 추천 엔진 | 외부 LLM API + 룰 기반 하이브리드 |
| R-2 | 파일 스토리지 | MinIO 자체호스팅 (S3 호환) |
| R-3 | 결제 게이트웨이 | PortOne (빌링키 + 멤버십 + Payouts) |
| R-4 | 메일·알림 | Naver Cloud Outbound Mailer + FCM/APNs |
| R-5 | 인증 | JWT 액세스 + DB refresh 회전, HttpOnly 쿠키, scope claim |
| **R-6** | **모바일 앱 FW** | **Capacitor 6 + Ionic Vue + 기존 Vue 자산 공유** |
| **R-7** | **대학 권한** | **집계/개인 엔드포인트 분리 + scope + university_consent_scope 차등 동의** |
| **R-8** | **멘토 보상** | **`mentor_track` + `commission_rates` + `mentor_payouts`, PortOne Payouts** |

## Phase 1 Output

- `data-model.md` — 35개 Key Entity → DDL. R-6/R-7/R-8 신규 테이블(`commission_rates`, `mentor_track_history`, `payment_methods`, `mentor_payouts`, `push_tokens`, `university_admins`) 및 컬럼 변경(`students.university_consent_scope`, `students.university_id`, `mentors.mentor_track`, `mentors.track_changed_at`).
- `contracts/openapi.yaml` — 도메인별 REST 계약. 신규 엔드포인트:
  - `GET /partners/universities/dashboard/aggregate` (scope=university:aggregate)
  - `GET /partners/universities/students/{studentId}/progress` (scope=university:individual + 학생 동의)
  - `PATCH /students/me/university-consent`
  - `GET|PATCH /mentor/me/track`, `PUT /mentor/me/payment-method`, `GET /mentor/me/payouts`
  - `POST /devices/push-tokens`, `DELETE /devices/push-tokens/{tokenId}`
  - 신규 태그 `mentor`, `mobile` 추가, `bearerAuth`에 scope 사용 설명 추가.
- `quickstart.md` — 모바일 빌드 워크플로(`pnpm --filter frontend-mobile build && npx cap sync && npx cap run ios|android`) 및 .env 신규 키(`FCM_SERVER_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `PORTONE_PAYOUTS_KEY`) 추가.

## Complexity Tracking

> Constitution이 placeholder이므로 강제 게이트 없음. 다만 자체 평가상 추가 복잡도가 정당화되는 항목을 기록:

| 추가 복잡도 | 도입 이유 | 채택하지 않은 대안 |
|---|---|---|
| 5번째 워크스페이스(`frontend-shared`) | web/mobile 컴포넌트·스토어 중복 0%, 단일 변경점 | 단일 frontend에 모바일 빌드를 같은 디렉터리로 추가 시 Vite vs Capacitor 빌드 파이프라인 충돌·번들 분기 복잡도↑ |
| 두 워크스페이스(`frontend-web`, `frontend-mobile`) 분리 | iOS/Android 네이티브 산출물(`ios/`, `android/`)이 웹 빌드와 충돌. Vite 5와 Capacitor 6의 자산 처리 차이 격리 | 단일 frontend에 platform=web|ios|android 환경변수 분기 → CI 매트릭스·캐시 복잡, dev server 차이로 디버깅 난도↑ |
| `mentor_payouts` + `mentor_compensation_ledger` 동시 존재 | 단건 적립(ledger) vs 월 정산(payouts) 단위 분리로 회계·감사 추적 명확 | 단일 테이블에 정산 단위 컬럼 추가 → 월 마감 후 단건 수정 시 정산 무결성 위험 |
| `commission_rates` 별도 테이블(코드 변경 없이 정책 변경) | 정책(20% 수수료/30분 30,000원)이 운영 정책 — 코드 배포로 변경 시 운영 민첩성·감사 추적 결여 | 환경변수 또는 코드 상수 → 변경 이력 미보존, 정책 시점별 정산 차이 재현 불가 |

---

본 plan.md는 2026-05-22 결정(웹+모바일 동시, 대학 이중 모드, 멘토 하이브리드 보상)을 반영해 완전 재생성된 문서다. 다음 단계는 `/speckit.tasks` 실행으로 `tasks.md`를 갱신하는 것.
