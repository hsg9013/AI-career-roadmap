# Phase 1 Data Model: 005 (delta over 003/004)

005는 신규 기반을 만들지 않고 기존 엔티티를 확장한다. 아래는 **추가·변경 지점만** 기술한다(기존 003/004 엔티티는 계승).

## ⚠️ 구현 정합(2026-06-11 실측) — 기존 자산 재사용 (신규 생성 금지)

라이브 003/004 스키마 실측 결과, 005가 가정했던 다수 엔티티가 **이미 존재**한다. 아래는 **재사용** 하며 새로 만들지 않는다.

| 005 가정(초안) | 실제 기존 자산 | 조치 |
|---|---|---|
| `shared_success_experience` + timeline (H1) | `alumni_paths` + `alumni_path_activities`(V007), 등록 `POST /alumni/paths`, 보상 `alumni_rewards`(V015) | **재사용** — 신규 테이블 X. '기부' 용어만 '합격 경험 공유'로 정리 |
| 코호트 k-익명성 가드 (H1/T004) | `services/recommendation/kAnonymity.ts`(`cohortCount`·`satisfiesKAnonymity`·`K_ANONYMITY_MIN`), `lib/privacy` 재노출 | **재사용** — `cohort.ts` 신규 X |
| 코호트 근거 추천 (H1/T009) | `services/roadmap.ts`(`source='cohort'\|'fallback'`, k≥5, `rationale`, 가중치 부스트) | **재사용** — 이미 산출. 프런트 표시(T012)가 실제 갭 |
| 활동 기간 컬럼 추가 (H5) | `activities.started_at`(DATE)·`ended_at`(DATE NULL) **존재** | **재사용** — 마이그레이션 X. 프런트 기간 UI + `ended≥started` 검증만 |
| partner/권한 (H3) | `partner`·`partner_account`(V027, type university/company/mentor_org/edu_platform) | **재사용** — 가입 양식·역할 메뉴(앱 레이어)만 |
| 광고 노출 매칭키 (H6) | `job_ad`(industry_code·job_role_code·budget·status)(V027), `paid_service(_order)` | **재사용** |

**따라서 V028 신규 항목은 최소** — 결제 시나리오 추적(`payment_scenario`)·등급 변경 이력이 기존 결제(V014/V022)에 없으면만 추가. 역할→메뉴 매핑은 앱 레이어(상수)로 두고 테이블 불필요. 아래 1·3·4·7절은 "재사용+보강" 관점으로 읽는다.

## 1. 합격 경험 공유(SharedSuccessExperience) — `alumni` 확장 (H1)

현직자·선배가 등록하는 익명화된 합격 경험. 직무 코드별 코호트의 1차 데이터.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| contributor_id | FK(user) | 공유 선배/현직자(익명화 후 추천엔 미노출) |
| job_code | string | catalog 직무 코드(코호트 키) |
| industry_code | string | catalog 산업 코드 |
| admit_year | number | 합격 연도 |
| anonymized | bool | PII 제거 완료 여부(추천 사용 전제) |
| resume_summary | text | PII 제거된 이력 요약 |
| portfolio_highlights | json | 포트폴리오 핵심 |
| skills | json | 직무 역량 키워드 |
| reward_status | enum(pending/granted) | 공유 보상 상태 |
| created_at | datetime | |

**SharedExperienceTimeline** (1:N) — 시기별 활동(로드맵 근거 단위)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| experience_id | FK | |
| term | string | 학년·학기(예: 2-1) |
| type | enum | certificate/contest/intern/project/club/volunteer |
| title | string | |
| start_date | date | 시작(H5 기간과 일관) |
| end_date | date? | 종료(진행중 null) |

- **Validation**: `anonymized=true` 이고 같은 `job_code` 코호트 인원 ≥5(k-익명성)일 때만 추천에 사용. 미달 코호트는 일반 가이드 폴백.
- **Cohort 메타(파생/뷰)**: `job_code` → 표본 수, k-충족 여부. 추천 게이트웨이가 조회.

## 2. 세션/인증 상태(클라이언트) — `auth` (H2)

서버 스키마 변경 없음. 클라이언트 영속 상태 정의(프런트 계약).

| 키 | 저장소 | 내용 | 규칙 |
|---|---|---|---|
| auth_token | localStorage | 인증 토큰(문자열) | 만료·로그아웃 시 즉시 삭제, **민감정보 미저장** |
| (유저 프로필) | 메모리(Pinia) | 부팅 후 재조회 | 저장소에 두지 않음 |

