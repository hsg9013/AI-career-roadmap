# Phase 0 Research: 005 — 역할별 실동작·데모 가능성·세션/문서/결제 실구현

본 문서는 005 Technical Context의 미결 항목을 해소한다. 005는 신규 기반을 만들지 않으므로(003 실연동·004 구조 계승) 연구는 "어떤 방식으로 실동작·데모화하느냐"의 결정에 집중한다.

## R1. 합격 경험 공유 → 코호트 익명화 → 로드맵 연계 (H1)

- **Decision**: 현직자·선배가 `modules/alumni`의 등록 흐름으로 익명화 이력서·포트폴리오·활동 경로를 제출 → 백엔드가 `lib/privacy`(004 계승)로 개인식별정보 제거 후 **직무 코드별 코호트**로 적재 → `services/recommendation/gateway.ts`가 같은 직무 코호트(표본 ≥5)를 근거로 로드맵 추천 생성. 코호트가 5 미달이면 일반 가이드로 폴백.
- **Rationale**: alumni 표본·k-익명성·추천 게이트웨이가 003/004에 이미 존재 → 신규 인프라 없이 "등록 흐름 + 코호트 메타"만 추가하면 됨. k≥5는 spec·기존 거버넌스와 일치.
- **Alternatives considered**: (a) 별도 신규 모듈 — 중복·복잡, 기각. (b) 원본 문서 그대로 추천 노출 — 익명성 위반, 기각.

## R2. 데모용 합격 경험 임의 데이터 JSON 스키마 (H1, item5)

- **Decision**: 데모·시드용 합격 경험 1건의 형식을 다음 골격으로 정의(구현 시 확정):
  ```json
  {
    "job_code": "string (catalog 직무 코드)",
    "industry_code": "string (catalog 산업 코드)",
    "admit_year": "number",
    "anonymized": true,
    "timeline": [
      { "term": "1-1 | 1-2 | 2-1 ...", "type": "certificate|contest|intern|project|club|volunteer", "title": "string", "start": "YYYY-MM", "end": "YYYY-MM" }
    ],
    "resume_summary": "string (PII 제거)",
    "portfolio_highlights": ["string"],
    "skills": ["string (직무 역량 키워드)"]
  }
  ```
- **Rationale**: catalog 직무/산업 코드와 정합, 기간(start/end)으로 H5와 일관, PII 필드 부재로 익명화 강제. 시기별 timeline이 로드맵 추천의 근거 단위가 됨.
- **Alternatives considered**: 자유 텍스트 단일 필드 — 코호트 집계·추천 근거화 불가, 기각. 구체 필드 확정은 구현 단계(`/speckit.tasks` 이후)로 미룸.

## R3. 인증·세션 영속화·로그아웃 (H2)

- **Decision**: 토큰을 `localStorage`(키 1개)에 저장, 앱 부팅 시 Pinia `stores/auth`가 저장소→스토어 하이드레이션 후 라우터 진입 → 새로고침(F5)에도 상태·화면 유지. axios 응답 인터셉터가 401/만료 감지 시 저장소·스토어 클리어 후 로그인/메인 유도. 로그아웃 액션은 저장소·세션 클리어 → `router.replace('/')`로 즉시 메인 이동. 저장은 **토큰만**(유저 프로필 등 민감정보 미저장, 필요 시 부팅 후 재조회).
- **Rationale**: 토큰 기반 인증은 003에서 채택됨. localStorage 하이드레이션은 SPA 새로고침 유지의 표준 패턴이며 추가 의존성 0. "원래 있던 화면 유지"는 라우터가 현재 URL을 유지하고 가드가 복원된 세션으로 통과시키면 자동 충족.
- **Alternatives considered**: (a) sessionStorage — 탭 닫으면 소실, 새로고침은 유지되나 데모 연속성 약함 → localStorage 기본, 옵션 제공. (b) 쿠키(HttpOnly) — 더 안전하나 003 토큰 헤더 구조 변경 비용, 005 범위에선 과함. (c) 유저 객체까지 저장 — 민감정보 노출 위험, 기각.

## R4. 파트너별 가입·권한 종속 UI (H3)

- **Decision**: `modules/partners`/`auth`에 파트너 유형(university·company·mentor·edu_activity_platform)별 가입 엔드포인트·양식 필드를 분기하고 역할 계정을 발급. 프런트는 역할→허용 메뉴 매핑(`frontend-shared`)을 단일 출처로 두고, 라우터 가드가 비허용 경로를 `Forbidden`으로 차단, 내비게이션은 허용 메뉴만 렌더.
- **Rationale**: 역할 5종(학생·현직자·기업·대학·운영자)이 이미 존재 → 파트너 유형 가입 양식과 메뉴 매핑만 추가하면 권한 종속이 성립. `Forbidden.vue`가 이미 있음.
- **Alternatives considered**: 셀프 가입 전면 개방 — 004 클라리피케이션(운영자 수동 등록)과 충돌 가능하나, 005는 파트너 '가입 가능' 요구이므로 가입 양식 제공 + 운영자 승인/발급 병행으로 절충.

## R5. 기업 인재 검색 드롭다운 매칭 (H4, item6)

