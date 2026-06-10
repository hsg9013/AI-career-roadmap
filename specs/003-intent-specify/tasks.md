---
description: "Task list for AI 커리어 로드맵 플랫폼 — 실연동·안정화 (003-intent-specify)"
---

# Tasks: AI 커리어 로드맵 플랫폼 — 실연동·안정화 (003)

**Input**: Design documents from `/specs/003-intent-specify/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 본 명세는 TDD를 명시적으로 요청하지 않았다. 계약·통합 테스트(폴백·웹훅 멱등·k≥5·민감정보 배제)는 Polish 단계에 통합하고, 모바일 E2E 자동화는 plan.md에 따라 US7에서 도입한다.

**Organization**: User Story 단위로 그룹화. 003은 신규 기능이 아니라 **기존 stub의 실연동·안정화**이므로, 각 태스크는 "어떤 stub/미연동을 무엇으로 교체하는가"를 명시한다. 외부 키가 없어도 폴백으로 동작해야 한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 User Story (US1~US8)
- 모든 경로는 plan.md의 모노레포 구조 기준

## Path Conventions

- Backend: `backend/src/modules/<domain>/`, 서비스 `backend/src/services/`, 큐/워커 `backend/src/queues/`·`backend/src/workers/`, 마이그레이션 `backend/src/db/`
- 운영: `backend/ops/`, 인프라 `infra/`
- 프런트: 공유 `frontend-shared/`, 웹 `frontend-web/`, 모바일 `frontend-mobile/`, 타입 `shared/types/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 003 연동을 위한 환경·타입·의존성 정비

- [ ] T001 003 신규 의존성 추가: `@anthropic-ai/sdk`, `firebase-admin`, `apns2`(backend), 모바일 `@capacitor/push-notifications` 활성화 (`backend/package.json`, `frontend-mobile/package.json`)
- [X] T002 [P] `.env.example`에 003 키 추가 — `LLM_TIMEOUT_MS`/`LLM_MAX_TOKENS`/`AI_DAILY_TOKEN_BUDGET`, `WEB_BASE_URL`, `FEED_JOBPOSTING_URL`/`FEED_CERTIFICATION_URL`/`FEED_CONTEST_URL`/`FEED_STALE_AFTER_DAYS`/`FEED_COLLECT_INTERVAL_MS`, `VITE_NAVER_CLIENT_ID`. (기존 LLM/PORTONE/MAILER/FCM/APNS/OAUTH_NAVER 키는 이미 존재) — 실제 키 명은 `env.ts`와 일치(스펙의 ANTHROPIC_*/NAVER_OAUTH_* 가설명은 LLM_*/OAUTH_NAVER_* 로 구현)
- [X] T003 [P] 003 OpenAPI 델타 완성 + `shared/types` 생성 — `specs/003/contracts/openapi.yaml`에 누락 엔드포인트(notifications/devices·school-email confirm/status·ops/metrics) + OpsMetrics 스키마 추가, catalog 경로 파라미터를 실제(`industryCode`)에 정합. `shared/types` gen 파이프라인 배선(`gen:base`+`gen:003`)→ `openapi.d.ts`/`openapi-003.d.ts` 생성, `index.ts`가 `Api`/`Api003`/`Schemas003` 네임스페이스로 노출. build 통과
- [ ] T004 [P] 환경설정 스키마(`backend/src/config/env.ts`)에 003 키·기본값·"키 없으면 폴백" 플래그 추가

**Checkpoint**: 타입 생성·환경설정 통과, 키 미설정 시에도 부팅 가능.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 공통 토대 — 마이그레이션 베이스라인·AI 게이트웨이 골격·관측

⚠️ 이 단계 완료 전에는 어떤 User Story도 시작 불가.

