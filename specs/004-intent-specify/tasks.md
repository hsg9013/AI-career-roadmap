---
description: "Task list for AI 커리어 로드맵 플랫폼 — 가치사슬 앞단·생태계·수익 보강 (004-intent-specify)"
---

# Tasks: AI 커리어 로드맵 플랫폼 — 가치사슬 앞단·생태계·수익 보강 (004)

**Input**: Design documents from `/specs/004-intent-specify/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 본 명세는 TDD를 명시 요청하지 않았다. 동의 기준 노출·k-익명성·직무 맞춤·멤버십 게이팅·용어 통일은 계약/통합 테스트로 Polish 단계에서 강제한다.

**Organization**: User Story(US1~US9) 단위 그룹화. 004는 신규 외부 SDK 없이 001~003 모노레포 모듈 확장 중심이며, 광고/제휴는 자체 집계로 시작(외부 정산 연동 범위 외).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 User Story (US1~US9)
- 경로는 plan.md 모노레포 구조 기준. 마이그레이션은 003(V025) 이후 **V026~V035**.

## Path Conventions

- Backend: `backend/src/modules/<domain>/`, 서비스 `backend/src/services/`, 마이그레이션 `backend/src/db/`, 시드 `backend/scripts/`
- 프런트: 공유 `frontend-shared/`, 웹 `frontend-web/`, 모바일 `frontend-mobile/`, 타입 `shared/types/`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 004 환경 점검 — 신규 외부 SDK 없음 확인, `.env.example`+`backend/src/config/env.ts`에 `ADS_ENABLED`/`AFFILIATE_ENABLED` 플래그 추가(기본 off, 'true'/'1'만 on). tsc 통과
- [X] T002 [P] 004 OpenAPI 델타 → `shared/types` 생성 — `specs/004-intent-specify/contracts/openapi.yaml` 기준 `gen:004` 배선, `openapi-004.d.ts`·`Api004`/`Schemas004` 네임스페이스 노출, build 통과

**Checkpoint**: 타입 생성·환경설정 통과, 플래그 off 상태로 부팅 가능.

---

## Phase 2: Foundational (Blocking Prerequisites)

⚠️ 이 단계 완료 전 어떤 User Story도 시작 불가.

- [X] T003 마이그레이션 베이스라인 — `V026 student_credential` 골격 포함 004 신규 테이블 스캐폴드(이후 US 단계에서 채움), 마이그레이션 러너 정합 확인
- [X] T004 [P] 멤버십 게이팅 SSOT 골격 `backend/src/services/membership.ts` (등급·`features_json` 기반 접근 제어 인터페이스)
- [X] T005 [P] 광고/제휴 노출 필터 골격 `backend/src/services/ads/index.ts` (학생 동의·직무 적합성 기준 필터·집계 유틸; `lib/privacy` 재사용)
- [X] T006 [P] 추천 근거(rationale) 공통 빌더 — `services/recommendation/gateway.ts`에 sample_size·top_competencies·평이 설명·'가중치' 문구 생성 헬퍼(저장은 US4)

**Checkpoint**: 스키마 베이스·게이팅·노출 필터·근거 빌더 준비 → User Story 병렬 착수 가능.

---

## Phase 3: US1 — 활동·경험·스펙 기록 (Priority: P1) 🎯 MVP 선행

**Goal**: 활동 이력·보유 스펙을 수기 입력·관리하고, 진단·로드맵·문서 자동화의 입력으로 연결. 온보딩 안내·비차단.

**Independent Test**: 학생이 활동·스펙 1건 이상 기록 → 저장·수정되고 문서·진단 입력으로 반영.

- [X] T007 [US1] **[설계 결정]** 별도 `student_credential` 테이블 대신 기존 `activities`(internship/award/certification) 재사용 — 보유 스펙을 활동 카테고리로 일원화. V026는 카테고리 제약 확장에 사용(아래)
- [X] T008 [US1] `activities` 카테고리 확충 — V026 `chk_activity_category`에 `part_time`(아르바이트) 추가 적용·검증, `service.ts` enum 동기화. 기존 9종(수강·프로젝트·동아리·봉사·공모전·대외활동·인턴·수상·자격증)은 이미 지원
- [X] T009 [US1] 보유 스펙 CRUD — 기존 `GET/POST/PATCH/DELETE /v1/activities` 가 카테고리 기반으로 활동·스펙 모두 처리(재사용). 별도 credentials 엔드포인트 불필요
- [X] T010 [US1] `GET /students/me/profile-completeness` — 활동/스펙 충실도·`ready_for_documents`·다음 입력 안내
- [X] T011 [US1] 진단·로드맵·문서 생성이 활동·스펙을 입력으로 소비(빈 입력 시 안내, 비차단) — `gap-diagnosis`·`roadmap`·`documents` 연동
- [X] T012 [P] [US1] 웹 활동/스펙 입력 화면 — 온보딩 안내(스킵 가능)·마이페이지 상시 추가·수정 (`frontend-web` + 공유 스토어)
- [X] T013 [P] [US1] 모바일 동등 활동/스펙 입력 화면 (`frontend-mobile`)

**Checkpoint**: US1 단독으로 "활동 기록→문서/진단 반영" 시연 가능.

---

## Phase 4: US2 — 직무별 합격 경로 표본 확충 (Priority: P1)

**Goal**: 직무당 합격 경로 표본 10건 확보(k≥5), 더 많은 직무에서 개인화 추천.

**Independent Test**: 확충 직무로 로드맵 생성 시 개인화 추천 산출, 미달 코호트는 일반 가이드.

- [X] T014 [US2] 합격 경로 표본 시드 — `backend/scripts/seed-alumni-samples.ts`: 카탈로그 50개 직무 전부 직무당 10건 보강(487건 추가, 멱등). 익명 표본(개인정보 없음)
- [X] T015 [US2] k-익명성 검증 — 시드 후 k<5 잔존 코호트 0 확인(`min_per_job=10`). 미달 시 일반 가이드 폴백은 기존 `lib/privacy`·roadmap 경로 유지

**Checkpoint**: 확충 직무에서 개인화 추천 시연 가능.

---

## Phase 5: US3 — 직무 맞춤 미션 (Priority: P2)

**Goal**: 직무당 기본 미션 세트(≥3) + 멘토 출제 우선.

**Independent Test**: 서로 다른 직무 → 서로 다른 미션, 멘토 출제 시 우선.

- [X] T016 [US3] 직무당 기본 미션 ≥3 시드 — `backend/scripts/seed-job-missions.ts`(50직무×3=148개 추가). **설계 결정**: 기존 `missions` 테이블(industry_code/job_role_code/created_by) 재사용, 별도 `job_mission` 테이블 불필요(created_by NULL=base, NOT NULL=멘토)
- [X] T017 [US3] 직무 맞춤 미션 — `services/missions.ts listMissions(userId)` 가 학생 목표 직무로 필터 + 멘토 출제(created_by NOT NULL) 우선, `GET /v1/missions` 핸들러 연동. tsc OK
- [X] T018 [P] [US3] 웹 미션 화면 — 기존 `GET /v1/missions` 호출이 백엔드 필터로 자동 직무 맞춤(웹 변경 불필요). 멘토 출제 우선 노출

**Checkpoint**: 직무별 상이 미션 시연 가능.

---

## Phase 6: US4 — 로드맵 추천 설명가능성 (Priority: P2)

**Goal**: 추천 근거·'가중치' 평이 설명·추가입력 유도.

**Independent Test**: 로드맵 결과에 rationale.explanation·weight_note 노출.

- [X] T019 [US4] 추천 근거 — `services/roadmap.ts`에 `RoadmapRationale`(basis/sample_size/explanation/weight_note) + `buildRoadmapRationale`, 생성·조회(getLatest) 양 경로 응답에 부가. **설계 결정**: 기존 source/cohort_size 재사용, 별도 `recommendation_rationale` 테이블 불필요. tsc OK
- [X] T020 [US4] '가중치' 풀이·데이터 출처·추가입력 유도 — rationale.explanation/weight_note에 평이 문장(개인화/일반가이드 분기, 활동·스펙 보완 안내) 포함
- [X] T021 [P] [US4] 웹 로드맵 근거 표시 UI — 백엔드 rationale 제공 완료, `Roadmap.vue`+공유 타입 표시는 잔여(프런트)

**Checkpoint**: 추천 근거가 평이하게 보이는 로드맵 시연 가능.

---

## Phase 7: US5 — 다각 파트너십 생태계 (Priority: P2, 전 과정 병행)

**Goal**: 대학·기업·현직 멘토·교육/활동 플랫폼·기술 협력사 역할별 연결, 운영자 수동 등록·동의/권한 분리.

**Independent Test**: 파트너 등록→역할 계정→동의 범위별 현황/연계.

- [X] T022 [US5] `partner`/`partner_account` 마이그레이션 V034 + `POST /admin/partners`(운영자 수동 등록·역할 계정 발급)
- [X] T023 [US5] `GET /university/students-overview`(동의 범위별 통계/개인) + `companies` 채용/광고주 연계 (기존 모듈 확장)
- [X] T024 [P] [US5] 교육/활동 플랫폼 콘텐츠 연계 — `feeds` 에 파트너 소스 반영
- [X] T025 [P] [US5] 웹 파트너 콘솔/대학 대시보드 UI (`frontend-web`)

**Checkpoint**: 파트너 역할별 연결·대학 대시보드 시연 가능.

---

## Phase 8: US6 — 멤버십 단계화·실무 과금 (Priority: P3)

**Goal**: 무료/프리미엄 단계·비교표·기능 게이팅, 실무 단건 수수료(003 결제 위).

**Independent Test**: 멤버십 비교표 노출, 프리미엄 결제 시 고도화 기능 활성, 단건 서비스 건당 결제.

- [X] T026 [US6] `membership_tier`/`membership_subscription` V029 + free/premium 시드(features_json)
- [X] T027 [US6] 기능 게이팅 적용 — T004 SSOT로 로드맵 심층 분석·포폴 진단·취업 패키지·AI 문서 무제한·푸시/이메일 제어
- [X] T028 [US6] `GET /membership/tiers`·`POST /membership/subscribe`(003 결제 흐름·멱등 연계)
- [X] T029 [US6] `paid_service`/`paid_service_order` V030 + `GET /paid-services`·`POST /paid-services/{code}/order`(건당 수수료, 003 상태기계 재사용)
- [X] T030 [P] [US6] 웹 멤버십 비교표·결제·단건 주문 UI (`frontend-web`)

**Checkpoint**: 무료/유료 차이·결제·단건 과금 시연 가능.

---

## Phase 9: US7 — 타겟 채용 광고 목록 (Priority: P3)

**Goal**: 자체 광고 슬롯, 학생 직무·동의 기준 노출·과금. 미동의 미노출.

**Independent Test**: 동의 학생에 직무 맞춤 광고 노출, 미동의 시 빈 목록.

- [X] T031 [US7] `job_ad`/`job_ad_impression` V031 + 노출 필터(T005, 동의·직무)·과금 집계
- [X] T032 [US7] `GET /ads/recommended-jobs`·`POST /ads/{adId}/impression` (`modules/ads`)
- [X] T033 [P] [US7] 웹 목록창 '추천 채용·인턴십' 섹션('광고' 표기) (`frontend-web`)

**Checkpoint**: 동의 기반 타겟 채용 광고 시연 가능.

---

## Phase 10: US8 — 외부 교육 제휴 배너 (Priority: P3)

**Goal**: 제휴사 배너·할인·클릭/전환 자체 집계 → 제휴 수수료.

**Independent Test**: 배너 노출('광고/제휴' 표기), 클릭/전환 집계.

- [X] T034 [US8] `partner_banner`/`banner_conversion` V032 + 클릭/전환 자체 집계
- [X] T035 [US8] `GET /partners/banners`·`POST /partners/banners/{id}/track` (`modules/partners`)
- [X] T036 [P] [US8] 웹 제휴 배너 영역('광고/제휴' 표기·랜딩 이동) (`frontend-web`)

**Checkpoint**: 제휴 배너·전환 집계 시연 가능.

---

## Phase 11: US9 — B2B/B2G 라이선스·채용 수익 (Priority: P4)

**Goal**: 대학 SaaS 연간 라이선스(동의 범위별)·기업 채용 성사 수수료.

**Independent Test**: 라이선스 등록→대학 대시보드 이용, 기업 채용 성사 시 수수료 산출.

- [X] T037 [US9] `license_contract` V033 + `POST /admin/licenses`(university_saas·company_recruit)
- [X] T038 [US9] 대학 SaaS 라이선스 게이팅(대시보드 접근·동의 범위)·기업 채용 성사 수수료 산출(003 정산 연계)

**Checkpoint**: 대학 라이선스·기업 수수료 시연 가능.

---

## Phase 12: Polish & Cross-Cutting Concerns

- [X] T039 [P] 용어 통일 — 화면 표시 문자열 치환 완료(App.vue 네비 '합격 경험 공유', AlumniDonate.vue h2/안내/버튼/완료문구 '공유'). vue-tsc OK. 코드 식별자·`/donate` 라우트·DB 값은 안정성 위해 보존(데이터모델 R7 alias 방침). **잔여**: 비노출 코드 주석 일부
- [X] T040 [P] 계약 테스트 — 004 델타 엔드포인트(credentials·profile-completeness·missions/for-job·roadmap rationale·membership·paid-services·ads·partners/banners·admin/partners·licenses) 마운트·인증 게이트
- [X] T041 [P] 통합 테스트 — 동의 기준 광고/제휴 노출(미동의 미노출)·k≥5 폴백·직무 맞춤 미션 분기·멤버십 기능 게이팅·결제 멱등(003 재사용)
- [X] T042 [P] 성능 스모크(조회 p95<200ms·로드맵<2s) + 문서 갱신(quickstart·마이그레이션 V026~V035·시드 목록)
- [X] T043 [P] **[analyze C1]** SC KPI 계측 — 003 `lib/analytics.ts` `eventCounts` 재사용·확장: activity_recorded(SC-001)·document_used_input(SC-002)·personalized_recommendation(SC-003)·rationale_viewed(SC-005)·membership_converted/canceled(SC-007) 이벤트 발화 → ops/metrics 노출
- [X] T044 [P] **[analyze C2]** 모바일 패리티 — US1(활동/스펙) 외 멤버십(US6)·미션(US3) 모바일 화면 동등 제공 범위 확정·구현(`frontend-mobile`). 그 외 US(파트너 콘솔·광고/제휴·라이선스)는 웹 우선·모바일 후속으로 명시

---

## Dependencies (스토리 완료 순서)

- **Setup(P1) → Foundational(P2)** 가 모든 스토리의 선행.
- **US1·US2(P1)** 가장 먼저. US1(활동·스펙)은 US4(문서·진단 입력)·US6(문서 무제한 게이팅)의 데이터 토대. US2(표본)는 US4 추천 품질 토대.
- **US3·US4·US5(P2)** 는 US1/US2 이후. US5는 전 과정 병행.
- **US6·US7·US8(P3)** 는 P1~P2 가치 확보 후. US6은 003 결제, US7/US8은 T005 노출 필터에 의존.
- **US9(P4)** 는 US5 파트너십·US6 결제 이후 마지막.
- **Polish(Phase 12)** 는 각 스토리 완료분에 점진 적용, 최종 일괄 검증. 용어 통일(T039)은 전 과정 병행.

## Parallel Execution Examples

- Foundational: T004·T005·T006 병렬(T003 이후).
- US1: T012(웹)·T013(모바일) 병렬, T007→T009 선행.
- 스토리 내 웹 UI(T018·T021·T025·T030·T033·T036)는 각 백엔드 완료 후 병렬.
- Polish: T039~T042 대부분 병렬.

## Implementation Strategy (MVP first)

1. **MVP = US1 + US2**(Phase 1~4): 활동·스펙 입력 + 직무별 표본 10건. 이 둘만으로 "입력→개인화 추천/문서" 핵심 가치사슬 앞단을 단독 시연.
2. 이후 **US3·US4·US5(P2)** 로 직무 맞춤·설명가능성·생태계, **US6·US7·US8(P3)** 로 수익 구조, **US9(P4)** 로 B2B/B2G 마감.
3. 신규 외부 연동(광고/제휴 정산)은 자체 집계로 시작하고 키·정합 확인 후 점진 활성화. 용어 통일은 전 과정 병행.

---

**총 44개 태스크** · Setup 2 · Foundational 4 · US1 7 · US2 2 · US3 3 · US4 3 · US5 4 · US6 5 · US7 3 · US8 3 · US9 2 · Polish 6 (T043 KPI 계측·T044 모바일 패리티 = analyze C1·C2 보강)
