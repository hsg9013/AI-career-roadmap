# 발표용 다이어그램 — AI 진로 로드맵 플랫폼 (003 · 004 · 005)

> 각 다이어그램은 **무엇이 핵심인 시스템 표현인지**에 맞춰 작성했습니다.
> - **유스케이스** — 사용자(actor) ↔ 기능(use case) **관계**가 핵심
> - **프로세스(상태 전이)** — 업무 흐름 속 **상태 전이(state transition)**가 핵심
> - **데이터 모델(ERD)** — **데이터 구조**가 핵심
>
> Mermaid 코드블록이라 GitHub · Notion · VS Code · 슬라이드 변환기에서 바로 렌더됩니다.
> 추출본: `docs/diagrams/svg/`, `docs/diagrams/png/`, 묶음 PDF `docs/diagrams/발표자료-AI진로로드맵.pdf`

---

## 1. 유스케이스 다이어그램 — 사용자-기능 관계

6개 actor가 시스템 경계 안의 어떤 기능과 연결되는지(이용 관계)를 보여줍니다. ★ = 005 신규.

```mermaid
flowchart LR
  학생(["👤 학생"]):::actor
  멘토(["🧑‍🏫 멘토"]):::actor
  대학(["🏫 대학"]):::actor
  기업(["🏢 기업"]):::actor
  제휴사(["🤝 제휴사<br/>(교육·활동 플랫폼)"]):::actor
  운영자(["🛠️ 운영자"]):::actor

  subgraph SYS["🎯 AI 진로 로드맵 플랫폼"]
    direction TB
    U1(["목표직무 설정 · 갭진단 · AI 로드맵"])
    U2(["활동 등록 · 미션 제출"])
    U3(["이력서 · 자소서 작성/내보내기"])
    U4(["멤버십 결제 (샌드박스) ★"])
    U5(["외부 피드 조회 · 배너 ★"])
    M1(["배정 제출물 검수 · 피드백 작성 ★"])
    G1(["학생 통계 조회 (동의 범위 내)"])
    E1(["인재 매칭 검색 (동의 학생) ★"])
    E2(["채용 광고 게시"])
    P1(["자체 가입 · 피드물 발행 ★"])
    P2(["배너 관리 · 성과(클릭·전환) 조회 ★"])
    A1(["가입 승인/거절 · 콘텐츠 삭제 · 데모 토글 ★"])
  end

  학생 --- U1
  학생 --- U2
  학생 --- U3
  학생 --- U4
  학생 --- U5
  멘토 --- M1
  대학 --- G1
  기업 --- E1
  기업 --- E2
  제휴사 --- P1
  제휴사 --- P2
  운영자 --- A1

  classDef actor fill:#1f6feb,color:#fff,stroke:#0b3d91,stroke-width:1.5px;
  style SYS fill:#f6f8fa,stroke:#bbb,stroke-width:1.5px;
```

---

## 2. 프로세스(상태 전이) — 미션 제출물 · 멘토 검수

`submissions.state` + `review_assignments.status`의 실제 전이. SLA(영업일) 초과 시 재배정/AI 폴백으로 분기.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> AI검수
  state "AI 1차 검수<br/>state = ai_reviewed" as AI검수
  state "멘토 배정<br/>state = assigned · SLA 영업일 마감" as 배정
  state "재배정<br/>state = reassigned" as 재배정
  state "멘토 검수 완료<br/>review = completed" as 완료
  state "AI 폴백<br/>state = ai_fallback" as 폴백

  AI검수 --> 배정 : 멘토 매칭 (deadline 부여)
  배정 --> 완료 : 멘토 피드백 작성
  재배정 --> 완료 : 대체 멘토 검수
  배정 --> 재배정 : 마감 초과 · 대체 멘토 있음
  배정 --> 폴백 : 마감 초과 · 대체 멘토 없음
  재배정 --> 폴백 : 재차 마감 초과
  완료 --> [*]
  폴백 --> [*]

  note right of AI검수 : 학생 제출 즉시<br/>AI 1차 피드백 생성
  note right of 완료 : 학생은 AI+멘토<br/>피드백 결합 조회
```

---

## 3. 프로세스(상태 전이) — 제휴사 가입 승인 게이트

`partner.status` + 로그인 게이트 `users.is_active`. 승인 전에는 로그인 불가(005 신규).

```mermaid
stateDiagram-v2
  direction LR
  [*] --> 가입대기 : 자체가입 POST /partners/signup
  state "가입 대기<br/>status = pending · is_active = 0" as 가입대기
  state "활성<br/>status = active · is_active = 1" as 활성
  state "거절<br/>status = rejected" as 거절
  state "정지<br/>status = suspended · is_active = 0" as 정지

  가입대기 --> 활성 : 운영자 승인 (로그인 활성화)
  가입대기 --> 거절 : 운영자 거절
  활성 --> 정지 : 운영자 정지
  정지 --> 활성 : 재승인
  거절 --> [*]

  note right of 가입대기 : 승인 전 로그인 불가<br/>(승인 게이트)
  note right of 활성 : /partner-portal 이용<br/>피드물·배너·성과