- [X] T005 003 신규 테이블 마이그레이션 — **전부 적용**: `industry/job_role`(V017), `ai_inference_log`/`ai_budget_counter`(V021), `backup_run`/`monitor_alert`(V019), `user_notification_setting`(V020), `payment`확장/`settlement`/`payment_webhook_event`(V022), `notification_delivery`/`device_token`(V023), `social_identity`/`school_email_verification`(V024), `external_feed_item`/`feed_collection_run`(V025) 적용 완료 — **003 신규 테이블 전부 적용됨**
- [X] T006 AI 게이트웨이 골격: `backend/src/services/ai/claude.ts`(Anthropic Messages API·타임아웃·자격증명 가드) + `infer.ts`(runInference SSOT: 예산 가드·source/fallbackReason 분류·`ai_inference_log` 기록·`ai_budget_counter` 누적). 폴백 회귀 테스트 통과
- [ ] T007 [P] 폴백 관측 토대: 폴백률·연동 성공률 지표를 `backend/src/lib/analytics.ts`/`health.ts`에 카운터로 추가
- [ ] T008 [P] 결제 멱등 헬퍼: `pg_tx_id`/`pg_event_id` 기반 중복처리 가드 유틸 (`backend/src/services/payments.ts` 보조)
- [X] T008a [P] **[G1 보강]** 공유 프라이버시 가드 `backend/src/lib/privacy/index.ts`: (a) k-익명성 재노출(`satisfiesKAnonymity`/`cohortCount`), (b) `stripForbidden` — PII + 성별·나이·출신학교 등 민감속성 재귀 제거(FR-018/FR-019 SSOT). 5/5 테스트 통과

**Checkpoint**: 스키마·게이트웨이·관측·프라이버시 가드 토대 준비 완료 → User Story 병렬 착수 가능.

---

## Phase 3: US2 — 직무·산업 사전 확충 (Priority: P1) 🎯 외부 의존 없음·즉시 착수

**Goal**: 산업 10개·대표 직무 약 50개·직무별 핵심 역량 키워드를 회원가입 선택지·갭 진단 기준의 SSOT로 제공.

**Independent Test**: `/catalog/industries` 10개 반환, 각 산업 `/jobs`에 키워드 보유, 합계 ~50직무. 확충 직무 선택 시 해당 키워드로 진단.

- [X] T009 [US2] `catalog` 모듈·서비스 생성 (`backend/src/modules/catalog/{router,handlers}.ts`, `backend/src/services/catalog.ts`)
- [X] T010 [US2] 카탈로그 스키마 마이그레이션 `V017__init_catalog.sql` (`industries`,`job_roles`) — 기존 5직무 코드(IT/backend·frontend·data·ml, FIN/quant) 정합 유지
- [X] T011 [P] [US2] 시드: 산업 10개·직무 50개(`V017`) + 직무 요구역량 사전 5→50 확충(`V018__seed_job_requirements_expand.sql`) — jobs_without_keywords=0 검증
- [X] T012 [US2] 조회 API: `GET /v1/catalog/industries`(공개), `GET /v1/catalog/industries/{industryCode}/jobs`(키워드 포함) + app.ts 등록
- [X] T013 [US2] 갭 진단 기준 사전 연동 — `gapDiagnosis.ts`가 이미 `job_requirements.keywords_json` 사용, 사전 50직무 확충으로 전 직무 진단 적용(테스트 7/7 통과)
- [X] T014 [P] [US2] 웹 회원가입(온보딩) 산업·직무 선택지를 사전 API 연동으로 교체 — `frontend-shared/src/components/TargetJobPicker.vue`의 하드코딩 CATALOG(IT4·FIN1) 제거, `/catalog/industries`·`/catalog/industries/{code}/jobs` 동적 로드(vue-tsc 통과)

**Checkpoint**: US2 단독으로 회원가입 선택지·진단 기준 확충 시연 가능.

---

## Phase 4: US1 — 추천·문서·미션 피드백 실제 AI 연동 (Priority: P1)

**Goal**: 규칙 기반 stub을 Claude 실연동으로 교체, 실패·타임아웃·예산초과 시 100% 규칙 기반 폴백. (진단 기준은 US2 사전에 의존)

