# Implementation Plan: AI 기반 진로·취업 로드맵 플랫폼

**Branch**: `002-intent-specify` | **Date**: 2026-06-05 | **Spec**: `/Users/pioneer16/mis2601/specs/002-intent-specify/spec.md`

**Input**: Feature specification from `/Users/pioneer16/mis2601/specs/002-intent-specify/spec.md` (Clarifications 2026-06-05: 전체 P1~P4 범위, 가용성 99.5%/24h 복구, 초기 규모 학생 ~1만·선배 ~1천)

## Summary

intent-specify.md의 전체 비전을 단일 명세(spec.md, 9개 User Story · 25개 FR · 14개 Key Entity)로 정리한 것을 구현하는 계획이다. 동일 코드베이스(001-ai-career-roadmap 모노레포) 위에서 진행하며, 기능을 **P1(역량 갭 진단 MVP) → P2(로드맵·문서 자동화) → P3(미션·알림·대학·멘토 정산) → P4(기업 매칭·결제·선배 데이터 기부)** 4단계로 인도한다.

핵심 기술 결정은 001에서 확정된 스택을 계승한다: 백엔드 Express 4 + mysql2(MariaDB) + BullMQ on Redis + MinIO, 결제·정산 PortOne, 메일 Naver Cloud, 푸시 FCM/APNs. 프런트는 Vue 3.4 + TypeScript 단일 코드베이스를 Capacitor 6 + Ionic Vue로 래핑해 웹·iOS·Android에 동시 공급한다. 추천 엔진은 AI + 규칙 기반 하이브리드이며, 선배 데이터는 k-익명성(≥5) 충족 시에만 추천에 사용한다.

## Network Standards (변경 불가)

| 항목 | 값 |
|---|---|
| 운영 도메인 | `p16.sumzip.com` (HTTPS) |
| 운영 API 베이스 | `https://p16.sumzip.com/api/v1` (nginx 단일 도메인 라우팅) |
| 로컬 웹 (Vite dev) | `http://localhost:9516` |
| 로컬 백엔드 API | `http://localhost:9536/v1` |

위 값은 프로젝트 표준값이며 `.env`·`vite.config.ts`·`docker-compose.yml`·`nginx.conf`·OpenAPI `servers`에 동일하게 적용된다.

## Technical Context

**Language/Version**: TypeScript 5.x (backend/web/mobile 공통), Node.js 20 LTS (backend·CI), Java 17 (Android 빌드), Xcode 16 / Swift 5.10 (iOS 빌드)

**Primary Dependencies**:
- backend: Express 4.x, mysql2(Promise pool), zod, bcrypt, jsonwebtoken, ioredis, bullmq, pino, @aws-sdk/client-s3(MinIO), @portone/server-sdk
- frontend-web: Vue 3.4, Vite 5, vue-router 4, Pinia 2, @vueuse/core, axios, openapi-typescript(자동 타입 생성)
- frontend-mobile: Capacitor 6 + @ionic/vue + @ionic/vue-router, 웹 자산 공유. 플러그인: `@capacitor/push-notifications`, `@capacitor/preferences`, `@capacitor/camera`
- shared: `frontend-shared/`(컴포넌트·composables·Pinia 스토어), `shared/types/`(OpenAPI → TS 자동 생성)
- 추천: AI(LLM) 호출 + 규칙 기반 스코어링 하이브리드 모듈
- 테스트: Vitest(단위), Supertest(API), Playwright(웹 E2E), Detox/Maestro(모바일 E2E, P3 도입)

**Storage**:
- MariaDB 10.x — 회원·활동·로드맵·진단 등 관계형 핵심 데이터
- MinIO (S3 호환) — 이력서·미션 제출물·생성 문서 등 파일
- Redis 7 — 세션·조회 캐시, BullMQ 큐, rate-limit

**Testing**: Vitest + Supertest(API), Playwright(웹 E2E), 모바일은 수동 회귀(P1~P2) → P3 자동화 도입

**Target Platform**: 백엔드 Linux 컨테이너(Docker + nginx 리버스 프록시); 웹은 모던 브라우저 최신 2개 메이저; 모바일 iOS 15+ / Android 9+(API 28)

**Project Type**: web + mobile (단일 백엔드 API + 웹/모바일 두 빌드 타깃 + 공유 패키지)

**Performance Goals** (SC-011·SC-012 기준):
- 로드맵 생성 API p95 < 2.0s (LLM 호출 포함)
- 일반 조회 API p95 < 200ms
- 모바일 콜드 스타트 < 3s, 푸시 도달 p95 < 5s
- 월 가용성 ≥ 99.5%, 장애 시 핵심 데이터 24h 내 복구(일일 백업)

**Constraints**:
- 한국 PIPA·정보통신망법 준수, k-익명성 ≥5 강제(FR-019)
- 미션 검수 SLA 5영업일(FR-012)
- 민감 컬럼(계좌·주민번호 등) AES-GCM 컬럼 단위 암호화(FR-020)
- 동의 변경 이력 append-only 기록(FR-021), 보존기간 경과 자동 익명화/삭제(FR-022)
- 추천 산출에서 성별·나이·출신학교 민감 속성 제외(FR-007)
- 단일 인스턴스 MariaDB → 일일 백업 + 24h 복구 절차로 SPOF 보완(향후 replica)
- 초기 한국어만 지원

**Scale/Scope** (Clarification 2026-06-05):
- 초기 학생 ~1만 명, 선배 합격 경로 ~1천 건(대학 1~3곳 파일럿), 멘토 200~500명, 동시 접속 ~500
- 일부 세부 직무 코호트는 k≥5 미달 가능 → 대체 추천 안내 경로 빈번 동작 전제
- 학생당 활동·로드맵 항목 50~200개

