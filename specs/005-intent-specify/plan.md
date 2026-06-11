# Implementation Plan: AI 커리어 로드맵 플랫폼 — 역할별 실동작·데모 가능성·세션/문서/결제 실구현 (005)

**Branch**: `005-intent-specify` | **Date**: 2026-06-11 | **Spec**: `/Users/pioneer16/mis2601/specs/005-intent-specify/spec.md`

**Input**: Feature specification from `/specs/005-intent-specify/spec.md` (Clarifications 2026-06-11: 합격경험 등록→익명화(k≥5)→로드맵 연계·데모 JSON 스키마, 세션 저장소 복원·로그아웃 즉시 리다이렉트, 파트너별 가입·권한 종속 메뉴, 기업 드롭다운 매칭, 활동 기간 입력, 문서 PDF/Word 실다운로드, 결제 Sandbox/가상 시나리오, 광고·제휴·채용 직무 맞춤 노출)

## Summary

001·002로 12개 기능군 **구조**를, 003으로 추천·문서·미션 피드백의 **실연동(AI·결제·알림·외부수집)** 을, 004로 가치사슬 앞단(활동·스펙 입력)·설명(추천 근거)·생태계(파트너)·수익 구조의 **화면과 구조**를 채웠다. 005는 그 결과물을 다시 점검해 드러난 잔여 갭(H1~H6)을 메우는 단계로, **각 역할이 실제로 무엇을 어떻게 하는지(데모 가능 수준)** 와 **세션 유지·진짜 파일 다운로드·결제 시나리오** 같은 기본 동작을 실제로 작동·시연 가능한 수준으로 완결한다. 신규 화면·기능을 더하되 기존 003 실연동·004 구조·모노레포 위에서 동작하고, 외부 연동(결제 등)은 "검증 가능한 단위로 점진 활성화·폴백 유지" 원칙을 따른다.

핵심 기술 결정(003·004 계승 + 005 확정):
- **합격 경험 공유→로드맵 연계(H1)**: 기존 `modules/alumni`(합격 경험 공유 표본)를 현직자·선배 **등록 흐름**으로 확장. 등록 시 `lib/privacy`(004 계승)로 개인식별정보 제거·직무 코드별 코호트 적재·k-익명성(≥5) 검증. `services/recommendation/gateway.ts`·`roadmap`가 같은 직무 코호트 표본을 근거로 추천 생성(미달 시 일반 가이드 폴백). **데모용 합격 경험 임의 데이터 JSON 스키마**를 정의하고 시드에 적용.
- **인증·세션 안정화(H2)**: 프런트(웹/모바일) 세션 영속화 — 토큰·유저 상태를 `localStorage`(기본)에 저장하고 앱 부팅 시 Pinia 스토어 하이드레이션 → 새로고침 유지. axios 인터셉터가 만료/401 시 저장소 클리어. 로그아웃은 저장소·세션 클리어 후 라우터로 메인(`/`) 즉시 이동. 민감정보는 저장하지 않음(토큰만).
- **파트너별 가입·권한 종속 UI(H3)**: `modules/partners`·`auth`를 파트너 유형별(대학·기업·현직멘토·교육/활동 플랫폼) **가입 양식**으로 확장하고 역할 계정 발급. 웹/모바일 내비게이션을 권한(role) 기반으로 분기(라우터 가드 + 메뉴 필터). 권한 밖 직접 접근 차단(`Forbidden.vue` 재사용).
- **역할별 실동작(H4)**: 기업 인재 검색을 `catalog`(산업·직무 코드) 바인딩 **드롭다운 선택**으로 전환(`companies` 매칭). 멘토 미션 출제·심층 코멘트(`missions`)를 학생 제출물에 연결. 데모 계정 입력→대시보드 점수 산출(`services/metrics.ts`·`profile`·`gap-diagnosis`).
- **활동·문서(H5)**: `modules/activities` 입력에 **기간(시작일·종료일)** 필드 추가(단일일 폐지·종료<시작 거부). `documents` 자동 생성을 **클라이언트 실파일 다운로드**(jsPDF=PDF, docx=Word)로 전환(화면 캡처 아님). 주기적 진척 점검(`services/retention.ts`)으로 누적된 활동 데이터를 문서 입력으로 연결.
- **수익·노출(H6)**: `payments`/`membership`/`paid-services` 결제를 **테스트모드(PortOne/토스 Sandbox) 또는 가상 결제 시나리오**(성공/실패 팝업·등급 변경)로 동작. `ads`/`partners`/`feeds`/`jobpostings` 노출을 **가입자 희망 산업·직무 기준 숨김 없이** 필터·표기('광고/제휴'), 동의·직무 적합성 벗어난 항목 제외.
- **데모 시드**: 학생·멘토·기업 역할별 데모 계정 + 상호 연결(멘토↔학생) + 합격 경험 코호트 시드로 점수·미션·코멘트·매칭·로드맵이 데모에서 재현되게 적재.