**Independent Test**: 키 없이 호출 시 `source=fallback_rule`, 키 설정 시 `source=ai`로 정상 응답. 사용자에게 빈 결과·오류 0.

- [X] T015 [US1] AI 클라이언트 구현: `backend/src/services/ai/claude.ts` (Anthropic Messages API fetch 호출·타임아웃·자격증명 가드, SDK 의존 없음)
- [X] T016 [US1] 추천 게이트웨이 stub→AI 교체 + 폴백 라우팅 (`backend/src/services/recommendation/gateway.ts` `callExternalLlm` 실연동, 파싱 실패·빈응답·타임아웃→룰 폴백)
- [X] T017 [P] [US1] 로드맵 추천 LLM 연동 — `roadmap.ts` `generateRoadmap` 가 runInference(feature=roadmap)로 AI 코칭 요약 생성(트랜잭션 밖 호출), 실패·무키·예산초과 시 규칙 요약 폴백. `ai_source`/`ai_summary` 노출, 조회 경로는 규칙 요약(읽기 시 비용 회피)
- [X] T018 [P] [US1] 문서(자기소개서) 생성 LLM 연동 — `documents.ts` `generateDocument` coverletter 경로가 runInference(feature=document)로 초안 생성, 실패 시 `buildContent` 폴백. 문서는 학생 본인 산출물 → 익명화 안 함. `ai_source` 노출
- [X] T019 [P] [US1] 미션 AI 1차 피드백 — `missions.ts` `aiFeedback` 가 runInference(feature=mission_feedback) 실연동(트랜잭션 밖), 실패 시 `ruleFeedback` 폴백. 현직자 코멘트는 기존 feedbacks(kind=ai/mentor) 결합 유지
- [X] T020 [US1] 진단 AI 경로 — `gateway.ts` `callExternalLlm` 가 runInference(feature=diagnosis) 경유, 파싱 실패/부분응답·무키·타임아웃·예산초과 시 `ruleBasedInsight` 폴백
- [X] T021 [US1] `source`/`fallbackReason` 노출 + `ai_inference_log` 기록 일관 적용 — runInference SSOT 가 호출 1건당 1행 기록(source∈{ai,fallback_rule}, reason∈{none,error,timeout,budget,no_credentials}). GapInsight·Roadmap·Document 응답에 source 노출
- [X] T022 [P] [US1] 웹 결과 화면 폴백 자연 표시 — `GapDiagnosisChart.vue`(insight를 'AI 분석'/'기본 분석' 배지로), `Roadmap.vue`(`ai_summary`+AI코칭/코칭요약 배지, '폴백'→'직무 요구역량 기반'), `Documents.vue`(생성 경로 안내). 공유 스토어 타입에 `ai_source`/`ai_summary`/`fallback_reason` 추가. 폴백은 오류가 아닌 정상 콘텐츠로 표시(SC-006). vue-tsc 통과
- [X] T021a [US1] **[G1 보강]** AI 경로 불변식 강제: `gateway.ts`의 `anonymize`가 공유 가드 `stripForbidden`에 위임 → LLM 입력에서 성별·나이·출신학교 누출 없음. 회귀 테스트(anonymize 경로 포함) 통과

**Checkpoint**: US1+US2로 "데이터 기반 맞춤 AI 분석" 핵심 가치 시연 가능 (= 권장 MVP 범위).

---

## Phase 5: US3 — 결제·정산 실연동 (Priority: P2)

**Goal**: PortOne 실결제(승인/취소/환불)·웹훅 멱등 + 멘토·선배 정산 적립.

**Independent Test**: 테스트 결제 승인→멤버십 활성화·영수증, 웹훅 2회 수신 시 1회만 반영, 환불 시 상태 일관.