- **State transitions**: 로그인→토큰 저장. 부팅→토큰 존재 시 하이드레이션→유저 재조회→인증됨. 401/만료→토큰 삭제→비인증. 로그아웃→토큰·세션 삭제→메인 이동.

## 3. 파트너 계정·권한 메뉴 — `partners`/`auth` 확장 (H3)

| 엔티티 | 필드 | 설명 |
|---|---|---|
| PartnerAccount | partner_type enum(university/company/mentor/edu_activity_platform), org_name, contact, status(approved/pending), role | 파트너 유형별 가입·역할 계정 |
| RoleMenuMap | role, allowed_menu_keys json | 역할→허용 메뉴(노출/접근 단일 출처) |

- **Validation**: 가입 양식 필드는 partner_type별로 분기. 비허용 메뉴는 노출·접근 모두 차단.

## 4. 활동·스펙 기간 — `activities` 확장 (H5)

기존 활동/보유 스펙 레코드에 기간 컬럼 추가(단일일 폐지).

| 필드 | 타입 | 설명 |
|---|---|---|
| start_date | date | 시작일(필수) |
| end_date | date? | 종료일(진행중 null) |

- **Validation**: `end_date`가 있으면 `end_date ≥ start_date`. 위반 시 거부.
- **Migration 주의**: 기존 단일일 데이터는 `start_date=end_date`로 이관.

## 5. 자동 생성 문서 export 메타 — `documents` 확장 (H5)

| 필드 | 타입 | 설명 |
|---|---|---|
| doc_type | enum(resume/cover_letter/portfolio) | 문서 유형 |
| export_format | enum(pdf/docx) | 출력 포맷(실파일) |
| source_activity_ids | json | 입력이 된 활동·스펙(누적 진척 점검 포함) |
| generated_at | datetime | 생성 시각 |

- 파일 자체는 클라이언트 생성·다운로드(서버 미저장 가능). 메타만 기록.

## 6. 결제 시나리오·멤버십 등급 — `payments`/`membership` 확장 (H6)

| 엔티티 | 필드 | 설명 |
|---|---|---|
| PaymentScenario | mode enum(sandbox/virtual), result enum(success/fail), amount, plan_target, is_real=false | 테스트/가상 결제, 실거래 아님 표기 강제 |
| MembershipChangeLog | user_id, from_tier, to_tier, payment_scenario_id, changed_at | 등급 변경 이력 |

- **State**: 결제 success→등급 변경+이력 기록. fail→등급 불변+실패 팝업. 모든 경로 `is_real=false` 표기.

## 7. 광고·제휴·채용 노출 매칭 — `ads`/`feeds`/`jobpostings` 확장 (H6)

| 필드 | 타입 | 설명 |
|---|---|---|
| match_industry_code | string | 노출 매칭 키(산업) |
| match_job_code | string | 노출 매칭 키(직무) |
| placement_type | enum(ad/affiliate/jobposting) | '광고/제휴' 표기 결정 |
| target_account_types | json | 노출 대상 계정 유형 |

- **Validation**: 노출 시 가입자 희망 산업·직무와 매칭 + 학생 동의·직무 적합성 충족 항목만. 표기('광고/제휴') 필수.

## 8. 데모 계정 세트 — 시드(전 H 공통)

| 엔티티 | 설명 |
|---|---|
| DemoAccountSet | 학생·멘토·기업 등 역할별 데모 계정 + 상호 연결(멘토↔학생) |
| (시드) | 합격 경험 코호트(직무당 ≥5), 활동·스펙(기간), 미션·코멘트, 광고/제휴/채용 매칭 데이터 |

- **목적**: 데모에서 점수·미션·코멘트·매칭·로드맵·노출이 재현되도록 보장(데모 특례 분기 최소화, 일반 경로 사용).

## 관계 요약

- SharedSuccessExperience (job_code) → Cohort → roadmap 추천 근거 (H1)
- activities(기간) → documents(export) 입력, retention(진척 점검) 누적 (H5)
- PartnerAccount(role) → RoleMenuMap → 내비게이션/가드 (H3)
- catalog(산업·직무) → companies 매칭(드롭다운) / 노출 매칭 키 (H4/H6)
- PaymentScenario → MembershipChangeLog (H6)
