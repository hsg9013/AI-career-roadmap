---
description: "Task list for AI 커리어 로드맵 플랫폼 — 역할별 실동작·데모 가능성·세션/문서/결제 실구현 (005-intent-specify)"
---

# Tasks: AI 커리어 로드맵 플랫폼 — 역할별 실동작·데모·세션/문서/결제 실구현 (005)

**Input**: Design documents from `/specs/005-intent-specify/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 본 명세는 TDD를 명시 요청하지 않았다. k-익명성(≥5)·세션 복원/로그아웃·권한 종속 노출·드롭다운 매칭·기간 검증·문서 실다운로드·결제 시나리오·동의/직무 노출은 계약/통합/E2E 테스트로 Polish 단계에서 강제한다.

**Organization**: User Story(US1~US6 = H1~H6) 단위 그룹화. 005는 신규 외부 SDK 없이(프런트 `jspdf`·`docx`만 신규) 001~004 모노레포 모듈 확장 + 데모 시드 중심. 결제는 Sandbox/가상 시나리오까지(실거래 범위 외).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 User Story (US1~US6)
- 경로는 plan.md 모노레포 구조 기준. 마이그레이션은 004(V027) 이후 **V028~**.

## Path Conventions

- Backend: `backend/src/modules/<domain>/`, 서비스 `backend/src/services/`, 마이그레이션 `backend/src/db/`, 시드 `backend/scripts/`
- 프런트: 공유 `frontend-shared/`, 웹 `frontend-web/`, 모바일 `frontend-mobile/`, 타입 `shared/types/`

## ⚠️ 구현 정합 (2026-06-11 라이브 스키마 실측 — 실제 갭만 구현)

실측 결과 005가 가정한 백엔드 다수가 **이미 003/004에 구현**돼 있다. **신규 테이블/서비스 생성 금지**, 기존 자산 재사용. 실제 남은 갭은 대부분 **프런트·데모 시드·검증·용어 정리**다.

| US | 이미 존재(재사용) | 실제 005 갭 |
|---|---|---|
| US1(H1) | `alumni_paths`+`alumni_path_activities`+`alumni_rewards`, `POST /alumni/paths` 등록, `roadmap.ts`(코호트≥5·폴백·rationale·가중치) | 프런트 rationale 표시, **데모 코호트 시드(직무당 ≥5)**, 코드 '기부→합격경험공유' 정리 |
| US2(H2) | `auth` 메모리 토큰 + refresh 인터셉터(`api/client.ts onUnauthorized`) | **부팅 시 refresh로 세션 복원**(새로고침 유지)·로그아웃 메인 리다이렉트 (localStorage 대신 기존 보안 설계 유지) |
| US3(H3) | `partner`·`partner_account`(V027) | 파트너 가입 양식·**역할→메뉴 매핑(앱 상수)**·라우터 가드 |
| US4(H4) | `companies`·`missions`·`metrics.ts`·`catalog` | 기업 **드롭다운 UI**, 멘토 코멘트→학생 표시 배선, 데모 점수 시드 |
| US5(H5) | `activities.started_at/ended_at`, `documents`, `retention.ts` | 프런트 **기간 입력 UI**·`ended≥started` 검증, **jsPDF/docx 실다운로드**(클라이언트) |
| US6(H6) | `memberships`·`payments`·`membership.ts`(free/premium 게이팅), PortOne(003), `job_ad`·`paid_service` | 결제 **Sandbox/가상 시나리오 모드**·시나리오 팝업, `/promotions` 직무 맞춤 노출 배선 |

→ **V028 마이그레이션은 사실상 불필요**(신규 테이블 거의 없음). 결제 시나리오 추적이 기존 `payments`로 부족할 때만 소규모 컬럼/테이블 추가. 아래 태스크는 이 표 기준으로 "신규 생성"이 아니라 "기존 확장/배선"으로 수행한다.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 005 환경 점검 — 신규 백엔드 외부 SDK 없음 확인. `.env.example`+`backend/src/config/env.ts`에 `PAYMENT_SANDBOX_ENABLED`(기본 on) 플래그 추가 완료. `frontend-web/package.json`에 `jspdf`·`docx` 의존성 추가 완료 (`pnpm install`은 Foundational에서 스토어 작성과 함께 실행)
- [X] T002 [P] 005 OpenAPI 델타 → `shared/types` 생성 — `gen:005` 배선·`openapi-005.d.ts` 생성·`index.ts` `Api005`/`Schemas005` 익스포트 완료, `pnpm build`(tsc) 통과 + 백엔드 tsc --noEmit 통과

**Checkpoint**: 타입 생성·환경설정 통과, 신규 프런트 의존성 설치 완료.

---

## Phase 2: Foundational (Blocking Prerequisites)

⚠️ 이 단계 완료 전 어떤 User Story도 시작 불가.

- [X] T003 **불필요 확정**: 실측상 신규 테이블 0. `alumni_paths`·`activities(started_at/ended_at)`·`partner`·`job_ad`·`memberships`·`payments` 전부 기존. V028 미생성(마이그레이션 V027까지로 충분)
- [X] T004 **기존 재사용**: `services/recommendation/kAnonymity.ts`(`cohortCount`·`satisfiesKAnonymity`·k≥5)·`lib/privacy`. 신규 파일 없음
- [X] T005 [US2] **완료(재배선)**: `frontend-shared/src/stores/auth.ts`에 `restoreSession`(refresh 쿠키 부팅 복원)·`refreshAccessToken`·`logout` 추가. 토큰만 메모리(민감정보 미저장). vue-tsc 통과
- [X] T006 [US3] **완료**: 역할→메뉴 매핑을 `frontend-web/src/App.vue`에 구현(앱 상수). 라우터 가드(`useAuthGuard`)가 권한 밖 차단
- [X] T007 **기존+배선**: `backend/scripts/seed-demo-accounts.ts`(student×3·mentor×2·university·enterprise) 존재 → `package.json` `seed:demo` 배선

**Checkpoint**: 스키마 베이스·코호트 가드·세션 스토어·역할 메뉴·데모 하니스 준비 → User Story 병렬 착수 가능.

---

## Phase 3: US1 — 합격 경험 공유 → 데이터 기반 로드맵 연계 (Priority: P1) 🎯 MVP 선행

**Goal**: 현직자·선배가 합격 경험을 등록하면 익명화·코호트 적재되어 학생 로드맵 추천의 근거가 된다.
**Independent Test**: 멘토 데모로 합격 경험 1건 등록 → 같은 직무 학생이 로드맵 요청 시 코호트 표본 근거 추천 산출(미달 시 일반 가이드 폴백).

- [X] T008 [US1] **기존**: 합격 경험 등록 `POST /alumni/paths`(donateHandler)+익명화 코호트 적재+`alumni_rewards` 보상. 라이브 검증(코호트 38명 추천)
- [X] T009 [US1] **기존**: `services/roadmap.ts` 코호트(≥5) 근거 추천·`rationale`·가중치·미달 폴백. 라이브 검증(source=cohort, rationale 노출)
- [X] T010 [US1] **기존+배선**: `seed-alumni-samples.ts`(직무당 ≥10, k≥5 충족)+`seed-alumni-timelines.ts` 존재 → `seed:alumni`·`seed:alumni-timelines` 배선
- [X] T011 [US1] **기존**: 합격 경험 공유 등록 화면(`/donate`, 라벨 "합격 경험 공유") 존재. `POST /alumni/paths` 연동
- [X] T012 [US1] `frontend-web/src/pages/Roadmap.vue` — **기존 이미 구현**: rationale(basis·explanation·weight_note)·source(코호트)·cohort_size 표시 확인. 추가 작업 불필요

**Checkpoint**: US1 단독으로 "합격 경험 등록→코호트→근거 있는 로드맵" 데모 가능.

---

## Phase 4: US2 — 인증·세션 안정화 (로그아웃·새로고침 유지) (Priority: P1)

**Goal**: 로그아웃 시 즉시 메인 이동, 새로고침(F5)에도 로그인·화면 유지.
**Independent Test**: 새로고침해도 로그인·화면 유지, 로그아웃 시 세션 파기 후 메인 이동.

- [X] T013 [US2] `backend/src/modules/auth/` — **기존 재사용**: `POST /auth/logout`·`POST /auth/refresh` 이미 존재(refresh 쿠키 회전). 신규 `/auth/session` 불필요 — `/auth/refresh`로 부팅 복원
- [X] T014 [US2] `frontend-web/src/main.ts` — 부팅 시 `auth.restoreSession()`(`/auth/refresh` 쿠키→access token→JWT 클레임 복원) 후 마운트, 현재 URL 보존. `onUnauthorized`를 `refreshAccessToken`으로 배선. (+ `frontend-shared/src/stores/auth.ts`에 `restoreSession`/`refreshAccessToken`/`logout` 추가). vue-tsc 통과
- [X] T015 [US2] `frontend-web/src/App.vue` — 로그아웃 버튼을 `auth.logout()`(서버 무효화+세션 클리어) 후 `router.replace('/')` 메인 이동으로 배선. vue-tsc 통과
- [ ] T016 [P] [US2] `frontend-mobile` 동등 적용 — 세션 복원·로그아웃 리다이렉트(웹과 동일 frontend-shared 스토어 재사용, mobile main/App 배선만)

**Checkpoint**: US2 단독으로 "새로고침 유지·로그아웃 메인 이동" 데모 가능.

---

## Phase 5: US3 — 파트너별 회원가입 및 권한 종속 UI (Priority: P2)

**Goal**: 파트너 유형별 가입 양식 제공, 로그인 시 권한에 맞는 메뉴만 노출.
**Independent Test**: 유형별 가입 양식 제공, 역할별 내비게이션이 허용 메뉴만 표시·권한 밖 접근 차단.

- [X] T017 [US3] `POST /partners/signup` 신설 — partner_type별 역할 매핑(university/company→enterprise/mentor_org→mentor) 계정 발급 + `partner status='pending'`(004 운영자 활성화 게이트와 조화). edu_platform은 파트너 레코드만. 라이브 검증: 가입→로그인 OK, 비번없음 400
- [X] T018 [P] [US3] `frontend-web/src/pages/PartnerSignup.vue` + `/partner-signup` 라우트 + 헤더 '파트너 가입' 링크 — partner_type별 분기 양식(edu_platform은 비번 불필요). vue-tsc 통과
- [X] T019 [US3] `frontend-web/src/App.vue` 역할별 메뉴 — student/mentor/university/enterprise/admin **권한 종속 노출**(mentor 메뉴 신설). 권한 밖은 라우터 가드/`Forbidden` 차단. vue-tsc 통과
- [ ] T020 [P] [US3] `frontend-mobile` 동등 — 권한 기반 메뉴·접근 차단

**Checkpoint**: US3 단독으로 "파트너 가입→역할별 메뉴 종속" 데모 가능.

---

## Phase 6: US4 — 역할별 핵심 기능 실동작 (기업 매칭·멘토 미션/코멘트·데모 대시보드) (Priority: P2)

**Goal**: 기업 드롭다운 매칭, 멘토 미션 출제·심층 코멘트→학생 연결, 데모 계정 대시보드 점수 산출.
**Independent Test**: 기업 드롭다운 선택만으로 매칭, 멘토 코멘트가 학생 화면 표시, 데모 입력→점수 반영.

- [X] T021 [US4] `companies` 인재 검색 — **기존 재사용**: `store.search({industry_code, job_role_code})` 동작. catalog 코드 매칭
- [X] T022 [P] [US4] `frontend-web/src/pages/Company.vue` — 자유 텍스트 → **catalog 바인딩 산업→직무 2단 드롭다운**으로 교체. vue-tsc 통과
- [X] T023 [US4] `POST /mentor/submissions/:submissionId/feedback`(멘토 전용) 신설 — `feedbacks(kind=mentor)` 저장 + `review_assignments` completed 마감. 학생은 기존 결합 피드백 조회로 확인. 백엔드 tsc 통과
- [X] T024 [P] [US4] `Missions.vue` 멘토 분기 — `GET /mentor/submissions`(배정 목록) + 코멘트 작성 UI. 라이브 검증: 멘토 배정 1건 노출. vue-tsc 통과
- [X] T025 [US4] **기존**: 대시보드 점수는 갭 진단(`GapDiagnosisChart`)으로 표시, 데모 계정도 동일 경로 산출(`seed-demo-accounts` target_jobs 시드)
- [X] T026 [P] [US4] **기존+배선**: `seed-demo-accounts.ts`가 멘토·학생·기업 데모 계정 생성. `seed:demo` 배선

**Checkpoint**: US4 단독으로 "기업 매칭·멘토 코멘트·데모 점수" 데모 가능.

---

## Phase 7: US5 — 활동·스펙 기간 입력과 진짜 문서 다운로드 (진척 점검→문서 완결) (Priority: P2)

**Goal**: 활동을 기간(시작~종료)으로 입력하고, 자동 문서를 실제 PDF/Word 파일로 다운로드.
**Independent Test**: 기간 입력 1건 후 문서 생성 시 실제 PDF/Word 다운로드, 빈 기록 시 안내.

- [X] T027 [US5] 활동 기간 — 백엔드 `activityInputSchema`/`activityPatchSchema`에 **`ended≥started` refine 검증 추가**(종료<시작 400). 라이브 검증: 정상 201 / 역순 400. tsc 통과
- [X] T028 [P] [US5] `frontend-web/src/pages/Activities.vue` — 시작/종료(기간) 입력 + `ended≥started` 검증 + 목록 기간 표시(진행 중 포함). vue-tsc 통과
- [X] T029 [US5] **기존 데이터 재사용**: 전용 export-data 엔드포인트 대신 기존 `GET /documents`의 `DocumentItem.content`를 클라이언트 export 입력으로 사용. 빈 기록은 documents 생성 단계에서 안내
- [X] T030 [US5] `frontend-web/src/lib/export/documentExport.ts`(jsPDF·docx) + `Documents.vue` PDF/Word 버튼 — **실제 파일 다운로드**(화면 캡처 아님). jspdf·docx 설치, vue-tsc 통과
- [X] T031 [P] [US5] **기존**: `services/retention.ts` 주기적 진척 점검 → 누적 활동이 문서 입력에 반영(documents 재사용)
- [ ] T032 [P] [US5] `frontend-mobile` 동등 — 기간 입력·문서 다운로드

**Checkpoint**: US5 단독으로 "기간 입력→진짜 PDF/Word 다운로드" 데모 가능.

---

## Phase 8: US6 — 결제 과금 시나리오와 광고·제휴·채용 직무 맞춤 노출 (Priority: P3)

**Goal**: 결제 Sandbox/가상 시나리오로 등급 변경, 광고/제휴/채용을 직무 맞춤·숨김 없이 노출.
**Independent Test**: 결제 성공/실패에 따른 등급 변경, 직무 맞춤 노출·미동의/부적합 미노출.

- [X] T033 [US6] `checkout(force_result)` 가상 시나리오 — 성공→`status=paid`+멤버십 활성, 실패→`status=failed`+등급 불변. 테스트모드(`PAYMENT_SANDBOX_ENABLED`) 게이트. `Membership.vue` 가상 성공/실패 버튼. 라이브 검증 통과
- [X] T034 [P] [US6] `frontend-web/src/pages/Membership.vue` — "🧪 테스트 모드 — 실제 거래 아님" 표기 + 버튼 "결제하기(테스트)". vue-tsc 통과
- [X] T035 [US6] **기존**: `GET /job-postings`(industry/job 필터)·`/feeds/items`·ads 노출. 가입자 희망 직무 기준 노출
- [X] T036 [P] [US6] **기존**: `Dashboard.vue`가 추천 채용 "[광고]"·제휴 "[광고/제휴]" 라벨로 직무 맞춤 노출(미동의/off 시 빈 목록)
- [X] T037 [P] [US6] **기존+배선**: 카탈로그 직무 기반 ads/feeds 시드 + `seed:005` 통합 스크립트

**Checkpoint**: US6 단독으로 "결제 시나리오·직무 맞춤 노출" 데모 가능.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [~] T038 [P] 계약/단위 테스트 — `documentExport.test.ts`(US5 순수함수 4건) 추가·통과. 나머지 엔드포인트 계약 테스트는 DB 가동 시 실행
- [X] T039 [P] 통합 테스트 — k-익명성(≥5)·코호트 폴백·기간 검증(end<start)·결제 성공/실패 등급 변경·동의/직무 노출 제외·드롭다운 매칭을 `backend` 통합 테스트로 강제. `src/005-roles.integration.test.ts`(12 케이스 통과, cohort=38·fallback=10 앵커)
- [X] T040 [P] E2E 테스트 — `frontend-web` Playwright: 새로고침 로그인 유지·로그아웃 메인 이동·권한 메뉴 종속·문서 PDF/Word 실다운로드. `e2e/005-roles.e2e.spec.ts`+`playwright.config.ts`(6 케이스 통과). **E2E 중 실제 세션 버그 4건 발견·수정**: ①refresh 쿠키 path `/v1/auth`→`/`(프록시 프리픽스로 미전송), ②부팅 복원이 라우터 가드보다 늦어 보호 라우트가 /login 으로 튕김(main.ts boot 순서), ③`/auth/refresh` 401이 다시 refresh 인터셉터를 호출하는 무한 재귀(client.ts 인증 엔드포인트 제외), ④동일 초 회전 시 refresh 토큰이 바이트 동일하게 재발급→재사용 오탐으로 family 무효화(jwt.ts jti 부여). + single-flight refresh.
- [X] T041 [P] 데모 리허설 — H1·H2·H4·H5·H6 데모 계정 라이브 API 검증 + **브라우저 E2E 검증 완료**(T040): 새로고침 로그인 유지·로그아웃 메인 이동·역할별 메뉴·문서 PDF/Word 실다운로드 클릭까지 헤드리스 브라우저로 통과.
- [X] T042 [P] **완료**: '합격 경험 공유'(/donate)·'광고/제휴'·'테스트 모드(실거래 아님)' 표기 적용. 잔존 '기부' UI 0
- [X] T043 [P] 성능 점검 — 조회 API(활동/스펙·매칭·노출 목록) p95<200ms, `POST /roadmap`(생성) p95<2.0s 측정·확인. `src/005-perf.test.ts`(4 케이스 통과). 실측 p95: /activities 5ms·/job-postings 3ms·/companies/candidates 5ms·/roadmap 31ms(LLM_API_KEY 미설정→폴백 포함). 전 목표 큰 여유로 충족.

---

## Dependencies (User Story 완료 순서)

- **Setup(P1·T001~T002) → Foundational(T003~T007)** 완료가 모든 US의 선행.
- **US1·US2 (P1)** 우선 — MVP. US1은 T003(스키마)·T004(가드), US2는 T005(세션 스토어)에 의존.
- **US3 (P2)** T006(역할 메뉴)·T003(partner 테이블) 의존.
- **US4 (P2)** catalog(기존)·T007(데모) 의존, US3 권한 위에서 역할 화면 정합.
- **US5 (P2)** T003(기간 컬럼) 의존, US1과 독립.
- **US6 (P3)** T003(결제·노출 스키마) 의존, 003 결제 구조 위. US1~US5 핵심 가치 후행.
- **Polish(T038~T043)** 모든 US 후.

## Parallel 실행 예시

- Foundational 내: **T005·T006·T007** 병렬(서로 다른 파일).
- US1 내: **T010·T011** 병렬(시드 스크립트 vs 등록 화면).
- US4 내: **T022·T024·T026** 병렬(다른 페이지/시드).
- Polish: **T038~T043** 전부 병렬.

## Implementation Strategy (MVP first)

1. **MVP = US1 + US2** (둘 다 P1): 합격 경험→근거 있는 로드맵 + 세션 안정화. 이 둘만으로 핵심 가치·기본 사용성 시연 가능.
2. 이후 **US3·US4·US5(P2)** 로 역할별 실동작·활동/문서 완결.
3. **US6(P3)** 로 수익·노출 시나리오.
4. 각 US는 독립 체크포인트로 단독 데모 가능 — 점진 전달.

## 005 주의

- speckit 스크립트 FEATURE_DIR 버그로 `check-prerequisites.sh`가 001을 가리킴 → 본 tasks.md는 **005 디렉터리에 수동 작성**.
- 마이그레이션 번호는 V027(004) 이후 **V028**부터.
- 결제는 Sandbox/가상까지(실거래 범위 외), 합격 경험 외부 자동 연동 범위 외(수기·데모 시드).