- [X] T023 [US3] 결제 시작 API `POST /payments/checkout` — pending 결제 생성 + PortOne 세션(`services/payments/portone.ts`). 키 없는 dev 는 즉시 승인(merchant uid=pg_tx_id), 키 설정 시 pending+redirect 반환(웹훅 확정). 마이그레이션 `V022`(payments 확장·settlement·payment_webhook_event, 멱등 작성)
- [X] T024 [US3] 웹훅 `POST /payments/webhook`(requireAuth 앞 배치, raw body HMAC 검증·무키 dev 우회) + `payment_webhook_event` `pg_event_id` 멱등(중복=duplicate). 테스트: 환불 처리·재수신 무시·미상 결제 ignored
- [X] T025 [US3] 상태기계(pending→paid→canceled/refunded, pending→failed) `canTransition` 강제 + paid 시 멤버십 활성/refund·cancel 시 종료(auto_renew off). 단위 테스트 통과
- [X] T026 [P] [US3] 멘토·선배 정산 적립 — `computeMonthlyPayouts` 가 멘토 정산을 `settlement`(basis fixed/commission, source_ref=`mentor_feedback:{period}`)에 적립, **선배는 `donatePath` 가 데이터 기부 시 `settlement`(basis fixed, source_ref=`alumni_donation:{pathId}`)에 적립**(`uq_settlement_source` 멱등). mentor_payouts·alumni_rewards 병행 유지
- [X] T027 [US3] `reconcilePayments` — paid 멤버십결제인데 활성 멤버십 없음 감지 → 자동 정정, 정정 불가는 `raiseAlert('payments','critical')` 운영 검수. 워커 주기 점검(300s)
- [X] T028 [US3] 결제 상태 조회 `GET /payments/{id}`(상태·영수증·멤버십 만료) + 웹 결제·영수증 UI — `Membership.vue`가 상태 라벨·거래번호·영수증 링크 표시, pending+redirect_url 시 결제창 이동·'상태 새로고침'. payments 스토어에 `checkout`결과 타입·`fetchPayment` 추가. vue-tsc 통과

**Checkpoint**: 실결제·정산 흐름 단독 시연 가능(백엔드 완료, 웹 UI 잔여). 테스트 7건(상태기계·승인·조회·환불·멱등·미상) 통과.

---

## Phase 6: US8 — 운영 안정성 확보 (Priority: P2, 전 과정 병행)

**Goal**: 일일 백업·24h 복구·단일 DB SPOF 보완(standby)·모니터링·경보 → 월 99.5%.

**Independent Test**: 일일 백업 success, 복구 리허설 24h 내 완료, 장애 시 운영자 경보, `/ops/health`에 상태·`lastBackupAt` 노출.

- [X] T029 [US8] 일일 백업 러너 `backend/ops/backup/backup.ts` (mysqldump→`backup_run` 기록, 실패 시 critical 경보) + `pnpm backup:run`. 실백업 130K 생성·success 기록 검증
- [X] T030 [US8] 복구 런북 `backend/ops/restore/RUNBOOK.md` (24h 복구 절차·정기 리허설)
- [~] T031 [P] [US8] MariaDB standby(복제) — `infra/docker/mariadb/STANDBY.md`에 primary binlog·복제·페일오버 절차 문서화. **실제 복제 노드 프로비저닝은 운영 환경 작업으로 분리(미완)**
- [X] T032 [P] [US8] 모니터링·경보: `lib/ops.ts` `evaluateOpsHealth`(db/redis down→`monitor_alert` critical, 복구 시 해소) + 워커 주기 점검(60s)
- [X] T033 [US8] `GET /v1/ops/health` (`modules/ops/`, 상태·components·lastBackupAt, db down 시 503) + app.ts 등록. 계약 테스트 통과
- [X] T033a [P] **[G2 보강]** 사업 KPI 계측 — `lib/analytics.ts` 이벤트 taxonomy + `eventCounts()` 집계. **실제 발화 배선 완료**: signup(회원가입·소셜 신규)·revisit(로그인·소셜 재로그인)·first_diagnosis(최초 진단)·roadmap_generated(로드맵 생성)·recommendation_rejected(거부)·roadmap_item_completed(완료, 신규 `POST /roadmap/items/{id}/complete`)·document_generated·portfolio_used·mission_submitted·payment_converted·membership_canceled (SC-001~009 매핑) → T053 대시보드 입력

