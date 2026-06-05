---
description: "Task list for AI 기반 진로·취업 로드맵 플랫폼 (002-intent-specify)"
---

# Tasks: AI 기반 진로·취업 로드맵 플랫폼

**Input**: Design documents from `/specs/002-intent-specify/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 본 명세는 TDD를 명시적으로 요청하지 않았다. 계약·통합 테스트는 Polish 단계(T068)에 통합하며, 모바일 E2E 자동화는 plan.md에 따라 P3에 도입(T067).

**Organization**: User Story 단위로 그룹화하여 각 스토리를 독립적으로 구현·테스트·배포할 수 있다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 User Story (US1~US9)
- 모든 경로는 plan.md의 모노레포 구조 기준

## Path Conventions

- Backend: `backend/src/modules/<domain>/`, 공통 라이브러리 `backend/src/lib/`, 미들웨어 `backend/src/middleware/`
- 공유 프런트: `frontend-shared/`, 웹 `frontend-web/`, 모바일 `frontend-mobile/`
- 타입: `shared/types/` (OpenAPI 자동 생성)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 모노레포·툴체인 초기화

- [X] T001 plan.md 구조에 맞춰 워크스페이스 확인/정비 (`backend`, `frontend-shared`, `frontend-web`, `frontend-mobile`, `shared/types`)
- [X] T002 [P] `.env` 구성 — DB(pioneer16)·Redis·MinIO·PortOne·Naver Mailer·FCM/APNs 키 및 네트워크 표준값(`9536`/`9516`/`p16.sumzip.com`)
- [X] T003 [P] ESLint/Prettier + 공통 `tsconfig` 워크스페이스 전반 설정
- [X] T004 [P] OpenAPI → TS 타입 생성 파이프라인 구성: `contracts/openapi.yaml` → `shared/types/` (openapi-typescript)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story 착수 전 완료되어야 하는 핵심 인프라

**⚠️ CRITICAL**: 이 단계 완료 전에는 어떤 User Story도 시작할 수 없음

- [X] T005 마이그레이션 프레임워크 + 기본 스키마 규약(`id`/`created_at`/`updated_at`) 및 `users` 테이블 in `backend/src/lib/db/`
- [X] T006 [P] AES-GCM 컬럼 암호화 유틸 in `backend/src/lib/crypto.ts` (FR-020, R-3)
- [X] T007 [P] Redis 클라이언트 + BullMQ 큐 부트스트랩 in `backend/src/lib/redis.ts`
- [X] T008 [P] MinIO(S3 호환) 클라이언트 래퍼 in `backend/src/lib/minio.ts`
- [X] T009 Auth 모듈: 5종 역할 `users`, JWT(`scope` 클레임), bcrypt, `POST /auth/login` in `backend/src/modules/auth/` + `backend/src/middleware/authz.ts` (FR-001~002)
- [X] T010 [P] 미들웨어: requestId·pino 로깅·에러 핸들러·rate-limit in `backend/src/middleware/`
- [X] T011 Consent 기반: append-only `consents`, `university_consent_scope`, `retention_jobs` in `backend/src/modules/consent/` (FR-021~022)
- [X] T012 [P] 추천 엔진 스켈레톤: 규칙+AI 하이브리드 인터페이스, 민감속성(성별·나이·출신학교) 제외 in `backend/src/lib/recommender.ts` (FR-007, R-1)
- [X] T013 [P] 프런트 셸: 공통 레이아웃·auth 스토어·라우터 가드 in `frontend-shared/` + `frontend-web/` 부트스트랩
- [X] T014 `/healthz`·`/readyz` + 기본 API 라우터 in `backend/src/`
- [X] T073 개인정보 처리방침 게시 + 변경 시 재동의 플로우 — 처리방침 버전 관리, 변경 감지 시 로그인 후 재동의 모달, 재동의 이벤트를 append-only `consents`에 기록 in `backend/src/modules/consent/policy.ts` + `frontend-shared/` 재동의 UI (FR-025) — depends T011

**Checkpoint**: 기반 완료 — User Story 병렬 착수 가능

---

## Phase 3: User Story 1 - 역량 갭 진단 (Priority: P1) 🎯 MVP

**Goal**: 학생이 프로필을 입력하면 목표 직무 대비 역량 갭을 진단·시각화한다.

**Independent Test**: 프로필 입력 → `POST /diagnosis` → 충족/부족 역량 시각화 결과 확인. 누락 시 422 보완 안내, 역량 갱신 후 재진단 반영.

- [X] T015 [P] [US1] `students` + `student_skills` 마이그레이션/모델 in `backend/src/modules/students/` (data-model §2)
- [X] T016 [P] [US1] `diagnoses` 마이그레이션/모델 in `backend/src/modules/diagnosis/` (§4)
- [X] T017 [US1] 프로필 서비스 + `PUT /students/me/profile` (FR-003) — depends T015
- [X] T018 [US1] 갭 진단 서비스(보유역량 ↔ 목표직무 요구역량 비교, 시각화 페이로드) (FR-004) — depends T015,T016
- [X] T019 [US1] `POST /diagnosis` 엔드포인트 + 누락항목 422 안내 — depends T018
- [X] T020 [P] [US1] 웹: 프로필 입력 화면 in `frontend-shared/` + `frontend-web/`
- [X] T021 [P] [US1] 웹: 진단 결과 시각화 화면
- [X] T022 [US1] 역량 갱신 시 재진단(이력 보존) 연동 — depends T018
- [ ] T074 [P] [US1] 온보딩 흐름 최적화 — 가입→프로필 입력→첫 진단까지 단계 축약 위저드(진행률 표시·필수항목 우선) in `frontend-shared/` (SC-001 첫 진단 15분 이내 달성 지원) — depends T020,T021

**Checkpoint**: US1 단독 기능·테스트 가능 (MVP 데모)

---

## Phase 4: User Story 2 - 선배 경로 기반 합격 로드맵 추천 (Priority: P2)

**Goal**: 진단 결과 + 익명화 선배 경로로 시기별 추천 로드맵을 생성한다.

**Independent Test**: 진단 완료 학생이 `POST /roadmap` → 시기별 추천 활동 목록 확인. k<5 코호트는 폴백 안내, 거부 시 이후 추천 반영.

> ⚠️ 선행 의존: 본 스토리는 T071(선배 데이터 초기 시드) 완료 후 실데이터로 동작한다. 시드 전에는 폴백 경로만 검증 가능.

- [X] T023 [P] [US2] `alumni_paths` + `alumni_path_activities` 마이그레이션/모델(읽기측) in `backend/src/modules/alumni/` (§3)
- [X] T071 [P] [US2] 선배 합격 경로 초기 시드·임포트 파이프라인 — 익명화 파일럿 데이터(대학 1~3곳)를 `alumni_paths`/`alumni_path_activities`에 적재하는 임포트 스크립트 + `seed:dev` 샘플 in `backend/scripts/seed-alumni.ts` & `backend/src/modules/alumni/import.ts` (FR-019, R-2). k-익명성(≥5) 검증 포함 — depends T006,T023,T024
- [X] T024 [P] [US2] 코호트 집계 + k-익명성(≥5) 게이트 유틸 (FR-019, R-2)
- [X] T025 [P] [US2] `roadmaps` + `roadmap_items` + `recommendation_rejections` 마이그레이션/모델 in `backend/src/modules/roadmap/` (§5)
- [X] T026 [US2] 로드맵 생성 서비스(하이브리드 추천 + k-anon 게이트 + 폴백) (FR-005, R-1/R-2) — depends T012,T023,T024,T025
- [X] T027 [US2] `POST /roadmap` 엔드포인트 — depends T026
- [X] T028 [US2] `POST /roadmap/items/{itemId}/reject` + 거부 가중치 반영 (FR-006) — depends T025,T026
- [X] T029 [P] [US2] 웹: 로드맵 타임라인 화면 + 거부 액션

**Checkpoint**: US1 + US2 독립 동작

---

## Phase 5: User Story 3 - 활동 자동 정리 및 문서 자동 생성 (Priority: P2)

**Goal**: 활동을 자동 분류하고 이력서·자소서·포트폴리오를 자동 생성한다.

**Independent Test**: 활동 기록 학생이 `POST /documents` → 초안 생성, `PUT /documents/{id}` 수정·버전 저장 확인.

- [X] T030 [P] [US3] `activities` 마이그레이션/모델 + 자동 분류 서비스 (FR-008) in `backend/src/modules/students/` (§6)
- [X] T031 [P] [US3] `documents` 마이그레이션/모델(MinIO storage_key) in `backend/src/modules/documents/` (§7)
- [X] T032 [US3] 문서 생성 서비스(활동 → resume/coverletter/portfolio) (FR-009) — depends T030,T031,T008
- [X] T033 [US3] `POST /documents` + `PUT /documents/{docId}`(버전) 엔드포인트 — depends T032
- [X] T034 [P] [US3] 웹: 문서 생성/편집/미리보기 화면

**Checkpoint**: US1~US3 독립 동작

---

## Phase 6: User Story 4 - 실무 미션 및 결합 피드백 (Priority: P3)

**Goal**: 미션 제출 시 AI 1차 + 현직자 코멘트 결합 피드백을 제공한다.

**Independent Test**: 미션 제출 → AI 피드백 즉시, 5영업일 내 현직자 코멘트 결합. 기한 초과 시 재배정/AI 대체.

- [X] T035 [P] [US4] `missions` + `submissions` + `feedbacks` + `review_assignments` 마이그레이션/모델 in `backend/src/modules/missions/` (§8)
- [X] T036 [US4] 제출 서비스 + AI 1차 피드백 (FR-010~011) — depends T035,T008,T012
- [X] T037 [US4] 검수 배정 + 5영업일 SLA BullMQ 잡 + 재배정/AI 대체 (FR-012, R-8) — depends T035,T007
- [X] T038 [US4] `POST /missions/{id}/submissions` + `GET /submissions/{id}/feedback` 엔드포인트 — depends T036,T037
- [X] T039 [P] [US4] 웹: 미션 제출 + 결합 피드백 화면

**Checkpoint**: US1~US4 독립 동작

---

## Phase 7: User Story 5 - 진척 점검 및 알림 (Priority: P3)

**Goal**: 진척을 주기적으로 점검하고 주요 시점 알림을 발송한다.

**Independent Test**: 점검 시점 도래 → 알림 발송, 활동 업데이트 → 진척/추천 갱신.

- [X] T040 [P] [US5] `notifications` 마이그레이션/모델 in `backend/src/modules/notifications/` (§14)
- [X] T041 [US5] 알림 서비스 + 학기말 진척점검 스케줄 잡(BullMQ) + 채널 어댑터(FCM/APNs/Naver mail) (FR-013) — depends T007,T040
- [X] T042 [US5] `GET /notifications` 엔드포인트 + 업데이트 유도 플로우 — depends T041
- [X] T043 [P] [US5] 웹/모바일: 알림 센터 + 푸시 등록(`@capacitor/push-notifications`)

**Checkpoint**: US1~US5 독립 동작

---

## Phase 8: User Story 6 - 대학용 관리 기능 B2G (Priority: P3)

**Goal**: 대학이 동의 범위(통계/개인)에 따라 학생 현황을 관리한다.

**Independent Test**: stats 동의 → 집계만, individual 동의 → 개인 단위. 미동의 학생 미노출.

- [X] T044 [P] [US6] `universities` + `university_staff` 마이그레이션/모델 in `backend/src/modules/university/` (§10)
- [X] T045 [US6] 대학 조회 서비스 — 동의범위 서버측 강제 필터(stats vs individual) (FR-014, R-4) — depends T011,T044
- [X] T046 [US6] `GET /university/students` 엔드포인트(범위 차등) — depends T045
- [ ] T047 [P] [US6] 웹: 대학 대시보드(집계/개인 모드)

**Checkpoint**: US1~US6 독립 동작

---

## Phase 9: User Story 7 - 기업 인재 매칭 B2B (Priority: P4)

**Goal**: 기업이 동의·요건 부합 후보를 검색·발굴한다.

**Independent Test**: 직무 요건 검색 → 부합 후보 목록, 미동의 학생 결과 제외.

- [X] T048 [P] [US7] `companies` + `job_match_consents` 마이그레이션/모델 in `backend/src/modules/companies/` (§11)
- [X] T049 [US7] 후보 검색 서비스(요건 매칭 + 미동의 제외) (FR-015) — depends T048
- [X] T050 [US7] `GET /companies/candidates` 엔드포인트 — depends T049
- [ ] T051 [P] [US7] 웹: 기업 후보 검색 화면

**Checkpoint**: US1~US7 독립 동작

---

## Phase 10: User Story 8 - 결제 및 멘토 보상 정산 (Priority: P4)

**Goal**: 학생 결제로 권한을 활성화하고 멘토 보상을 정산한다.

**Independent Test**: 멤버십 결제 → 권한 활성(실패 시 402), 멘토 정산 내역(정액/수수료) 산출.

> 의존성: 결제는 멘토 정산 데이터 구조에 의존(spec Assumptions) — 모델을 함께 설계.

- [X] T052 [P] [US8] `mentors` + `commission_rates` + `payment_methods`(account_no AES-GCM) 마이그레이션/모델 in `backend/src/modules/payments/` (§9)
- [X] T053 [P] [US8] `payments` + `memberships` 마이그레이션/모델 (§13)
- [X] T054 [US8] PortOne 빌링 연동 + 결제 서비스 → 멤버십 권한 활성 (FR-016, R-5) — depends T053
- [X] T055 [US8] 멘토 정산 서비스(정액/수수료) + PortOne Payouts (FR-017, R-5) — depends T052,T006
- [X] T056 [US8] `POST /payments/checkout`(실패 402) + `GET /payments/mentor-payouts` 엔드포인트 — depends T054,T055
- [ ] T057 [P] [US8] 웹: 멤버십 결제 + 멘토 정산 화면

**Checkpoint**: US1~US8 독립 동작

---

## Phase 11: User Story 9 - 선배 데이터 기부 및 보상 (Priority: P4)

**Goal**: 선배가 합격 경로를 기부하면 익명화 저장 후 보상한다.

**Independent Test**: `POST /alumni/paths` 제출 → PII 제거 익명화 저장 + 보상 지급.

- [X] T058 [P] [US9] `alumni_rewards` 마이그레이션/모델 in `backend/src/modules/alumni/` (§16)
- [X] T059 [US9] 기부 서비스: 쓰기 시 익명화(PII strip) + 보상 지급 (FR-018, R-3) — depends T023,T006,T058
- [X] T060 [US9] `POST /alumni/paths` 엔드포인트 — depends T059
- [ ] T061 [P] [US9] 웹: 선배 기부 + 보상 화면

**Checkpoint**: 전체 US1~US9 독립 동작

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: 다수 스토리에 걸친 마무리·운영·품질

- [X] T062 [P] 운영자 검수 모듈(미션·공고·신고) in `backend/src/modules/admin/` (FR-023)
- [X] T063 [P] 외부 채용 공고 수집기 + 신선도(fresh/stale) in `backend/src/modules/jobpostings/` (FR-024)
- [ ] T064 [P] 보존기간 경과 자동 익명화/삭제 배치 잡 (FR-022) — `retention_jobs` 소비
- [ ] T065 일일 백업 + 24h 복구 런북 + `/healthz`·`/readyz` 모니터링 (SC-012, R-7)
- [ ] T066 성능 패스: 로드맵 p95<2s, 조회 p95<200ms, Redis 캐싱 (SC-011)
- [ ] T067 [P] 모바일 E2E 자동화(Detox/Maestro) 도입 — plan.md상 P3 시점
- [ ] T068 [P] 테스트 스위트: openapi 계약 테스트 + 스토리별 통합 테스트 (Vitest/Supertest/Playwright)
- [ ] T069 보안 하드닝: AES-GCM 적용 범위·k-익명성 강제·비밀 분리 감사 (FR-007/019/020/025)
- [ ] T070 quickstart.md 엔드투엔드 검증
- [X] T072 [P] 제품 이벤트 트래킹·지표 집계 인프라 — 핵심 행동 이벤트 정의·수집(가입, 첫 진단, 7일 내 3대 행동, 로드맵 완료, 추천 거부, 포트폴리오 활용, 90일 결제 전환, 멤버십 해지, 학기말 재방문) + 지표 집계 뷰/대시보드 연계 in `backend/src/lib/analytics.ts` & `backend/src/modules/admin/metrics.ts` (SC-002~SC-010) — depends T010,T062

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: 의존성 없음, 즉시 시작
- **Foundational (P2)**: Setup 완료 후 — 모든 User Story 차단(blocking)
- **User Stories (P3~P11)**: Foundational 완료 후 착수. 이후 우선순위(P1→P4) 순차 또는 병렬(인력 여유 시)
- **Polish (P12)**: 목표 스토리 완료 후

### User Story Dependencies

- **US1(P1)**: Foundational 후 시작, 타 스토리 비의존 — MVP
- **US2(P2)**: US1 진단 결과 활용(데이터 흐름) — 단, 독립 테스트 가능. alumni 읽기 모델 + **T071 선배 데이터 시드 선행 필요**(미시드 시 폴백만 동작)
- **US3(P2)**: 독립. 활동·문서 도메인
- **US4~US6(P3)**: 독립. US6은 Consent(T011) 기반 필요
- **US7~US9(P4)**: 독립. US8 결제↔정산 모델 동반, US9는 alumni 쓰기 + crypto 필요

### Within Each User Story

- 모델 → 서비스 → 엔드포인트 → 통합 → UI 순
- [P] 표시는 서로 다른 파일·무의존

### Parallel Opportunities

- Setup 내 [P](T002~T004) 병렬
- Foundational 내 [P](T006~T008,T010,T012,T013) 병렬 — 단 T005/T009/T011/T014는 순차 기반
- Foundational 완료 후 US1~US9를 팀 단위로 병렬 진행 가능
- 각 스토리 내 모델 [P] 병렬

---

## Parallel Example: User Story 1

```bash
# US1 모델 병렬:
Task: "students + student_skills 모델 in backend/src/modules/students/"
Task: "diagnoses 모델 in backend/src/modules/diagnosis/"

