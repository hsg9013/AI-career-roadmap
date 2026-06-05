# Phase 1 Data Model: AI 기반 진로·취업 로드맵 플랫폼

**Feature**: 002-intent-specify | **Date**: 2026-06-05

spec.md의 14개 Key Entity를 관계형 모델로 확장한다. 표기는 논리 모델이며 실제 컬럼/타입은 마이그레이션에서 확정. 모든 테이블은 `id`(PK), `created_at`, `updated_at` 기본 보유. 민감 컬럼은 AES-GCM 암호화(🔒) 표기.

## 1. User / Role (FR-001~002)

- **users**: email(unique), password_hash, role(`student`|`mentor`|`company`|`university`|`admin`), status, last_login_at
- 역할별 프로필은 1:1 확장 테이블로 분리.

## 2. Student (FR-003)

- **students**: user_id(FK), major, major_field(전공계열), grade(학년), target_jobs(JSON), traits, university_id(FK, nullable), `university_consent_scope`(`none`|`stats`|`individual`)
- **student_skills**: student_id, skill_code, level, source(자격증/프로젝트 등)

## 3. AlumniPath (FR-018~019) 🔒익명화

- **alumni_paths**: anonymized_id, job_code, major_field, grade_band(학년대), success_year, **개인식별자 비저장**
- **alumni_path_activities**: alumni_path_id, period(시기), activity_type, detail
- **cohort_counts**(뷰/집계): (job_code × major_field × grade_band) 별 표본 수 → k-익명성 게이트(≥5)

## 4. GapDiagnosis (FR-004)

- **diagnoses**: student_id, target_job, result(JSON: 충족/부족 역량 항목별), score, diagnosed_at
- 상태: 학생 보유역량 갱신 → 재진단 시 신규 row(이력 보존)

## 5. Roadmap (FR-005~007)

- **roadmaps**: student_id, target_job, generated_at, status(`draft`|`active`|`completed`)
- **roadmap_items**: roadmap_id, period(학년/학기), activity_type, title, rationale, status(`recommended`|`accepted`|`rejected`|`done`)
- **recommendation_rejections**: student_id, item_ref, reason, rejected_at → 이후 추천 음의 가중치

## 6. Activity (FR-008)

- **activities**: student_id, category(auto-classified), title, period, detail, source

## 7. Document (FR-009)

- **documents**: student_id, type(`resume`|`coverletter`|`portfolio`), version, storage_key(MinIO), status
- 파일 본문은 MinIO, 메타만 DB.

## 8. Mission / Submission / Feedback (FR-010~012)

- **missions**: title, job_code, brief, created_by(mentor/admin)
- **submissions**: mission_id, student_id, storage_key, submitted_at, state(`submitted`|`ai_reviewed`|`assigned`|`mentor_reviewed`|`reassigned`|`ai_fallback`)
- **feedbacks**: submission_id, kind(`ai`|`mentor`), mentor_id(nullable), content, created_at
- **review_assignments**: submission_id, mentor_id, deadline(5영업일), status → 초과 시 재배정/AI 대체

## 9. Mentor (FR-017)

- **mentors**: user_id, expertise, `mentor_track`(`flat`|`commission`), verified
- **commission_rates**: scope, rate
- **mentor_payouts**: mentor_id, period, amount, status 🔒
- **payment_methods**: owner_id, account_no🔒, bank, holder🔒

## 10. University (FR-014)

- **universities**: name, contact
- **university_staff**: user_id, university_id, scope_grant(`stats`|`individual`)
- 조회는 학생 `university_consent_scope`와 staff scope의 교집합으로 서버 강제 필터.

## 11. Company (FR-015)

- **companies**: name, biz_no🔒, verified
- **job_match_consents**: student_id, opted_in(bool) → 미동의 학생 매칭 노출 제외

## 12. Consent (FR-021~022) append-only

- **consents**: student_id, consent_type, scope, granted(bool), event_at — **갱신 금지, 이벤트 누적**
- **retention_jobs**: subject_id, due_at, action(`anonymize`|`delete`) → 보존기간 경과 배치 처리

## 13. Payment / Settlement (FR-016~017)

- **payments**: payer_id, kind(`membership`|`one_time`), amount, pg_tx_id, status(`pending`|`paid`|`failed`|`refunded`)
- **memberships**: student_id, plan, started_at, ends_at, auto_renew → 결제 확인 시 권한 활성화
- (정산은 §9 mentor_payouts/alumni 보상과 연결)

## 14. Notification (FR-013)

- **notifications**: user_id, type(`progress_check`|`update_prompt`|`feedback_ready`|...), channel(`push`|`email`|`in_app`), payload, sent_at, read_at

## 15. JobPosting (FR-024)

- **job_postings**: source, title, company, collected_at, freshness(`fresh`|`stale`) → 오래되면 stale 표시

## 16. AlumniReward (FR-018)

- **alumni_rewards**: alumni_user_id, type(`cash`|`credit`|`badge`), amount, granted_at

## 관계 요약

- users 1:1 students/mentors/(university_staff)/companies(담당자)
- students 1:N diagnoses, roadmaps, activities, documents, submissions, consents
- roadmaps 1:N roadmap_items; roadmap_items 추천은 alumni_paths 집계(k≥5) 기반
- missions 1:N submissions 1:N feedbacks; submissions 1:1 review_assignments
- universities 1:N university_staff; students N:1 universities
- companies ↔ students via job_match_consents (동의 학생만)

## 상태 전이

- **submission**: submitted → ai_reviewed → assigned →(기한내)mentor_reviewed | (초과)reassigned → ai_fallback
- **payment**: pending → paid | failed → (refunded)
- **roadmap_item**: recommended → accepted → done | rejected
- **consent**: append-only 이벤트 시퀀스(철회 시 granted=false 이벤트 추가)