**Checkpoint**: 가용성·백업·복구·관측·KPI 계측 체계 가동(결제·AI 실연동 보호).

---

## Phase 7: US4 — 알림 3채널 완성 (Priority: P3)

**Goal**: 앱 내 알림 + FCM/APNs 푸시 + Naver 메일, 채널별 설정 반영.

**Independent Test**: 동일 이벤트가 3채널 도착, email off 시 email `skipped`·in_app `sent`.

- [X] T034 [US4] 발송 어댑터 — `services/notifications/push.ts`(FCM HTTP 발송 + APNs 구조, 무키 dev 시뮬레이션 성공, `device_token` 조회) + Naver Mail 은 기존 `lib/mailer` 재사용. 마이그레이션 `V023`(notification_delivery·device_token). 디바이스 토큰 등록 `POST /notifications/devices`(T034b)
- [X] T035 [US4] 이벤트→채널 라우터 `dispatchNotification` — in_app 항상 sent(FR-008), push/email 설정 on 일 때만 발송(off→skipped, FR-009). `notification_delivery`(notification×channel UNIQUE 멱등) 상태 기록, 실패 시 `notification` 큐 재시도 잡(attempts 3·exponential) → 워커 `processNotificationDelivery`. progress-check 스윕도 라우터로 전환
- [X] T036 [P] [US4] 채널 설정 API `GET/PUT /notifications/settings` + `user_notification_setting`(V020, in_app 항상 on) — `services/notifications.ts` getNotificationSettings/putNotificationSettings/isChannelEnabled, 라우터·핸들러 배선 완료
- [X] T037 [P] [US4] 웹 알림 설정 UI — `Notifications.vue`에 채널 토글 패널(in_app 항상 on·disabled, push/email 스위치 → `PUT /notifications/settings`). 공유 스토어에 `fetchSettings`/`updateSettings`/`registerDevice` 추가. vue-tsc 통과. (모바일 `frontend-mobile/` 설정 화면은 US7에서 통합)

**Checkpoint**: 3채널 발송·설정 반영 시연 가능(백엔드 완료, UI 잔여). 테스트 5건(전채널 sent·email off skip·in_app 항상 sent·목록·디바이스 등록) 통과.

---

## Phase 8: US5 — 외부 데이터 수집 파이프라인 (Priority: P3)

**Goal**: 공식 오픈API·제휴 피드만 일 단위 수집(크롤링 금지), 신선도 표시.

**Independent Test**: 수집 잡 실행 시 데이터 갱신, 기준 기간 초과 항목 'stale', 수집 실패 시 기존 데이터 유지·경보.

- [X] T038 [US5] 수집 커넥터 — `services/feeds/collectors.ts`: 소스별 어댑터(gov-worknet 채용·q-net 자격증·partner-contest 공모전). 피드 URL(env) 설정 시 JSON fetch+정규화, 미설정 dev 는 결정적 샘플(크롤링 없음, FR-010)
- [X] T039 [US5] 일일 수집 + 실패 시 기존 유지 — `services/feeds/index.ts` `collectSource`/`collectAllFeeds`: `feed_collection_run`(running→success/failed·item_count·error) 기록, 실패 시 `external_feed_item` 삭제/변경 없음(기존 유지). 워커 일 단위 타이머(`FEED_COLLECT_INTERVAL_MS` 기본 24h) + `external-fetch` 큐 `collect-feeds` 핸들러
- [X] T040 [US5] 신선도 + upsert — `external_feed_item`(V025) UNIQUE(source, external_id) upsert(재수집 멱등·fresh 되살림), `refreshFeedFreshness`가 `FEED_STALE_AFTER_DAYS`(기본 14일) 초과분을 stale 로 표시(FR-011)
- [X] T041 [US5] 조회 API `GET /v1/feeds/items`(kind/source/freshness 필터, `modules/feeds/`) + 웹 `Feeds.vue`(kind 탭, '최신 아님' 배지)·라우트·`useFeedsStore`. vue-tsc 통과

