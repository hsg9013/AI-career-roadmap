# 발표용 다이어그램 — AI 진로 로드맵 플랫폼 (003 · 004 · 005)

> 작업물 전체를 발표용으로 정리한 다이어그램 모음입니다.
> Mermaid 코드블록이라 GitHub · Notion · VS Code(Markdown Preview Mermaid) · 슬라이드 변환기에서 바로 렌더됩니다.
> 가독성을 위해 ERD는 도메인별로 3개로 분리했습니다(전체 ~40개 테이블 중 핵심만).

---

## 1. 유스케이스 다이어그램 (역할별 기능 범위)

6개 역할(actor)이 무엇을 할 수 있는지 한눈에 보여줍니다. ★ = 005에서 추가/실동작화된 기능.

```mermaid
flowchart LR
  학생([👤 학생]):::actor
  멘토([🧑‍🏫 멘토]):::actor
  대학([🏫 대학]):::actor
  기업([🏢 기업]):::actor
  제휴사([🤝 교육·활동 플랫폼 제휴사]):::actor
  운영자([🛠️ 운영자/Admin]):::actor

  subgraph 진로성장["진로 성장 핵심 루프"]
    UC1[목표 직무 설정]
    UC2[갭 진단]
    UC3[AI 로드맵 생성·조회]
    UC4[활동 등록·이력 관리]
    UC5[미션 제출]
    UC6[이력서·자소서 작성/내보내기]
  end

  subgraph 멘토링["멘토링"]
    UC7[배정 제출물 조회]
    UC8[피드백 작성 ★]
  end

  subgraph 수익화["수익화 · 외부 연계"]
    UC9[멤버십 결제 - 샌드박스 ★]
    UC10[외부 피드 조회<br/>교육·공모전 ★]
    UC11[배너 클릭/전환]
  end

  subgraph 기관["기관 기능"]
    UC12[학생 통계 조회<br/>동의 범위 내]
    UC13[인재 매칭 검색<br/>동의 학생]
    UC14[채용 광고 게시]
  end

  subgraph 제휴포털["제휴사 포털 ★"]
    UC15[자체 가입 ★]
    UC16[피드물 발행 ★]
    UC17[배너 등록·관리 ★]
    UC18[성과 조회<br/>클릭·전환 ★]
  end

  subgraph 관리["운영"]
    UC19[파트너 가입 승인/거절 ★]
    UC20[제출물·피드물 삭제 ★]
    UC21[AI 데모 토글 ★]
  end

  학생 --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC9 & UC10 & UC11
  멘토 --> UC7 & UC8
  대학 --> UC12
  기업 --> UC13 & UC14
  제휴사 --> UC15 & UC16 & UC17 & UC18
  운영자 --> UC19 & UC20 & UC21

  classDef actor fill:#1f6feb,color:#fff,stroke:#0b3d91,stroke-width:1px;
```

---

## 2. 프로세스 다이어그램

### 2-1. 학생 핵심 성장 루프 (003/004 핵심 가치)

```mermaid
flowchart TD
  A[회원가입/로그인] --> B[목표 직무 설정]
  B --> C[갭 진단<br/>job_requirements 대비 보유역량]
  C --> D{동문 데이터<br/>코호트 충분?}
  D -- "≥5명 코호트" --> E[코호트 기반 AI 로드맵<br/>cohort_key·rationale]
  D -- "부족" --> F[직무 전체 폴백 로드맵]
  E --> G[추천 활동·미션 수행]
  F --> G
  G --> H[활동 등록 / 미션 제출]
  H --> I[AI 피드백 + 멘토 피드백 결합]
  I --> J[이력서·자소서 자동 반영·내보내기<br/>PDF/DOCX]
  J --> C

  classDef hl fill:#dbeafe,stroke:#1f6feb;
  class E,I hl;
```

### 2-2. 제휴사 자체가입 + 운영자 승인 게이트 (005 신규)

```mermaid
sequenceDiagram
  autonumber
  actor P as 제휴사
  participant FE as 가입폼<br/>(PartnerSignup.vue)
  participant API as POST /partners/signup
  participant DB as DB
  actor A as 운영자
  participant ADM as PATCH /admin/partners/:id/status

  P->>FE: 기관명·이메일·비밀번호 입력
  FE->>API: 자체 가입 요청
  API->>DB: partner(status='pending')
  API->>DB: users(role='edu_platform', is_active=0)
  API->>DB: partner_account 연결
  API-->>P: 201 (가입 접수 · 승인 대기)
  Note over P,API: 이 시점에는 로그인 불가 (승인 게이트)

  A->>ADM: 승인(active) 처리
  ADM->>DB: partner.status='active'
  ADM->>DB: users.is_active=1 (로그인 활성화)
  ADM-->>A: 200

  P->>API: 로그인 → /partner-portal
  Note over P: 피드물 발행 · 배너 관리 · 성과 조회 가능
```

### 2-3. 세션 복원 + Refresh 토큰 회전 (005 보안, E2E로 버그 4건 수정)

```mermaid
sequenceDiagram
  autonumber
  participant App as 앱 부팅 (main.ts)
  participant Store as auth store
  participant API as /auth/refresh
  participant R as 라우터 설치

  App->>Store: restoreSession()
  Store->>API: refresh 쿠키 전송 (path '/')
  API->>API: 토큰 검증 + jti(randomUUID) 부여<br/>같은-초 회전 충돌 방지
  API-->>Store: 새 AccessToken (JWT)
  Store->>Store: JWT 디코드 → role 복원
  Store-->>App: 복원 완료
  App->>R: 복원 후 라우터 설치<br/>(보호 라우트 /login 튕김 방지)
  Note over API: 401 시 재-refresh 인터셉터 제외(무한재귀 차단)
```

---

## 3. 데이터 모델 (ERD) — 도메인별 3분할

### 3-1. 인증 · 계정 · 동의

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

### 3-2. 커리어 성장 (진단 · 로드맵 · 미션 · 문서)

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
    varchar status "pending|completed"
  }
```

### 3-3. 수익화 · 제휴 · 광고 (004/005)

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
    varchar status "샌드박스 success/fail"
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
| **역할별 실동작 (005)** | 6개 역할 모두 로그인→고유 기능 동작. 멘토 피드백·제휴사 포털 신규 |
| **AI 로드맵 신뢰성** | 동문 코호트(≥5명) 기반 + 근거(rationale), 부족 시 직무 전체 폴백 |
| **승인 게이트** | 제휴사 자체가입은 `pending`+`is_active=0` → 운영자 승인 전 로그인 차단 |
| **세션 보안** | E2E로 브라우저에서만 드러난 refresh 토큰 버그 4건 발견·수정 |
| **데이터 거버넌스** | 동의 범위(consent_scope)별 대학/기업 노출 제어 |