# US1 화면 병렬(서비스 완료 후):
Task: "프로필 입력 화면 in frontend-shared + frontend-web"
Task: "진단 결과 시각화 화면"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational(차단 단계) → 3. Phase 3 US1
4. **STOP & VALIDATE**: US1 단독 테스트(SC-001 첫 진단 15분 내) → 데모

### Incremental Delivery

- Setup+Foundational → 기반 완료
- +US1(MVP) → +US2/US3(P2) → +US4~US6(P3) → +US7~US9(P4)
- 각 단계는 앞 단계 안정 후 시작(spec/plan 원칙), 매 스토리 독립 배포 가능

### Parallel Team Strategy

- 팀이 Setup+Foundational 공동 완료 후, 개발자별로 US 분담 병렬 진행

---

## Notes

- 총 74개 태스크(T001~T074). [P]=다른 파일·무의존, [Story]=추적성
- T071~T074는 /speckit.analyze 보완 태스크(I1 선배 데이터 시드, C2 처리방침·재동의, C3 온보딩, C1 지표 계측)로, 번호는 끝번호를 잇되 각 해당 Phase에 배치됨
- 각 User Story는 독립 완료·테스트 가능하도록 구성
- 태스크/논리 그룹 단위 커밋 권장, 체크포인트에서 스토리 단독 검증
- speckit 스크립트의 브랜치→디렉터리 매칭 버그로 산출물은 `specs/002-intent-specify/`에 수동 배치됨(향후 수정 권장)
