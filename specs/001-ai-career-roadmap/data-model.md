# Phase 1 Data Model: AI 기반 커리어 로드맵 서비스

**Branch**: `001-ai-career-roadmap` | **Date**: 2026-05-15 | **DB**: MariaDB 10.x (utf8mb4_unicode_ci, InnoDB)

본 문서는 spec.md의 35개 Key Entity를 관계형 DB 스키마로 매핑한다. P1(US1, US2, US3)에 필요한 핵심 테이블의 DDL을 먼저 정의하고, P3 이후 단계(미션·파트너·결제·동의) 테이블은 골격 + 핵심 컬럼만 명시한다. 모든 테이블은 감사 컬럼(`created_at`, `updated_at`, soft-delete `deleted_at`)을 포함한다.

## 명명 규약

- 테이블·컬럼: `snake_case`, 복수 의미는 단수 테이블명 + 명시적 외래키
- PK: 모든 테이블 `id BIGINT UNSIGNED AUTO_INCREMENT`
- FK: `{관련테이블}_id BIGINT UNSIGNED NOT NULL`
- 감사 컬럼: `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`, `deleted_at TIMESTAMP NULL`
- enum은 `VARCHAR(N)` + CHECK 제약 또는 별도 코드 테이블

## ERD 요약

```
User (1) ─< Student (1) ─< StudentProfile, Activity, ConsentRecord, GapDiagnosis, Roadmap, GeneratedDocument
                                                                              │
                                                                              └─< RoadmapItem >─ RecommendationRationale
User ─< Mentor ─< Mission ─< MissionSubmission ─< AiFeedbackReport, MentorComment
User ─< UniversityAdmin, EnterpriseHr, Admin
ExternalDataSource (cron) ─< RecruitmentOpening, ScheduleItem, CertificationItem
Membership ─< PaymentTransaction; MentorCompensationLedger; SeniorContributionLedger
Mentor ─< MentorTrackHistory; Mentor (1) ─< MentorPayout ─> CommissionRate; User (1) ─ PaymentMethod   ◀ R-8
User ─< PushToken                                                                                      ◀ R-6
University (1) ─< UniversityAdmin (scope: aggregate_only / aggregate_and_individual);
Student.university_consent_scope ∈ {none, aggregate_only, individual}                                  ◀ R-7
SeniorSuccessCase ─< RecommendationModelInput (anonymized k≥5)
AuditLog (cross-cutting), ModerationQueueItem, NotificationPreference, NotificationEvent
```

## P1 핵심 테이블 (DDL)

### `users` — 통합 사용자 계정

```sql
CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NULL,                       -- 소셜 전용 사용자는 NULL
  role            VARCHAR(20)  NOT NULL,                   -- student / mentor / university / enterprise / admin
  email_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at   TIMESTAMP    NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP    NULL,
  CHECK (role IN ('student','mentor','university','enterprise','admin')),
  INDEX idx_users_role (role),
  INDEX idx_users_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### `social_accounts` — 소셜 로그인 연결

```sql
CREATE TABLE social_accounts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  provider      VARCHAR(20) NOT NULL,                      -- google / naver
  provider_uid  VARCHAR(128) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_social (provider, provider_uid),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `refresh_tokens` — 회전 가능한 refresh 토큰