**Checkpoint**: 외부 정보 자동 갱신·신선도 시연 가능. 백엔드 테스트 5건(수집 upsert·재수집 멱등·실패 시 유지·stale 계산·전체 수집) 통과.

---

## Phase 9: US6 — 소셜 로그인·학교 이메일 검증 (Priority: P3)

**Goal**: 네이버 OAuth 로그인·연결, `.ac.kr` 학교 이메일 검증(비-`.ac.kr` 거부).

**Independent Test**: 네이버 코드로 로그인/연결, `.ac.kr` 인증 메일 발송·확인, 비-`.ac.kr` 422.

- [X] T042 [US6] 네이버 OAuth `POST /auth/social/naver` (`modules/auth/social.ts`) — code→token→profile 실 호출(키 설정 시)·dev 무키 결정적 합성 프로필. 연결 규칙: provider_uid→이메일 일치→신규 생성. `social_identity`(V024), 세션은 `issueSession` 공유. created 시 201
- [X] T043 [US6] 학교 이메일 검증 (`modules/auth/schoolEmail.ts`) — `POST /auth/school-email/verify`(.ac.kr 검사, 비-.ac.kr 422+rejected 기록, 토큰 메일, pending) + `POST /auth/school-email/confirm`(토큰→verified + `students.school_email_verified=1`) + `GET /auth/school-email/status`. `school_email_verification`(V024)
- [X] T044 [US6] 웹 네이버 로그인 버튼·학교 인증 UI — `Login.vue` 네이버 버튼(실연동 리다이렉트/dev 합성 code + ?code= 콜백 처리), `SchoolEmailVerify.vue`·`SchoolEmailConfirm.vue` 페이지+라우트, auth 스토어 `loginWithNaver`/`requestSchoolEmail`/`confirmSchoolEmail`/`schoolEmailStatus`. vue-tsc 통과. (모바일은 US7 통합)

**Checkpoint**: 소셜 로그인·학교 검증 시연 가능(기존 이메일 로그인 유지). 백엔드 테스트 6건(.ac.kr 판별·네이버 생성/연결·확인·비-.ac.kr 422·무인증 401) 통과.

---

## Phase 10: US7 — 모바일 앱 스토어 배포 (Priority: P4)

**Goal**: 동일 Capacitor 빌드를 iOS·Android 스토어 배포, 푸시 실연동.

**Independent Test**: 스토어 빌드 설치·로그인→진단→로드맵→미션 동작 + 푸시 수신.

- [ ] T045 [US7] 모바일 푸시 실연동(@capacitor/push-notifications) + 토큰 등록 API 연동 (`frontend-mobile/`)
- [ ] T046 [US7] iOS·Android 스토어 배포 구성(서명·메타데이터·fastlane 등) (`frontend-mobile/`)
- [ ] T047 [P] [US7] 모바일 E2E(Detox/Maestro)로 핵심 흐름 회귀 (`frontend-mobile/`)
- [ ] T048 [US7] 스토어 심사 제출·반려 대응(웹 운영 무영향 확인)

**Checkpoint**: "웹+모바일 동시 제공" 완성.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: 계약/통합 테스트·프라이버시 불변식·성능·문서