## Network Standards (변경 불가)

| 항목 | 값 |
|---|---|
| 운영 도메인 | `p16.sumzip.com` (HTTPS) |
| 운영 API 베이스 | `https://p16.sumzip.com/api/v1` (nginx 단일 도메인 라우팅) |
| 로컬 웹 (Vite dev) | `http://localhost:9516` |
| 로컬 백엔드 API | `http://localhost:9536/v1` |

위 값은 프로젝트 표준값이며 005에서 변경하지 않는다.

## Technical Context

**Language/Version**: TypeScript 5.x (backend/web/mobile 공통), Node.js 20 LTS — 003·004 계승

**Primary Dependencies** (005 신규 ★):
- backend: Express 4.x, mysql2, zod, ioredis, bullmq, pino, @aws-sdk/client-s3(MinIO), @portone/server-sdk(003) — 합격 경험 등록·익명화, 코호트 추천, 드롭다운 매칭, 멘토 미션/코멘트, 데모 점수, 결제 시나리오는 **내부 로직 또는 기존 SDK 테스트모드**로 처리. 신규 백엔드 외부 SDK 없음.
- frontend-web: Vue 3.4, Vite 5, Pinia 2, axios, openapi-typescript — ★ `jspdf`(PDF), `docx`(Word) 클라이언트 문서 생성, 기간(시작~종료) 입력 컴포넌트, 파트너별 가입 폼, 권한 기반 내비게이션, 기업 드롭다운 매칭 화면, 결제 시나리오 팝업, 합격 경험 등록 화면
- frontend-shared: ★ 세션 영속화 스토어(부팅 하이드레이션), 권한 메뉴 정의, 합격 경험·기간·문서 export 타입
- 테스트: Vitest + Supertest(API contract), Playwright(웹 E2E)

**Storage**: MariaDB 10.x(관계형 핵심), MinIO(파일), Redis 7(세션·캐시·BullMQ). 005 추가/확장: 합격 경험 등록·코호트 메타, 활동·스펙 기간(시작/종료) 컬럼, 결제 시나리오 상태·등급 변경 이력, 광고/제휴/채용 매칭 키, 데모 계정 세트·연결, 권한 메뉴 매핑.

**Testing**: Vitest + Supertest(API contract), Playwright(웹 E2E). **k-익명성(≥5)·세션 복원/로그아웃·권한 종속 노출·드롭다운 매칭·기간 검증·문서 실다운로드·결제 시나리오·동의/직무 노출은 계약·통합·E2E 테스트로 강제.**

**Target Platform**: 백엔드 Linux 컨테이너(Docker + nginx); 웹 모던 브라우저 최신 2개; 모바일 iOS 15+/Android 9+ (003·004 배포 구성 계승).

**Project Type**: web + mobile (단일 백엔드 API + 웹/모바일 빌드 + 공유 패키지)