```

---

## 4. 프로세스(상태 전이) — 결제 · 멤버십

`payments.status` 상태머신(`canTransition` 맵 그대로). `paid` 시 멤버십 30일 활성·등급 변경.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> 대기 : checkout (pending 결제 생성)
  state "결제 대기<br/>pending" as 대기
  state "결제 완료<br/>paid → 멤버십 30일 활성" as 완료
  state "결제 실패<br/>failed" as 실패
  state "취소<br/>canceled" as 취소
  state "환불<br/>refunded" as 환불

  대기 --> 완료 : 승인 · 웹훅 paid<br/>(dev 무키는 즉시 / force_result=success)
  대기 --> 실패 : 실패 · force_result=fail
  완료 --> 취소 : 결제 취소
  완료 --> 환불 : 환불
  실패 --> [*]
  취소 --> [*]
  환불 --> [*]

  note right of 완료 : 등급 변경 반영<br/>(멤버십 활성)
  note right of 실패 : 등급 미변경<br/>(failed 종결)
```

---

## 5. 데이터 모델(ERD) — 인증 · 계정 · 동의

```mermaid
erDiagram
  users ||--o| students : "1:1 프로필"
  users ||--o| mentors : "1:1"
  users ||--o| university_staff : "1:1"
  users ||--o| company_staff : "1:1"
  users ||--o{ partner_account : "로그인 계정"
  partner ||--o{ partner_account : "기관"
  users ||--o{ refresh_tokens : "세션"
  users ||--o{ consent_records : "동의 이력"
  universities ||--o{ university_staff : ""
  companies ||--o{ company_staff : ""

  users {
    bigint id PK
    varchar email UK
    varchar role "student|mentor|university|enterprise|admin|edu_platform"
    tinyint is_active "승인 게이트"
  }
  students {
    bigint user_id FK
    varchar university
    varchar major
    tinyint year_in_school
    varchar university_consent_scope
  }
  partner {
    bigint id PK
    varchar type "edu_platform 등"
    varchar status "pending|active|rejected|suspended"
  }
  partner_account {
    bigint partner_id FK
    bigint user_id FK
  }
  mentors {
    bigint user_id FK
    varchar expertise
  }
```

## 6. 데이터 모델(ERD) — 커리어 성장

```mermaid
erDiagram
  students ||--o{ target_jobs : "목표 직무"
  students ||--o{ activities : "활동 이력"
  students ||--o{ gap_diagnoses : "갭 진단"
  students ||--o{ roadmaps : "로드맵"
  target_jobs ||--o{ roadmaps : ""
  roadmaps ||--o{ roadmap_items : "추천 항목"
  alumni_paths ||--o{ alumni_path_activities : "동문 경로"
  students ||--o{ documents : "이력서/자소서"
  missions ||--o{ submissions : ""
  students ||--o{ submissions : "제출"
  submissions ||--o{ feedbacks : "AI+멘토"
  submissions ||--o| review_assignments : "멘토 배정"

  roadmaps {
    bigint id PK
    varchar source "cohort|fallback"
    varchar cohort_key
    int cohort_size
  }
  roadmap_items {
    varchar title
    varchar rationale "추천 근거"
    decimal score
  }
  feedbacks {
    varchar kind "ai|mentor"
    bigint mentor_id FK
  }
  review_assignments {
    bigint mentor_id FK
    varchar status "pending|completed|reassigned|ai_fallback"
  }
```

## 7. 데이터 모델(ERD) — 수익화 · 제휴 · 광고

```mermaid
erDiagram
  students ||--o{ memberships : "구독"
  users ||--o{ payments : "결제"
  payments ||--o| memberships : ""
  partner ||--o{ partner_banner : "배너"
  partner_banner ||--o{ banner_conversion : "클릭/전환"
  companies ||--o{ job_ad : "채용 광고"
  job_ad ||--o{ job_ad_impression : "노출"
  partner ||--o{ external_feed_item : "발행 source=partner-{id}"
  students ||--o{ paid_service_order : "유료 서비스"

  payments {
    bigint id PK
    varchar kind
    int amount
    varchar status "pending|paid|failed|canceled|refunded"
  }
  memberships {
    varchar plan
    datetime ends_at
    tinyint auto_renew
  }
  partner_banner {
    varchar title
    varchar landing_url
    boolean active
  }
  banner_conversion {
    varchar event "click|convert"
  }
  external_feed_item {
    varchar kind "certification|contest"
    varchar source
    varchar freshness "fresh|stale"
  }
```

---

## 부록 — 발표 시 강조 포인트

| 영역 | 핵심 메시지 |
|------|-------------|
| **유스케이스** | 6개 역할 모두 로그인→고유 기능 동작. 멘토 검수·제휴사 포털이 005 신규 |
| **상태 전이(검수)** | SLA 미준수 시 자동 재배정 → 그래도 안 되면 AI 폴백으로 학생 경험 보장 |
| **상태 전이(가입)** | 자체가입은 pending+is_active=0 → 운영자 승인 게이트 |
| **상태 전이(결제)** | 실제 `canTransition` 상태머신, 비가역 전이(failed/refunded 종결) |
| **ERD** | users 1:1 프로필 분리, 동의 범위(consent_scope) 기반 노출 거버넌스 |