- [X] T049 [P] 계약 테스트: 003 델타 엔드포인트 — `contract.test.ts` 15→29건(catalog·ops/health·ops/metrics·feeds/items·payments/webhook·payments/:id·notifications/settings·devices·auth/social/naver·school-email verify/confirm/status). 마운트·인증 게이트 검증
- [X] T050 [P] 통합 테스트: AI 폴백 경로(무키 `no_credentials`)·결제 웹훅 멱등 — `services/ai/infer.test.ts`(폴백+로그), `services/metrics.test.ts`(폴백→`ai_inference_log`→fallbackRate 집계), `modules/payments/payments.test.ts`(웹훅 재수신=duplicate·환불 전이). 타임아웃/예산초과는 `runInference` 가드로 구현(env 게이트)
- [X] T051 [P] 프라이버시 불변식 — `security.audit.test.ts`에 AI 입력 anonymize 의 민감 인구통계(성별·나이·출신학교) 배제 추가(FR-019). k≥5 미달→일반 가이드 폴백은 `roadmap.test.ts`(cohort/fallback)·`lib/privacy/privacy.test.ts`(satisfiesKAnonymity)로 회귀
- [X] T052 [P] 성능 점검 — 운영 p95 목표(로드맵<2s·조회<200ms·푸시<5s) `quickstart.md §5.1` 문서화 + `perf.smoke.test.ts` 조회 응답성 회귀 스모크(catalog median 실측 ~2ms, 관대 상한으로 flaky 방지)
- [X] T053 [P] 관측 대시보드 — `GET /v1/ops/metrics`(관리자 전용, `services/metrics.ts`): AI 폴백률·byReason·결제/발송/수집 성공률·미해결 critical 경보·`lastBackupAt` + `T033a` 사업 KPI(`eventCounts`) 집계
- [X] T054 [P] 문서 갱신 — `quickstart.md` env 키를 실제 구현 키로 정정(LLM_*·OAUTH_NAVER_*·FEED_*_URL), V017~V025 마이그레이션·테스트 목록·성능 목표·관측 메트릭 섹션 추가

---

## Dependencies (스토리 완료 순서)

- **Setup(P1) → Foundational(P2)** 가 모든 스토리의 선행.
- **US2(P1)** 는 외부 의존이 없어 가장 먼저. **US1(P1)** 의 진단 기준은 US2 사전에 의존 → US2 → US1 순.
- **US3(P2)**, **US8(P2 병행)** 은 US1/US2와 독립이나 P1 가치 확보 후 착수 권장. US8은 전 과정 병행.
- **US4·US5·US6(P3)** 는 상호 독립, US1~US3 이후.
- **US7(P4)** 는 푸시(US4)·핵심 흐름 안정화 후 마지막.
- **Polish(Phase 11)** 는 각 스토리 완료분에 대해 점진 적용, 최종 일괄 검증.

## Parallel Execution Examples

- Foundational: T007, T008, T008a 병렬 (T005·T006 이후).
- US2: T011(시드), T014(웹) 병렬.
- US1: T017·T018·T019(서로 다른 모듈) 병렬, T015→T016 선행.
- US8: T031·T032 병렬.
- Polish: T049~T054 대부분 병렬.

## Implementation Strategy (MVP first)

1. **MVP = US2 + US1** (Phase 1~4): 직무·산업 사전 확충 + 추천·문서·미션 AI 실연동(폴백 포함). 이 두 P1 스토리만으로 핵심 가치("데이터 기반 맞춤 AI")를 단독 시연 가능.
2. 이후 **US3 결제 + US8 안정성**(P2)로 수익·신뢰 확보, **US4·US5·US6**(P3) 확장, **US7**(P4) 모바일 출시로 마감.
3. 모든 단계에서 외부 연동은 키·비용·실패 대체 동작을 확인하며 하나씩 활성화(점진 활성화 원칙).

---

**총 57개 태스크** · Setup 4 · Foundational 5(+T008a) · US1 9(+T021a) · US2 6 · US3 6 · US4 4 · US5 4 · US6 3 · US7 4 · US8 6(+T033a) · Polish 6

> **G1/G2 보강(analyze 후속)**: T008a·T021a = FR-018/FR-019 불변식을 테스트뿐 아니라 공유 가드 추출 + AI 경로 강제 통과로 구현 측면 보장. T033a = 사업 KPI(SC-002/003/004/008/009) 측정 이벤트 계측 → T053 대시보드 연결.