## Constitution Check

*GATE: Phase 0 전 통과 필수. Phase 1 후 재확인.*

`.specify/memory/constitution.md`는 템플릿(placeholder) 상태이므로 명시적 게이트 위반은 없다. Speckit 표준 가드라인 자체 적용:

| 게이트 | 상태 | 비고 |
|---|---|---|
| 명세 ↔ 계획 일치 | ✅ | spec.md(2026-06-05 clarify본) 9 US / 25 FR 추적 |
| 단일 책임 모듈 경계 | ✅ | backend 도메인 디렉터리 분리(auth/students/diagnosis/roadmap/...) |
| Observability | ✅ | pino 구조화 로그 + requestId, `/healthz`·`/readyz` |
| 비밀 분리 | ✅ | `.env` 분리, DB·PG·JWT 키는 배포 변수(masked) |
| Tests-first | ⚠️ 부분 | 구현 우선, 계약·통합 테스트는 단계 마무리 시 도입 |
| Constitution 명문화 | 추후 | `/speckit.constitution` 별도 진행 권장 |

**위반 없음** — Phase 0/1 진행 가능. (Post-Design 재평가: 아래 Phase 1 종료부 동일 결과)

## Project Structure

### Documentation (this feature)

```text
specs/002-intent-specify/
├── plan.md              # 본 파일
├── research.md          # Phase 0 산출물
├── data-model.md        # Phase 1 산출물
├── quickstart.md        # Phase 1 산출물
├── contracts/           # Phase 1 산출물 (OpenAPI)
│   └── openapi.yaml
├── checklists/
│   └── requirements.md  # /speckit.specify 산출물
└── tasks.md             # /speckit.tasks 산출물 (본 명령 아님)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   ├── auth/            # FR-001~002 5종 역할·권한
│   │   ├── students/        # FR-003 프로필
│   │   ├── diagnosis/       # FR-004 역량 갭 진단 (P1)
│   │   ├── roadmap/         # FR-005~007 로드맵·거부이력·편향제외 (P2)
│   │   ├── documents/       # FR-008~009 활동정리·문서생성 (P2)
│   │   ├── missions/        # FR-010~012 미션·결합 피드백 (P3)
│   │   ├── notifications/   # FR-013 진척·알림 (P3)
│   │   ├── university/      # FR-014 대학 이중 모드 (P3)
│   │   ├── companies/       # FR-015 기업 매칭 (P4)
│   │   ├── payments/        # FR-016~017 결제·멘토 정산 (P4)
│   │   ├── alumni/          # FR-018~019 선배 데이터·익명화·k익명성 (P4)
│   │   ├── consent/         # FR-021~022 동의·보존
│   │   ├── jobpostings/     # FR-024 외부 공고 수집·신선도
│   │   └── admin/           # FR-023 운영자 검수
│   ├── lib/                 # db, redis, minio, crypto(AES-GCM), recommender(AI+rule)
│   └── middleware/          # authz, rate-limit, requestId, error
└── tests/ { contract/, integration/, unit/ }

frontend-shared/             # Vue 컴포넌트·composables·Pinia 스토어 (웹/모바일 공유)
frontend-web/                # Vite 빌드 타깃
frontend-mobile/             # Capacitor 래핑 (ios/, android/)
shared/types/                # OpenAPI → TS 자동 생성
```

**Structure Decision**: 모노레포(단일 백엔드 + 공유 프런트 자산 + 웹/모바일 빌드 타깃 + 타입 패키지). 001에서 확립된 구조를 계승하며, 본 명세의 신규 도메인(companies/alumni/jobpostings)을 모듈로 추가한다.

## Phase 0 — Research (research.md)

해소 대상 NEEDS CLARIFICATION 및 의사결정 항목:
- R-1 추천 엔진 하이브리드(AI+규칙) 구성과 편향 제외 전략 (FR-005~007)
- R-2 k-익명성(≥5) 코호트 판정 및 미달 시 대체 추천 (FR-019, Edge Cases)
- R-3 민감 데이터 AES-GCM 컬럼 암호화 + 동의 이력 append-only (FR-020~021)
- R-4 대학 이중 모드 권한(통계/개인) 설계 (FR-014)
- R-5 멘토 정산 하이브리드(정액/수수료) + PortOne Payouts (FR-017)
- R-6 웹+모바일 단일 코드베이스(Capacitor) 공유 전략
- R-7 가용성 99.5%·24h 복구를 위한 백업·복구 절차 (SC-012)
- R-8 미션 검수 SLA 5영업일 초과 시 재배정/AI 대체 큐 설계 (FR-012)

→ 결정·근거·대안을 research.md에 기록.

## Phase 1 — Design & Contracts

- **data-model.md**: 14개 Key Entity를 테이블/관계로 확장(학생·선배경로·진단·로드맵·활동·문서·미션/제출물/피드백·멘토·대학·기업·동의·결제정산·알림·채용공고). 상태 전이(미션 lifecycle, 결제/정산 상태, 동의 변경 이력) 포함.
- **contracts/openapi.yaml**: 9개 User Story의 사용자 액션을 REST 엔드포인트로 매핑(진단/로드맵/문서/미션/알림/대학/기업/결제/선배). `servers`에 네트워크 표준값 반영.
- **quickstart.md**: 로컬 부트스트랩(인프라 기동, .env, 마이그레이션, 시드, 웹·모바일 실행) 및 P1 데모 시나리오.
- **Agent context update**: `.specify/scripts/bash/update-agent-context.sh claude` 실행.

**Post-Design Constitution 재평가**: 신규 모듈 추가는 단일 책임 경계를 유지하며 위반 없음.

## Complexity Tracking

> Constitution 위반 없음 — 해당 없음.
