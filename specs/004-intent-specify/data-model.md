# Data Model: 004 — 가치사슬 앞단·생태계·수익 보강

**Date**: 2026-06-10 | **Branch**: `004-intent-specify`

003까지의 스키마(마이그레이션 V001~V025) 위에 004 신규/확장 테이블을 더한다. 신규 마이그레이션은 **V026부터** 부여한다. 모든 개인 식별·민감 컬럼은 기존 정책(암호화·동의 append-only·k-익명성)을 따른다.

## 신규/확장 엔티티

### 1. 보유 스펙 — `student_credential` (신규, V026) [G1]
학생의 자격증·수상·인턴십·아르바이트 등 스펙. 활동 이력(`activities`, 기존)과 별개의 1급 엔티티.
- `id` PK
- `student_id` FK→students
- `kind` enum(`certificate`,`award`,`internship`,`part_time`,`other`)
- `title` varchar
- `issuer` varchar null (발급기관/회사)
- `acquired_on` date null
- `detail_json` json null (점수·기간·역할 등)
- `created_at`,`updated_at`
- 관계: student 1—N credential. 진단·로드맵·문서 입력으로 소비.

> 활동 이력은 기존 `activities` 테이블을 사용(필요 시 `kind` 확충: 수강·프로젝트·동아리·봉사·공모전·대외활동). 본 명세는 입력 경로(온보딩/마이페이지) UI·API를 추가.

### 2. 직무 미션 세트 — `job_mission` (신규, V027) [G2]
직무별 기본 미션. 직무당 ≥3.
- `id` PK
- `industry_code`,`job_role_code` (catalog 정합)
- `title`,`brief` text
- `origin` enum(`base`,`mentor`) default `base`
- `mentor_id` FK→mentors null (origin=mentor)
- `active` bool default 1
- 우선순위 규칙: 같은 (학생,직무)에서 멘토 출제(origin=mentor)가 있으면 우선, 없으면 base 세트. 시드: 직무당 base ≥3.

### 3. 추천 근거 — `recommendation_rationale` (신규, V028) [G3]
로드맵/진단 결과의 설명. 결과 응답에 부가 노출(저장은 감사·재현용).
- `id` PK
- `subject_ref` (roadmap/diagnosis 식별)
- `student_id` FK
- `basis` enum(`personalized`,`general_guide`)
- `sample_size` int (같은 직무 합격 표본 N)
- `top_competencies_json` json (가중치 상위 역량 + 평이 설명)
- `explanation` text (사용자 노출용 평이 문장)
- `created_at`
- 규칙: sample_size < 5 면 basis=`general_guide`, explanation에 "표본 부족" 안내.

### 4. 멤버십 등급·구독 — `membership_tier` / `membership_subscription` (신규, V029) [G5]
- `membership_tier`: `code` enum(`free`,`premium`), `name`, `features_json`(활성 기능 목록), `price_month` int null
- `membership_subscription`: `id`,`student_id` FK,`tier_code`,`status` enum(`active`,`canceled`,`expired`),`started_at`,`expires_at`,`auto_renew` bool — 003 `payment` 와 연계(결제 성공 시 active)
- 기능 게이팅 SSOT: `services/membership.ts` 가 `features_json` 으로 접근 제어.

### 5. 실무 단건 과금 — `paid_service` / `paid_service_order` (신규, V030) [G5]
- `paid_service`: `code` enum(`coverletter_review`,`resume_feedback`,`mentoring`,`assignment_eval`),`name`,`fee` int
- `paid_service_order`: `id`,`student_id`,`service_code`,`payment_id` FK→payment,`status`,`created_at` — 003 결제 멱등/상태기계 재사용.

### 6. 타겟 채용 광고 — `job_ad` (신규, V031) [G5/US7]
자체 광고 슬롯(내부 관리). 외부 네트워크 미연동.
- `id`,`company_id` FK,`job_posting_id` FK null,`title`,`industry_code`,`job_role_code`(타겟 직무),`budget` int,`status` enum(`active`,`paused`,`ended`),`starts_on`,`ends_on`
- `job_ad_impression`: `id`,`job_ad_id`,`student_id`,`shown_at` (과금·집계)
- 노출 규칙: 학생 직무 일치 + 광고 노출 동의 시에만. 미동의 미노출.

### 7. 제휴사 배너 — `partner_banner` / `banner_conversion` (신규, V032) [G5/US8]
- `partner_banner`: `id`,`partner_id` FK→partner,`title`,`image_url`,`landing_url`,`discount_text` null,`active` bool — '광고/제휴' 표기 강제
- `banner_conversion`: `id`,`partner_banner_id`,`student_id` null,`event` enum(`click`,`convert`),`occurred_at` — 자체 집계 → 제휴 수수료 산정

### 8. 라이선스 계약 — `license_contract` (신규, V033) [G5/US9]
- `id`,`partner_id` FK(대학/기업),`type` enum(`university_saas`,`company_recruit`),`scope` enum(`stats`,`individual`) null(대학),`seats` int null,`fee_year` int null,`commission_rate` decimal null(기업 채용),`status`,`started_on`,`ends_on`

### 9. 파트너 — `partner` / `partner_account` (신규, V034) [G4]
운영자 수동 등록.
- `partner`: `id`,`type` enum(`university`,`company`,`mentor_org`,`edu_platform`,`tech_partner`),`name`,`consent_scope` enum(`none`,`stats`,`individual`) default `stats`,`status`,`registered_by`(운영자),`created_at`
- `partner_account`: `id`,`partner_id`,`user_id` FK→users(역할 계정),`role`,`created_at`
- 기존 `university`,`companies` 모듈 데이터와 연계(파트너 메타를 partner 로 일원화).

## 용어 정비 [R7]
- `alumni` 영역의 '기부(donation/donate)' 표현을 데이터 라벨·열거·UI 카피에서 '합격 경험 공유(share)'로 치환. DB enum/컬럼명 변경이 필요하면 마이그레이션으로 alias 추가(데이터 보존), 표시 라벨은 즉시 치환. 잔존 0 검증.

## 표본 시드 [G6]
- `alumni` 합격 경로를 **직무당 10건** 시드(V035 seed). 같은 직무 10건 → k≥5 충족. 시연용 임의 계정(학생/선배/멘토)은 별도 seed 로 생성하고 목록 산출.

## 인덱스·제약 요점
- `student_credential(student_id, kind)`, `job_mission(industry_code, job_role_code, origin)`, `job_ad(industry_code, job_role_code, status)`, `membership_subscription(student_id, status)` 인덱스.
- 광고/배너 노출·전환은 append-only. 멤버십/과금은 003 결제 멱등 가드 재사용.
- 동의 범위: 광고·제휴·파트너 제공은 학생/파트너 consent_scope 기준 강제(쿼리 레벨 필터).