**Performance Goals** (SC 기준):
- 일반 조회(활동/스펙·매칭·노출 목록) API p95 < 200ms
- 로드맵 생성(코호트 근거 포함) p95 < 2.0s (Claude 호출 포함, 초과 시 폴백)
- 세션 복원(부팅 하이드레이션)은 첫 렌더 차단 없이 즉시 처리
- 문서(PDF/Word) 클라이언트 생성·다운로드는 버튼 클릭 후 체감 즉시(수 초 내)

**Constraints**:
- 한국 PIPA·정보통신망법 준수, k-익명성 ≥5 강제, 추천에서 성별·나이·출신학교 배제
- 세션 저장소에는 토큰만 보관(민감정보 금지), 만료·로그아웃 시 즉시 파기
- 권한 밖 메뉴·화면은 노출/접근 모두 차단
- 결제는 테스트모드(Sandbox)/가상 시나리오까지만(실거래·실정산 범위 외), 실제 거래 아님 화면 표기
- 광고·제휴·채용은 학생 동의·직무 적합성 기준으로만 노출, '광고/제휴' 표기
- 합격 경험 데이터의 외부 자동 연동(학교 LMS 등) 범위 외, 수기·데모 시드 중심
- 초기 한국어만 지원, 네트워크 표준값 불변

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재검토.*

`.specify/memory/constitution.md` 는 미작성 템플릿(플레이스홀더)이라 형식 게이트 위반 없음(N/A). 사실상의 원칙을 자율 게이트로 적용:

- **단일 코드베이스 계승**: 새 프로젝트 없이 001~004 모노레포 위에서 기존 모듈 확장(신규 디렉터리 0~최소) → ✅
- **테스트로 계약 강제**: k-익명성·세션·권한·매칭·기간·문서·결제·노출을 계약/통합/E2E 테스트로 검증 → ✅
- **점진 활성화·폴백 필수**: 결제는 Sandbox/가상까지, 코호트 미달 시 일반 가이드 폴백, 멘토 미출제 시 기본 세트 → ✅
- **네트워크 표준 불변** → ✅

결론: **PASS** (위반 없음, Complexity Tracking 불필요).

## Project Structure

### Documentation (this feature)

```text
specs/005-intent-specify/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output (005 delta)
├── checklists/
│   └── requirements.md  # /speckit.specify 산출물
└── tasks.md             # /speckit.tasks 산출물 (이 명령에서 생성 안 함)
```

### Source Code (repository root) — 기존 구조 위 005 변경 지점