```sql
CREATE TABLE refresh_tokens (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  token_hash    VARCHAR(255) NOT NULL,
  family_id     CHAR(36) NOT NULL,                         -- 회전 가족 식별자
  expires_at    TIMESTAMP NOT NULL,
  revoked_at    TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_family (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `students` — 학생 프로필 (User 1:1)

```sql
CREATE TABLE students (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL UNIQUE,
  university        VARCHAR(120) NOT NULL,
  university_id     BIGINT UNSIGNED NULL,                  -- universities(id) (R-7 권한 매핑)
  major             VARCHAR(120) NOT NULL,
  year_in_school    TINYINT NOT NULL,                      -- 1..6 (포함 휴학년차 가능)
  expected_grad_at  DATE NULL,
  school_email_verified TINYINT(1) NOT NULL DEFAULT 0,
  university_consent_scope VARCHAR(20) NOT NULL DEFAULT 'aggregate_only', -- R-7: none / aggregate_only / individual
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (year_in_school BETWEEN 1 AND 6),
  CHECK (university_consent_scope IN ('none','aggregate_only','individual')),
  INDEX idx_students_university (university_id),
  INDEX idx_students_consent_scope (university_consent_scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `target_jobs` — 학생당 목표 직무 (최대 3, FR-009)

```sql
CREATE TABLE target_jobs (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  industry_code     VARCHAR(40) NOT NULL,
  job_role_code     VARCHAR(80) NOT NULL,
  priority          TINYINT NOT NULL DEFAULT 1,            -- 1..3
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CHECK (priority BETWEEN 1 AND 3),
  INDEX idx_target_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `activities` — 학생 활동 단위 기록

```sql
CREATE TABLE activities (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  category          VARCHAR(40) NOT NULL,                  -- course/project/club/volunteer/contest/external/internship/award/certification
  title             VARCHAR(200) NOT NULL,
  description       TEXT NULL,
  started_at        DATE NOT NULL,
  ended_at          DATE NULL,
  outcome           TEXT NULL,
  source            VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual / import / partner
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_activity_student (student_id),
  INDEX idx_activity_category (category),
  INDEX idx_activity_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `activity_tags` — 활동 자동/수동 태그 (FR-016)

```sql
CREATE TABLE activity_tags (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activity_id   BIGINT UNSIGNED NOT NULL,
  tag           VARCHAR(80) NOT NULL,                      -- 직무 키워드 / 도메인 키워드
  source        VARCHAR(20) NOT NULL DEFAULT 'auto',       -- auto / user
  weight        DECIMAL(4,3) NULL,                         -- 자동 태깅 신뢰도 0..1
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_activity_tag (activity_id, tag),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  INDEX idx_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `gap_diagnoses` — 갭 진단 스냅샷 (FR-007)

```sql
CREATE TABLE gap_diagnoses (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  target_job_id     BIGINT UNSIGNED NOT NULL,
  computed_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  overall_score     DECIMAL(5,2) NOT NULL,                 -- 0..100
  payload_json      JSON NOT NULL,                         -- 충족/부족/우선보완 구조화 데이터
  model_version     VARCHAR(40) NOT NULL,                  -- 추천 엔진 버전
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (target_job_id) REFERENCES target_jobs(id) ON DELETE CASCADE,
  INDEX idx_gap_student (student_id),
  INDEX idx_gap_computed (computed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `roadmaps`, `roadmap_items` — 학생별 로드맵과 항목

```sql
CREATE TABLE roadmaps (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  target_job_id     BIGINT UNSIGNED NOT NULL,
  generated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  model_version     VARCHAR(40) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active', -- active / archived
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (target_job_id) REFERENCES target_jobs(id) ON DELETE CASCADE,
  INDEX idx_roadmap_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE roadmap_items (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  roadmap_id        BIGINT UNSIGNED NOT NULL,
  recommend_type    VARCHAR(30) NOT NULL,                  -- certification / contest / external / internship / project / course
  title             VARCHAR(200) NOT NULL,
  recommend_term    VARCHAR(20) NOT NULL,                  -- '3-1','3-2','4-1','4-2','vacation','any'
  priority_rank     INT NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',-- pending / in_progress / done / skipped
  rationale_id      BIGINT UNSIGNED NULL,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  INDEX idx_item_roadmap (roadmap_id),
  INDEX idx_item_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recommendation_rationales (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  matched_senior_count INT NOT NULL,
  match_score       DECIMAL(5,3) NOT NULL,                 -- 0..1
  sample_confidence DECIMAL(5,3) NOT NULL,                 -- 0..1, k-익명성 기반
  notes             TEXT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE roadmap_items
  ADD CONSTRAINT fk_item_rationale FOREIGN KEY (rationale_id)
  REFERENCES recommendation_rationales(id) ON DELETE SET NULL;
```

**State transitions** (`roadmap_items.status`): `pending` → `in_progress` → `done`; `pending`/`in_progress` → `skipped`; `skipped` → `pending` (재시작 가능). FR-012 요구.

### `recommendation_feedback` — 추천 거부 학습 (FR-014)

```sql
CREATE TABLE recommendation_feedback (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  roadmap_item_id   BIGINT UNSIGNED NOT NULL,
  feedback_type     VARCHAR(20) NOT NULL,                  -- accept / reject / not_relevant
  reason            VARCHAR(200) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (roadmap_item_id) REFERENCES roadmap_items(id) ON DELETE CASCADE,
  INDEX idx_feedback_student (student_id),
  INDEX idx_feedback_type (feedback_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `generated_documents` — 자동 생성 문서 (FR-017~020)

```sql
CREATE TABLE generated_documents (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      BIGINT UNSIGNED NOT NULL,
  doc_type        VARCHAR(20) NOT NULL,                    -- resume / cover_letter / portfolio
  template_code   VARCHAR(40) NOT NULL,
  target_job_id   BIGINT UNSIGNED NULL,
  content_json    JSON NOT NULL,                           -- 인용 활동 ID 포함
  file_url        VARCHAR(500) NULL,                       -- MinIO presigned 또는 영구 키
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (target_job_id) REFERENCES target_jobs(id) ON DELETE SET NULL,
  INDEX idx_doc_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE document_share_links (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id     BIGINT UNSIGNED NOT NULL,
  token_hash      CHAR(64) NOT NULL UNIQUE,                -- URL slug 해시
  expires_at      TIMESTAMP NOT NULL,
  view_limit      INT NULL,
  view_count      INT NOT NULL DEFAULT 0,
  revoked_at      TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES generated_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `job_requirements` — 직무 요구 역량 사전 (FR-007 기준 데이터)

```sql
CREATE TABLE job_requirements (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  industry_code   VARCHAR(40) NOT NULL,
  job_role_code   VARCHAR(80) NOT NULL,
  keywords_json   JSON NOT NULL,                           -- 핵심 키워드 가중치 맵
  notes           TEXT NULL,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_job (industry_code, job_role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `senior_success_cases` — 익명화된 선배 합격 경로 (FR-010, FR-029)

```sql
CREATE TABLE senior_success_cases (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  industry_code       VARCHAR(40) NOT NULL,
  job_role_code       VARCHAR(80) NOT NULL,
  major_group         VARCHAR(80) NOT NULL,                -- 익명화: 대분류만 유지
  graduation_term     VARCHAR(20) NOT NULL,                -- e.g. '2025-1'
  spec_summary_json   JSON NOT NULL,                       -- 시기별 활동·자격증 요약 (식별자 제거)
  k_anonymity_level   INT NOT NULL,                        -- 현재 그룹의 k값
  contributor_token   CHAR(64) NULL,                       -- 익명 기여자 식별 토큰 (Senior Contribution Ledger 연결)
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_senior_job (industry_code, job_role_code),
  INDEX idx_senior_k (k_anonymity_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**제약**: 응용 계층은 `k_anonymity_level >= 5` 행만 추천 풀에 사용. 새 행 적재 시 k 재계산 잡(BullMQ `senior-anonymize-recompute`)이 실행되어 동일 그룹 행들의 k값을 갱신.

## P3+ 단계 테이블 (골격)

### 미션·피드백

```sql
CREATE TABLE mentors (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL UNIQUE,
  industry_code   VARCHAR(40) NOT NULL,
  job_role_code   VARCHAR(80) NOT NULL,
  years_of_exp    INT NOT NULL,
  verified_at     TIMESTAMP NULL,                          -- 운영자 검수 완료
  bio             TEXT NULL,
  available_hours VARCHAR(200) NULL,                       -- 가용 시간대 표현
  mentor_track    VARCHAR(20) NOT NULL DEFAULT 'commission', -- R-8: fixed / commission
  track_changed_at TIMESTAMP NULL,                         -- 트랙 변경 쿨다운(분기당 1회) 산정 기준
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (mentor_track IN ('fixed','commission')),
  INDEX idx_mentors_track (mentor_track)
);

CREATE TABLE missions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_id       BIGINT UNSIGNED NOT NULL,
  industry_code   VARCHAR(40) NOT NULL,
  job_role_code   VARCHAR(80) NOT NULL,
  difficulty      TINYINT NOT NULL,                        -- 1..5
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  rubric_json     JSON NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',    -- draft / pending / active / archived
  approved_at     TIMESTAMP NULL,
  approved_by     BIGINT UNSIGNED NULL,                    -- admin user_id
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
);

CREATE TABLE mission_submissions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mission_id      BIGINT UNSIGNED NOT NULL,
  student_id      BIGINT UNSIGNED NOT NULL,
  submitted_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  review_due_at   TIMESTAMP NOT NULL,                      -- submitted_at + 5영업일
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending / reviewed / reassigned / ai_fallback
  file_url        VARCHAR(500) NULL,
  FOREIGN KEY (mission_id) REFERENCES missions(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  INDEX idx_submission_status (status, review_due_at)
);

CREATE TABLE ai_feedback_reports (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id   BIGINT UNSIGNED NOT NULL UNIQUE,
  payload_json    JSON NOT NULL,
  model_version   VARCHAR(40) NOT NULL,
  generated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES mission_submissions(id) ON DELETE CASCADE
);

CREATE TABLE mentor_comments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id   BIGINT UNSIGNED NOT NULL,
  mentor_id       BIGINT UNSIGNED NOT NULL,
  body            TEXT NOT NULL,
  posted_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES mission_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id)
);

CREATE TABLE mentor_quality_metrics (
  mentor_id       BIGINT UNSIGNED PRIMARY KEY,
  total_reviewed  INT NOT NULL DEFAULT 0,
  avg_review_hrs  DECIMAL(6,2) NULL,
  avg_rating      DECIMAL(3,2) NULL,                       -- 학생 만족도 1..5
  last_active_at  TIMESTAMP NULL,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
);
```

### 외부 데이터·일정·알림

```sql
CREATE TABLE schedule_items (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind            VARCHAR(30) NOT NULL,                    -- certification_exam / contest / external_activity
  title           VARCHAR(200) NOT NULL,
  organizer       VARCHAR(120) NULL,
  open_at         DATE NOT NULL,
  close_at        DATE NOT NULL,
  source          VARCHAR(40) NOT NULL,                    -- partner_feed / public_api / manual
  source_url      VARCHAR(500) NULL,
  fetched_at      TIMESTAMP NOT NULL,
  INDEX idx_schedule_close (close_at),
  INDEX idx_schedule_kind (kind)
);

CREATE TABLE recruitment_openings (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enterprise_id   BIGINT UNSIGNED NULL,
  industry_code   VARCHAR(40) NOT NULL,
  job_role_code   VARCHAR(80) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  open_at         DATE NOT NULL,
  close_at        DATE NOT NULL,
  is_sponsored    TINYINT(1) NOT NULL DEFAULT 0,
  source          VARCHAR(40) NOT NULL,                    -- internal / external_feed
  fetched_at      TIMESTAMP NOT NULL,
  INDEX idx_recruit_role (industry_code, job_role_code),
  INDEX idx_recruit_close (close_at)
);

CREATE TABLE notification_preferences (
  user_id         BIGINT UNSIGNED PRIMARY KEY,
  email_enabled   TINYINT(1) NOT NULL DEFAULT 1,
  inapp_enabled   TINYINT(1) NOT NULL DEFAULT 1,
  digest_frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',  -- daily/weekly/per_event
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notification_events (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  channel         VARCHAR(20) NOT NULL,                    -- email / inapp
  template_code   VARCHAR(60) NOT NULL,
  payload_json    JSON NOT NULL,
  sent_at         TIMESTAMP NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'queued',   -- queued / sent / failed
  retry_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notify_user (user_id, status)
);
```

### 파트너 (대학·기업)

```sql
CREATE TABLE university_partners (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  contract_from   DATE NOT NULL,
  contract_to     DATE NOT NULL,
  seat_count      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE university_admins (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL UNIQUE,
  university_id   BIGINT UNSIGNED NOT NULL,
  department      VARCHAR(120) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (university_id) REFERENCES university_partners(id) ON DELETE CASCADE
);

CREATE TABLE enterprise_partners (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  industry_code   VARCHAR(40) NOT NULL,
  verified_at     TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enterprise_hrs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL UNIQUE,
  enterprise_id   BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (enterprise_id) REFERENCES enterprise_partners(id) ON DELETE CASCADE
);

CREATE TABLE contact_requests (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enterprise_id   BIGINT UNSIGNED NOT NULL,
  student_id      BIGINT UNSIGNED NOT NULL,
  job_posting_id  BIGINT UNSIGNED NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending / accepted / declined / expired
  message         TEXT NULL,
  expires_at      TIMESTAMP NOT NULL,
  responded_at    TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enterprise_id) REFERENCES enterprise_partners(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);
```

### 결제·정산

```sql
CREATE TABLE memberships (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  plan_code         VARCHAR(40) NOT NULL,                  -- monthly / yearly / pkg_*
  status            VARCHAR(20) NOT NULL,                  -- active / canceled / past_due
  billing_key       VARCHAR(255) NULL,                     -- PortOne 빌링키
  current_period_start TIMESTAMP NOT NULL,
  current_period_end   TIMESTAMP NOT NULL,
  auto_renew        TINYINT(1) NOT NULL DEFAULT 1,
  canceled_at       TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE payment_transactions (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  membership_id     BIGINT UNSIGNED NULL,
  purchase_kind     VARCHAR(40) NOT NULL,                  -- subscription / one_off
  amount_krw        INT NOT NULL,
  status            VARCHAR(20) NOT NULL,                  -- approved / failed / refunded
  external_tx_id    VARCHAR(120) NULL,                     -- PortOne imp_uid
  failure_reason    VARCHAR(200) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL,
  INDEX idx_tx_user (user_id),
  INDEX idx_tx_status (status)
);

CREATE TABLE mentor_compensation_ledger (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_id         BIGINT UNSIGNED NOT NULL,
  ref_submission_id BIGINT UNSIGNED NULL,
  amount_krw        INT NOT NULL,
  reason            VARCHAR(100) NOT NULL,
  settled_at        TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id)
);

CREATE TABLE senior_contribution_ledger (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contributor_token CHAR(64) NOT NULL,
  amount_krw        INT NOT NULL,
  reason            VARCHAR(100) NOT NULL,
  settled_at        TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contrib_token (contributor_token)
);
```

### 동의·감사·운영

```sql
CREATE TABLE consent_records (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  consent_type      VARCHAR(40) NOT NULL,                  -- service_use / share_university / share_enterprise / anonymized_dataset / marketing
  agreed            TINYINT(1) NOT NULL,
  policy_version    VARCHAR(40) NOT NULL,
  agreed_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at        TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_consent_user (user_id, consent_type)
);

CREATE TABLE audit_logs (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id     BIGINT UNSIGNED NULL,
  action            VARCHAR(80) NOT NULL,
  target_kind       VARCHAR(60) NOT NULL,
  target_id         BIGINT UNSIGNED NULL,
  meta_json         JSON NULL,
  ip_address        VARCHAR(45) NULL,
  occurred_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor (actor_user_id),
  INDEX idx_audit_target (target_kind, target_id),
  INDEX idx_audit_time (occurred_at)
);

CREATE TABLE moderation_queue_items (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind              VARCHAR(40) NOT NULL,                  -- mission / job_posting / mentor / report
  ref_id            BIGINT UNSIGNED NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',-- pending / approved / rejected
  assigned_admin_id BIGINT UNSIGNED NULL,
  decided_at        TIMESTAMP NULL,
  notes             TEXT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_moderation_status (status)
);
```

## 검증 규칙 (요약)

- **FR-009**: `target_jobs.priority` CHECK 1..3, 학생당 최대 3개. 응용 계층에서 INSERT 시 카운트 검증.
- **FR-013**: 추천 풀 조회는 `senior_success_cases.k_anonymity_level >= 5`로 필터, 만족 안 되면 결과에 `sample_confidence < 0.5` 표시.
- **FR-015**: 추천 매칭 쿼리에는 성별·연령·출신 학교 컬럼을 입력으로 사용하지 않음. `senior_success_cases`도 해당 컬럼 미보유.
- **FR-024**: `mission_submissions.review_due_at = submitted_at + 5 영업일`(애플리케이션 계층 계산), BullMQ `mission-review-sla` 잡이 만료 시 상태 전이.
- **FR-029**: `senior_success_cases` 적재 후 `senior-anonymize-recompute` 잡이 동일 그룹의 k 재계산.
- **FR-031**: 모든 `consent_records.consent_type`에 대해 사용자별 최신 행이 진실. 철회는 `revoked_at` 설정으로 표현, 새 동의는 새 행 추가.
- **FR-034 (R-7)**: `GET /university/dashboard/aggregate`는 `scope = university:aggregate`만 요구. `GET /university/students/{id}/progress`는 `scope = university:individual` AND `students.university_consent_scope = 'individual'` AND `students.university_id = admin.university_id` 3개 조건 모두 통과해야 응답. 통과 시 `audit_logs.action = 'university_view_individual'` 적재 의무.
- **FR-045 (R-8)**: 멘토 트랙 변경(`mentor_track_history` 삽입)은 동일 멘토의 직전 변경 후 90일 미만이면 거부. 정산 잡은 `mentor_payouts.status = 'pending'` 행만 처리하고, 동일 (mentor_id, year, month) 중복 삽입은 UNIQUE 제약으로 차단.
- **R-6 (모바일)**: `push_tokens.is_active = 0` 토큰은 알림 발송에서 제외. 동일 (platform, device_token)는 사용자가 바뀌면 기존 행을 `is_active = 0`으로 만들고 신규 행 삽입.

## 인덱스 전략 요약

- 학생 단위 조회: 모든 학생 소유 테이블에 `idx_*_student (student_id)`.
- 시간 정렬: `idx_*_time` 또는 감사 컬럼.
- 상태 기반 큐: `idx_submission_status`, `idx_moderation_status`.
- 매칭 쿼리: `senior_success_cases (industry_code, job_role_code)` 복합 인덱스.

## P3+ 신규 도메인 (2026-05-22 추가, R-6/R-7/R-8 반영)

### 멘토 정산 (R-8)

```sql
-- 정책: 시기별·트랙별 단가/수수료율. 운영자가 코드 배포 없이 변경.
CREATE TABLE commission_rates (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  track               VARCHAR(20) NOT NULL,                -- fixed / commission
  effective_from      DATE NOT NULL,
  effective_to        DATE NULL,                            -- NULL = 현행
  -- fixed 트랙: 세션 단가
  fixed_session_krw   INT NULL,                             -- 예: 30000 (30분당)
  fixed_session_min   INT NULL,                             -- 예: 30
  -- commission 트랙: 수수료율(베이시스 포인트)
  commission_bps      INT NULL,                             -- 예: 2000 = 20%
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (track IN ('fixed','commission')),
  CHECK (
    (track='fixed'      AND fixed_session_krw IS NOT NULL AND fixed_session_min IS NOT NULL AND commission_bps IS NULL)
    OR
    (track='commission' AND commission_bps IS NOT NULL AND fixed_session_krw IS NULL AND fixed_session_min IS NULL)
  ),
  INDEX idx_rates_track_effective (track, effective_from, effective_to)
);

-- 멘토 트랙 변경 이력 (분기당 1회 쿨다운 검증의 근거)
CREATE TABLE mentor_track_history (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_id       BIGINT UNSIGNED NOT NULL,
  from_track      VARCHAR(20) NULL,                        -- 최초 가입 시 NULL
  to_track        VARCHAR(20) NOT NULL,                    -- fixed / commission
  changed_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by      BIGINT UNSIGNED NOT NULL,                -- users(id) — 본인 또는 admin
  reason          VARCHAR(200) NULL,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_track_history_mentor (mentor_id, changed_at)
);

-- 결제 수단·계좌: 멘토 정산 송금 및 사업자 정보(원천세 3.3% 처리에 필요)
CREATE TABLE payment_methods (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL UNIQUE,         -- 사용자(멘토)당 1개
  bank_code       VARCHAR(10) NOT NULL,
  account_no_enc  VARBINARY(255) NOT NULL,                 -- AES-GCM 암호화
  account_holder  VARCHAR(60) NOT NULL,
  business_no_enc VARBINARY(64) NULL,                      -- 사업자등록번호(개인사업자만)
  is_business     TINYINT(1) NOT NULL DEFAULT 0,
  verified_at     TIMESTAMP NULL,                          -- 1원 인증 완료
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 멘토 월 정산 원장(R-8): mentor_compensation_ledger를 트랙·세션 기반으로 합산한 결과
-- 기존 mentor_compensation_ledger는 세션·미션 단건 적립 원장으로 유지하고,
-- mentor_payouts는 월 단위 정산·송금 단위로 사용.
CREATE TABLE mentor_payouts (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_id         BIGINT UNSIGNED NOT NULL,
  period_year       SMALLINT NOT NULL,                     -- 정산 기간(예: 2026)
  period_month      TINYINT  NOT NULL,                     -- 1..12
  track             VARCHAR(20) NOT NULL,                  -- 정산 시점의 트랙
  gross_krw         INT NOT NULL,                          -- 총액(원천세 공제 전)
  withholding_krw   INT NOT NULL DEFAULT 0,                -- 원천세 3.3%
  net_krw           INT NOT NULL,                          -- 실지급액
  rate_id           BIGINT UNSIGNED NOT NULL,              -- 적용된 commission_rates(id)
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',-- pending / approved / paid / failed
  approved_by       BIGINT UNSIGNED NULL,
  paid_at           TIMESTAMP NULL,
  external_payout_id VARCHAR(120) NULL,                    -- PortOne Payouts id
  failure_reason    VARCHAR(200) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id),
  FOREIGN KEY (rate_id) REFERENCES commission_rates(id),
  UNIQUE KEY uk_payout_period (mentor_id, period_year, period_month),
  INDEX idx_payout_status (status),
  CHECK (track IN ('fixed','commission')),
  CHECK (period_month BETWEEN 1 AND 12)
);
```

### 모바일 푸시 (R-6)

```sql
-- iOS/Android 디바이스 토큰. 단일 사용자가 여러 디바이스 보유 가능.
CREATE TABLE push_tokens (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  platform        VARCHAR(10) NOT NULL,                    -- ios / android / web
  device_token    VARCHAR(500) NOT NULL,                   -- FCM token / APNs token
  app_version     VARCHAR(40) NULL,
  os_version      VARCHAR(40) NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  last_seen_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_push_token (platform, device_token),
  INDEX idx_push_user_active (user_id, is_active),
  CHECK (platform IN ('ios','android','web'))
);
```

### 대학 권한 (R-7)

```sql
-- universities: 라이선스 계약 단위. 이미 P3+ 파트너 섹션에 골격이 있다면 보강.
-- 추가로 권한 매트릭스를 명시.
CREATE TABLE university_admins (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL UNIQUE,
  university_id   BIGINT UNSIGNED NOT NULL,
  scope           VARCHAR(40) NOT NULL,                    -- aggregate_only / aggregate_and_individual
  approved_at     TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (scope IN ('aggregate_only','aggregate_and_individual')),
  INDEX idx_uadmin_university (university_id)
);
```

JWT 발급 시 `university_admins.scope`를 `scope` 클레임으로 변환:
- `aggregate_only` → `["university:aggregate"]`
- `aggregate_and_individual` → `["university:aggregate","university:individual"]`

개인 단위 조회는 추가로 학생 측 `students.university_consent_scope='individual'` AND 학생의 `university_id == admin.university_id` 검증.

---

## Phase 13 신규 도메인 (2026-05-22 `/speckit.analyze` 후속 보강 — C1/C2/C3/C4/C5/C6 대응)

### 학생 개인정보 권리 (FR-004 → C2)

```sql
-- 14.1: 학생의 데이터 내보내기·탈퇴·자동 익명화 요청 처리
CREATE TABLE data_subject_requests (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      BIGINT UNSIGNED NOT NULL,
  action          VARCHAR(20) NOT NULL,                    -- export / delete
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending / processing / ready / expired / canceled / fulfilled
  requested_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fulfilled_at    TIMESTAMP NULL,
  download_url    VARCHAR(500) NULL,                       -- export 시 MinIO presigned URL
  expires_at      TIMESTAMP NULL,                          -- export: 7일, delete: 30일 유예 종료
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_dsr_student (student_id, status),
  INDEX idx_dsr_expires (expires_at)
);

-- 졸업 후 1년 자동 익명화·삭제 스케줄
CREATE TABLE retention_schedule (
  student_id        BIGINT UNSIGNED PRIMARY KEY,
  anonymize_due_at  TIMESTAMP NOT NULL,                    -- 졸업일 + 1년
  notified_90d_at   TIMESTAMP NULL,
  notified_30d_at   TIMESTAMP NULL,
  notified_7d_at    TIMESTAMP NULL,
  extended_until    TIMESTAMP NULL,                        -- 명시적 연장 요청 시
  fulfilled_at      TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_retention_due (anonymize_due_at)
);
```

### 동의 5종 통합 (FR-031 → C4)

```sql
-- 14.2: 동의 카테고리 마스터 (관리자 변경 가능)
CREATE TABLE consent_categories (
  code           VARCHAR(40) PRIMARY KEY,                 -- service_use / university_share / enterprise_share / anonymous_dataset / marketing
  label          VARCHAR(120) NOT NULL,
  is_required    TINYINT(1) NOT NULL DEFAULT 0,           -- service_use=1, 나머지=0
  description    TEXT NULL,
  display_order  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 기존 consent_records 테이블에 category_code 컬럼 추가 (V003에서 정의된 테이블 ALTER)
-- ALTER TABLE consent_records
--   ADD COLUMN category_code VARCHAR(40) NOT NULL AFTER user_id,
--   ADD FOREIGN KEY (category_code) REFERENCES consent_categories(code),
--   ADD INDEX idx_consent_user_category (user_id, category_code, created_at);

-- 시드 행 5건 — 마이그레이션에서 INSERT
-- ('service_use',         '서비스 이용', 1, '...', 1)
-- ('university_share',    '대학 공유 (집계/개인 단계)', 0, '...', 2)
-- ('enterprise_share',    '기업 공유 (채용 노출)', 0, '...', 3)
-- ('anonymous_dataset',   '익명 데이터셋 활용 (추천 풀)', 0, '...', 4)
-- ('marketing',           '마케팅 알림', 0, '...', 5)
```

### 정기 리포트 (FR-026/028 → C3)

```sql
-- 14.3: 분기·학기 종료 시 자동 생성되는 학생 리포트
CREATE TABLE periodic_reports (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      BIGINT UNSIGNED NOT NULL,
  period_kind     VARCHAR(20) NOT NULL,                    -- quarterly / semester_end / year_end
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  payload_json    JSON NOT NULL,                           -- 로드맵 달성률, 완료 활동, 신규 추천 후보, 다가오는 일정
  generated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY uk_report_period (student_id, period_kind, period_end),
  INDEX idx_report_generated (generated_at)
);
```

### 채용 성사·수수료 청구 (FR-040 → C1)

```sql
-- 14.4: 채용 성사 보고와 수수료 청구
CREATE TABLE placements (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  enterprise_id     BIGINT UNSIGNED NOT NULL,
  job_posting_id    BIGINT UNSIGNED NULL,
  start_date        DATE NOT NULL,
  salary_krw        INT NULL,
  contract_kind     VARCHAR(40) NOT NULL,                  -- full_time / internship / contract
  confirmed_by_student_at    TIMESTAMP NULL,
  confirmed_by_enterprise_at TIMESTAMP NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',-- pending / confirmed / canceled
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id),
  INDEX idx_placement_enterprise (enterprise_id, status),
  CHECK (contract_kind IN ('full_time','internship','contract'))
);

CREATE TABLE enterprise_billings (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enterprise_id   BIGINT UNSIGNED NOT NULL,
  placement_id    BIGINT UNSIGNED NOT NULL,
  fee_bps         INT NOT NULL,                            -- 계약별 수수료율(베이시스 포인트)
  fee_krw         INT NOT NULL,                            -- 청구 금액
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',    -- draft / issued / paid / refunded
  invoice_url     VARCHAR(500) NULL,                       -- MinIO PDF 청구서
  issued_at       TIMESTAMP NULL,
  paid_at         TIMESTAMP NULL,
  refunded_at     TIMESTAMP NULL,
  external_invoice_id VARCHAR(120) NULL,                   -- PortOne 결제 ID
  approved_by     BIGINT UNSIGNED NULL,                    -- 운영자 검수
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id),
  FOREIGN KEY (placement_id) REFERENCES placements(id),
  UNIQUE KEY uk_billing_placement (placement_id),
  INDEX idx_billing_status (status)
);
```

### 선배 기여 인센티브 (FR-046 → C6)

```sql
-- 14.5: 선배 보상 적립 원장 + 뱃지 카탈로그
CREATE TABLE senior_reward_ledger (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contributor_token CHAR(64) NOT NULL,                     -- senior_contribution_ledger와 동일 키
  kind              VARCHAR(20) NOT NULL,                  -- cash / credit / badge
  amount_krw        INT NULL,                              -- cash 시
  credit_units      INT NULL,                              -- credit 시
  badge_code        VARCHAR(40) NULL,                      -- badge 시
  reason            VARCHAR(100) NOT NULL,
  accrued_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at        TIMESTAMP NULL,
  CHECK (kind IN ('cash','credit','badge')),
  INDEX idx_senior_reward_token (contributor_token, accrued_at)
);

CREATE TABLE senior_badges (
  code            VARCHAR(40) PRIMARY KEY,                 -- bronze / silver / gold / platinum
  name            VARCHAR(80) NOT NULL,
  criteria_json   JSON NOT NULL,                           -- 예: {"min_contributions": 1, "min_k_anonymity": 5}
  display_order   INT NOT NULL DEFAULT 0
);
```

### 비즈니스 메트릭 측정 (SC-001~SC-020 → C5)

```sql
-- 14.6: 이벤트 트래킹 (파티셔닝 또는 월별 인덱스 필수)
CREATE TABLE analytics_events (
  id              BIGINT UNSIGNED AUTO_INCREMENT,
  event_code      VARCHAR(80) NOT NULL,                    -- 예: student.gap_diagnosis.completed
  user_id         BIGINT UNSIGNED NULL,                    -- 비로그인 이벤트 허용
  properties_json JSON NULL,
  occurred_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id, occurred_at),
  INDEX idx_events_code_time (event_code, occurred_at),
  INDEX idx_events_user_time (user_id, occurred_at)
) PARTITION BY RANGE (UNIX_TIMESTAMP(occurred_at)) (
  -- 운영 시점에 월별 파티션 추가
  PARTITION p_init VALUES LESS THAN (MAXVALUE)
);

CREATE TABLE success_criteria_snapshots (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sc_code         VARCHAR(10) NOT NULL,                    -- SC-001..SC-020
  snapshot_date   DATE NOT NULL,
  numerator       BIGINT NOT NULL,
  denominator     BIGINT NOT NULL,
  ratio_pct       DECIMAL(7,4) NULL,                       -- numerator/denominator * 100
  details_json    JSON NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sc_date (sc_code, snapshot_date)
);
```

---

## 마이그레이션 운영

- 파일명 규약: `V{NNN}__{설명}.sql`, 단방향 적용 + 별도 `R{NNN}__{설명}.sql` 롤백 스크립트.
- 적용 도구: 백엔드 부트 시 자체 마이그레이션 러너(`db/migrate.ts`)가 `schema_migrations` 테이블 기반으로 미적용 파일 순차 실행.
- 운영 환경 적용은 GitLab CI `deploy` 잡에서 수동 승인 단계 후 실행.