- **Decision**: 인재 검색 입력을 자유 텍스트에서 `catalog`(산업·직무 코드) 바인딩 **드롭다운 2단(산업→직무)** 으로 교체. `companies` 매칭이 선택된 코드로 학생 풀을 필터.
- **Rationale**: catalog 직무/산업 사전이 003에서 확충됨 → 드롭다운 소스로 즉시 사용. 코드 기반 매칭은 오타·표기 흔들림 제거.
- **Alternatives considered**: 자유 텍스트 + 자동완성 — 여전히 비정합 입력 허용, spec이 "텍스트 입력이 아니라 드롭다운"을 명시 → 기각.

## R6. 멘토 미션 출제·심층 코멘트 연결 (H4, item7)

- **Decision**: `missions`에 멘토 출제(직무별) + 학생 제출물에 심층 코멘트 작성 흐름을 명확화하고, 데모에서 멘토 계정↔학생 계정을 시드로 연결해 출제·코멘트가 학생 화면에 표시되게 함.
- **Rationale**: 004에서 직무 미션 세트·멘토 출제 우선 구조가 있음 → 005는 "코멘트→학생 연결"과 데모 연결을 보강.

## R7. 데모 계정 대시보드 점수 (H4, item8)

- **Decision**: 데모 계정으로 입력한 활동·스펙·진단을 `services/metrics.ts`가 집계해 대시보드 점수로 산출. 데모 계정 생성→데이터 입력→점수 반영 경로를 시드와 통합 테스트로 보장.
- **Rationale**: metrics 서비스가 존재 → 데모 계정이 일반 사용자와 동일 경로로 점수가 나오게 하는 게 핵심(데모 특례 분기 최소화).

## R8. 활동·스펙 기간(시작~종료) 입력 (H5, item9)

- **Decision**: `activities`(및 보유 스펙) 레코드에 `start_date`·`end_date` 컬럼을 두고, 단일일 입력을 폐지. 프런트는 기간 입력 컴포넌트(시작~종료)로 받고 `end < start`를 거부. 진행중(종료일 미정)은 `end_date = null` 허용.
- **Rationale**: 활동·인턴·프로젝트는 본질적으로 기간 데이터 → 시기별 로드맵·문서 정합. 추가 의존성 없이 폼·검증으로 처리.
- **Alternatives considered**: 무거운 캘린더 라이브러리 도입 — 과함, 네이티브 date input + 범위 검증으로 충분.

## R9. 진짜 문서 다운로드 PDF/Word (H5, item10·12)

- **Decision**: 자동 문서 생성을 **클라이언트 측 파일 생성**으로 구현 — PDF는 `jspdf`, Word(.docx)는 `docx` 라이브러리로 생성해 버튼 클릭 시 브라우저 다운로드. 백엔드는 문서 데이터(활동·스펙 누적)를 제공하고, export 메타(유형·포맷·생성시각)만 기록. 누적된 진척 점검 데이터가 입력이 됨(item12).
- **Rationale**: spec이 jsPDF·docx 경량 라이브러리를 명시. 클라이언트 생성은 서버 렌더 인프라(헤드리스 브라우저 등) 없이 즉시 다운로드 가능. 화면 캡처 방식 제거.
- **Alternatives considered**: 서버 PDF 렌더(Puppeteer 등) — 인프라·성능 비용 큼, 과제 범위 초과 → 기각.

## R10. 결제 테스트모드/가상 시나리오 (H6, item13)

- **Decision**: 결제를 PortOne(003 도입) **테스트모드(Sandbox)** 또는 가상 결제 시나리오 모듈로 동작. 결제 성공→`membership` 등급 변경·이력 기록, 실패→실패 시나리오 팝업·등급 불변. 모든 결제 화면에 "실제 거래 아님" 표기. 토스페이먼츠는 대안 Sandbox로 표기만 하고 PortOne 경로 우선.
- **Rationale**: 003 결제 구조 위에서 키만 테스트모드로 두면 실거래 없이 전 흐름 시연 가능. 가상 시나리오는 키 없이도 데모 가능한 폴백.
- **Alternatives considered**: 실 PG 라이브 연동 — 과제 범위·정산 책임 초과, spec이 명시적으로 범위 외.

## R11. 광고·제휴·채용 직무 맞춤 노출 (H6, item14)

- **Decision**: `ads`(채용 광고)·`feeds`/`partners`(제휴 배너)·`jobpostings`(채용/인턴십)에 산업·직무 매칭 키를 두고, 노출 대상 계정에서 **가입자 희망 산업·직무 기준으로 숨김 없이** 필터해 노출하며 '광고/제휴' 표기. 학생 동의·직무 적합성을 벗어난 항목은 제외.
- **Rationale**: 004에서 광고/제휴/채용 모듈·자체 집계가 구축됨 → 005는 "직무 맞춤·숨김 없음" 노출 규칙과 표기를 확정.
- **Alternatives considered**: 외부 광고 네트워크 연동 — 범위 외(004·005 동일), 자체 슬롯만.

## 종합

모든 NEEDS CLARIFICATION 항목은 위 결정으로 해소됨(잔여 0). 신규 백엔드 외부 SDK 없음 — 프런트 `jspdf`·`docx`만 신규 의존성. 데모·시드와 테스트모드로 "시연 가능성"을 1급 목표로 보장.