```text
backend/
├── src/
│   ├── modules/
│   │   ├── alumni/              # ★ 현직자·선배 합격 경험 '등록' 흐름·코호트 메타 (H1)
│   │   ├── roadmap/             # ★ 같은 직무 코호트 표본 근거 추천·미달 폴백 (H1)
│   │   ├── auth/               # ★ 로그아웃 세션 파기·토큰 만료 처리·파트너 가입 (H2/H3)
│   │   ├── partners/           # ★ 파트너 유형별 가입 양식·역할 계정 발급 (H3)
│   │   ├── companies/          # ★ 인재 검색 산업·직무 드롭다운(catalog) 매칭 (H4)
│   │   ├── missions/           # ★ 멘토 미션 출제·심층 코멘트→학생 연결 (H4)
│   │   ├── activities/         # ★ 활동·스펙 기간(시작/종료) 입력 (H5)
│   │   ├── documents/          # ★ 활동 반영 문서 export 메타(PDF/Word) (H5)
│   │   ├── payments/           # ★ 결제 테스트모드/가상 시나리오·등급 변경 (H6)
│   │   ├── membership/         # ★ 등급 변경 이력·게이팅 (H6)
│   │   ├── ads/                # ★ 채용 광고 직무 맞춤 노출·표기 (H6)
│   │   ├── feeds/ jobpostings/ # ★ 제휴 배너·채용 공고 직무 맞춤 노출 (H6)
│   │   └── catalog/            # 산업·직무 코드(드롭다운 소스) — 기존
│   ├── services/
│   │   ├── recommendation/gateway.ts  # ★ 코호트 기반 추천·근거 (H1)
│   │   ├── metrics.ts          # ★ 데모 계정 입력→대시보드 점수 산출 (H4)
│   │   ├── retention.ts        # ★ 주기적 진척 점검→문서 입력 연결 (H5)
│   │   └── payments/           # ★ 결제 시나리오(성공/실패) 처리 (H6)
│   ├── db/ (migrations·seeds)  # ★ 합격경험 코호트·기간 컬럼·데모 계정 세트·결제 이력 시드
│   └── lib/privacy/            # 동의 범위·익명화·k-익명성 가드 재사용 (003/004 계승)
frontend-web/                   # ★ 합격경험 등록·세션 영속/로그아웃·파트너 가입·권한 메뉴·드롭다운 매칭·기간 입력·문서 다운로드·결제 시나리오·노출
│   └── src/
│       ├── stores/auth         # ★ 세션 부팅 하이드레이션·로그아웃 클리어 (H2)
│       ├── router/guards       # ★ 권한 기반 라우팅·메뉴 필터 (H3)
│       └── lib/export          # ★ jsPDF/docx 문서 생성·다운로드 (H5)
frontend-shared/                # ★ 세션·권한 메뉴·합격경험·기간·export 타입/스토어
frontend-mobile/                # ★ 동등 화면(세션 유지·기간 입력·문서 다운로드·결제 시나리오)
shared/types/                   # ★ OpenAPI delta → 타입 자동 생성
```

**Structure Decision**: web + mobile 단일 백엔드 모노레포(001~004 계승). 005는 **신규 디렉터리 0** — 전부 기존 모듈/서비스 확장과 프런트 스토어/가드/라이브러리 추가로 처리한다(`stores/auth`, `router/guards`, `lib/export`는 프런트 내부 구성). 데모 시연성은 시드와 데모 계정 세트로 확보한다.

## Implementation Phases (점진 활성화 순서 = spec 우선순위)

| 단계 | 작업영역(US) | 핵심 산출 | 폴백/안전장치 |
|---|---|---|---|
| **A. P1 (즉시 착수)** | US1 합격 경험 공유→로드맵 | alumni 등록 흐름·익명화/코호트(k≥5)·recommendation 코호트 근거·데모 JSON 스키마·시드 | 코호트 미달 시 일반 가이드 폴백 |
| **A. P1** | US2 인증·세션 안정화 | 세션 영속(부팅 하이드레이션)·로그아웃 즉시 메인·만료 클리어 | 토큰 무효 시 재로그인 안내, 민감정보 미저장 |
| **B. P2** | US3 파트너별 가입·권한 UI | 파트너 유형별 가입 양식·역할 계정·권한 메뉴 분기·접근 차단 | 권한 밖 노출/접근 0 |
| **B. P2** | US4 역할별 실동작 | 기업 드롭다운 매칭·멘토 미션/코멘트→학생·데모 대시보드 점수 | 매칭 0건 시 조건 안내, 멘토 미출제 시 기본 세트 |
| **B. P2** | US5 활동 기간·문서 다운로드 | 기간(시작/종료) 입력·진척 점검→문서·jsPDF/docx 실다운로드 | 종료<시작 거부, 빈 기록 시 안내 |
| **C. P3** | US6 결제·노출 | 결제 Sandbox/가상 시나리오·등급 변경·광고/제휴/채용 직무 맞춤 노출 | 실거래 아님 표기, 미동의·부적합 미노출 |
| **전 과정** | 데모 시연성 | 데모 계정 세트·연결·코호트 시드 | 데모에서 점수·미션·매칭·로드맵 재현 |

## Complexity Tracking

> Constitution Check 위반 없음 — 본 섹션 해당 없음.
