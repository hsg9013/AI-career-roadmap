# Phase 1 Data Model — 003 실연동·안정화

001/002 스키마를 계승하며, 003에서 신규/확장되는 엔티티만 기술한다. 모든 테이블은 `created_at`/`updated_at`(UTC)을 갖고, 민감 컬럼은 컬럼 단위 암호화, 동의·정산은 append-only 이력을 유지한다.

## 1. 직무·산업 사전 (US2 / FR-004, FR-005)

### `industry` (산업)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| code | string, unique | 산업 코드 |
| name | string | 표시명 |
| sort_order | int | 정렬 |
- 규칙: 활성 산업 **10개** 보유(SC-007).

### `job_role` (직무)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| industry_id | FK→industry | 소속 산업 |
| code | string, unique | 직무 코드 |
| name | string | 표시명 |
| is_active | bool | 회원가입 노출 여부 |
- 규칙: 산업당 5직무 내외, 총 **약 50개**. 기존 5직무(IT 4·금융 1) 이관 포함.

### `job_competency` (직무 핵심 역량 키워드)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| job_role_id | FK→job_role | |
| keyword | string | 핵심 역량 키워드 |
| weight | decimal | 진단 가중치 |
- 규칙: 각 활성 직무는 1개 이상 키워드 보유. 갭 진단 기준의 SSOT.

## 2. AI 추론 결과·로그 (US1 / FR-001, FR-002)

### `ai_inference_log`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| feature | enum(diagnosis, roadmap, document, mission_feedback) | 호출 기능 |
| subject_ref | string | 대상(학생·미션 등) 참조 |
| model | string | 사용 모델 ID(Claude …) |
| source | enum(ai, fallback_rule) | 실제 사용 경로 |
| fallback_reason | enum(none, error, timeout, budget) | 폴백 사유 |
| input_tokens / output_tokens | int | 비용 관측 |
| latency_ms | int | 지연 |
| created_at | datetime | |
- 규칙: 모든 AI 기능 호출 1건당 1행. `source=fallback_rule`이면 사용자에게 오류 미노출(SC-006). 결과 페이로드는 민감정보 최소화(참조 위주).

### `ai_budget_counter` (비용 가드)
| 필드 | 타입 | 설명 |
|---|---|---|
| period | enum(day, month) | |
| window_key | string | 기간 키 |
| tokens_used / cost_estimate | int/decimal | 누적 |
- 규칙: 상한 초과 시 신규 AI 호출은 폴백 경로로 라우팅.

## 3. 결제·정산 실거래 (US3 / FR-006, FR-007)

### `payment` (확장)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| user_id | FK | |
| product_type | enum(membership, single) | |
| pg_provider | enum(portone) | |
| pg_tx_id | string, unique | PG 거래 ID(멱등 키) |
| status | enum(pending, paid, failed, canceled, refunded) | |
| amount | decimal | |
| receipt_url | string | 영수증 |
- 상태 전이: pending→paid→(canceled|refunded), pending→failed. 웹훅 재수신은 `pg_tx_id` 멱등으로 중복 무시.

### `settlement` (멘토·선배 정산, 기존 구조 위)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| payee_id | FK | 멘토/선배 |
| basis | enum(fixed, commission) | 정액/수수료 |
| source_ref | string | 미션·결제 참조 |
| amount | decimal | |
| status | enum(accrued, paid) | |
- 규칙: 결제 실연동은 본 정산 구조에 의존(spec 의존성).

### `payment_webhook_event` (멱등·감사)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| pg_event_id | string, unique | |
| payload_hash | string | |
| processed_at | datetime | |

## 4. 알림 발송 (US4 / FR-008, FR-009)

### `notification` (확장)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | event_type, user_id, payload |
| event_type | string | 미션마감·피드백도착·학기말 등 |

### `notification_delivery`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| notification_id | FK | |
| channel | enum(in_app, push, email) | |
| status | enum(queued, sent, failed, skipped) | skipped=채널 off |
| retry_count | int | |
| last_error | string | |
- 규칙: in_app은 항상 sent 보장. push/email 실패는 재시도 후 누락 기록.

### `user_notification_setting`
| 필드 | 타입 | 설명 |
|---|---|---|
| user_id | FK | |
| channel | enum(push, email) | (in_app은 항상 on) |
| enabled | bool | |

## 5. 외부 수집 피드 (US5 / FR-010, FR-011)

### `external_feed_item`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| kind | enum(jobposting, certification, contest) | |
| source | string | 공식 API·제휴 피드 식별자 |
| external_id | string, unique(source 내) | |
| collected_at | datetime | 수집 시각 |
| freshness | enum(fresh, stale) | 기준 기간 초과 시 stale |
| payload | json | 표시 데이터 |
- 규칙: 수집원은 공식 API·제휴 피드만(크롤링 금지). 수집 실패 시 기존 행 유지.

### `feed_collection_run`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| source | string | |
| started_at / finished_at | datetime | |
| status | enum(success, failed) | |
| item_count | int | |

## 6. 계정 연동·검증 (US6 / FR-012, FR-013)

### `social_identity`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| user_id | FK | |
| provider | enum(naver) | |
| provider_uid | string, unique(provider 내) | |
- 규칙: 기존 이메일 계정과 연결 가능, 신규 시 계정 생성.

### `school_email_verification`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| user_id | FK | |
| email | string | `.ac.kr` 만 허용 |
| status | enum(pending, verified, rejected) | |
| verified_at | datetime | |
- 규칙: 비-`.ac.kr` 주소는 rejected. verified면 대학 소속 표시.

## 7. 운영 안정성 메타 (US8 / FR-015~FR-017)

### `backup_run`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| started_at / finished_at | datetime | |
| status | enum(success, failed) | |
| location | string | 백업 저장 위치 |
| size_bytes | bigint | |
- 규칙: 일 1회 이상 success(FR-015). 복구 리허설 결과는 운영 문서/로그로 관리.

### `monitor_alert`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | PK | |
| component | string | db/redis/api/worker 등 |
| severity | enum(warning, critical) | |
| message | string | |
| raised_at / resolved_at | datetime | |
- 규칙: critical 발생 시 운영자 경보 전달(FR-017).

## 무결성·프라이버시 불변식 (전 영역)
- 선배 데이터 기반 개인화 추천은 동일 코호트 **k≥5**에서만(FR-018) → 미달 시 일반 가이드 폴백.
- 추천·매칭 입력에서 성별·나이·출신학교 **제외**(FR-019).
- 민감 컬럼(계좌·주민번호 등) 컬럼 단위 암호화, 동의 변경 append-only.
