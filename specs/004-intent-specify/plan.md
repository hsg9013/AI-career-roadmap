# Implementation Plan: AI 커리어 로드맵 플랫폼 — 가치사슬 앞단·생태계·수익 보강 (004)

**Branch**: `004-intent-specify` | **Date**: 2026-06-10 | **Spec**: `/Users/pioneer16/mis2601/specs/004-intent-specify/spec.md`

**Input**: Feature specification from `/specs/004-intent-specify/spec.md` (Clarifications 2026-06-10: 활동·스펙 수기입력 중심·비차단, 파트너 운영자 수동등록, 광고·제휴 자체 슬롯/집계, 직무 미션 직무당 ≥3, 표본 직무당 10, 용어 '기부→합격 경험 공유')

## Summary

001·002로 12개 기능군 **구조**를, 003으로 추천·문서·미션 피드백의 **실연동(AI·결제·알림·외부수집)** 을 채웠다. 004는 그 결과물을 DDBM 최초 기획 캔버스와 다시 대조해 드러난 **가치사슬 앞단(데이터 입력)·설명(추천 근거)·생태계(파트너)·수익 구조**의 잔여 갭(G1~G6)을 메운다. 신규 화면·기능을 더하되, 기존 003 실연동·모노레포 위에서 동작하고, 외부 연동(광고/제휴 정산 등)은 003과 동일하게 "검증 가능한 단위로 점진 활성화·폴백 유지" 원칙을 따른다.

핵심 기술 결정(003 계승 + 004 확정):
- **활동·스펙 기록(G1)**: 기존 `modules/activities` 를 확장하고 보유 스펙(자격증·수상·인턴·아르바이트) 엔티티를 추가. 수기 입력(폼·키워드) 중심, 온보딩 안내·비차단. 진단·로드맵·문서 자동화의 입력으로 연결.
- **직무별 표본 확충(G6)**: `alumni` 합격 경로 표본을 직무당 10건 시드(k≥5 충족). 시연용 임의 계정은 별도 시드.
- **직무 맞춤 미션(G2)**: `modules/missions` 에 직무별 기본 미션 세트(직무당 ≥3) + 멘토 출제 우선 라우팅.
- **로드맵 설명가능성(G3)**: `services/recommendation/gateway.ts`·`roadmap` 의 결과에 평이한 추천 근거(표본 N명·요구역량 비중)와 '가중치' 설명 문구를 부가. 추가 입력 유도.
- **파트너십 생태계(G4)**: `university`·`companies`·`feeds` 모듈 확장 + 운영자 수동 파트너 등록·역할 계정. 동의 범위·권한 분리 적용.
- **수익 구조(G5)**: 멤버십 등급(무료/프리미엄)·기능 게이팅, 실무 단건 과금, 자체 타겟 채용 광고 슬롯, 외부 교육 제휴 배너(내부 클릭/전환 집계), 대학 SaaS 라이선스·기업 채용 수수료.
- **용어 통일**: 선배 데이터 '기부' → '합격 경험 공유'(공유 선배·공유 보상) 전역 치환.

## Network Standards (변경 불가)

| 항목 | 값 |
|---|---|
| 운영 도메인 | `p16.sumzip.com` (HTTPS) |
| 운영 API 베이스 | `https://p16.sumzip.com/api/v1` (nginx 단일 도메인 라우팅) |
| 로컬 웹 (Vite dev) | `http://localhost:9516` |
| 로컬 백엔드 API | `http://localhost:9536/v1` |

위 값은 프로젝트 표준값이며 004에서 변경하지 않는다.

## Technical Context

**Language/Version**: TypeScript 5.x (backend/web/mobile 공통), Node.js 20 LTS — 003 계승

**Primary Dependencies** (004 신규 ★):
- backend: Express 4.x, mysql2, zod, ioredis, bullmq, pino, @aws-sdk/client-s3(MinIO), @portone/server-sdk(003), AI 연동(003) — **004는 신규 외부 SDK 없음**. 멤버십 게이팅·광고/제휴 집계·파트너 등록은 내부 로직.
- frontend-web: Vue 3.4, Vite 5, Pinia 2, axios, openapi-typescript — ★ 활동/스펙 입력 화면, 멤버십 비교표, 추천 채용·제휴 배너 영역, 파트너 콘솔, 추천 근거 표시
- frontend-shared: ★ 활동/스펙·멤버십·근거(rationale) 스토어/타입 추가
- 테스트: Vitest + Supertest(API contract), Playwright(웹 E2E)

**Storage**: MariaDB 10.x(관계형 핵심), MinIO(파일), Redis 7(세션·캐시·BullMQ). 004 추가/확장 테이블: 보유 스펙, 직무 미션 세트, 추천 근거, 멤버십 등급·구독, 실무 과금 항목, 채용 광고 슬롯, 제휴사 배너·전환, 라이선스 계약, 파트너 등록.

**Testing**: Vitest + Supertest(API contract), Playwright(웹 E2E). **동의 기준 광고/제휴 노출·k-익명성·직무 맞춤·용어 통일은 계약/통합 테스트로 강제.**

**Target Platform**: 백엔드 Linux 컨테이너(Docker + nginx); 웹 모던 브라우저 최신 2개; 모바일 iOS 15+/Android 9+ (003 배포 구성 계승).

**Project Type**: web + mobile (단일 백엔드 API + 웹/모바일 빌드 + 공유 패키지)

**Performance Goals** (SC 기준):
- 일반 조회(활동/스펙·목록·멤버십) API p95 < 200ms
- 로드맵 생성(추천 근거 포함) p95 < 2.0s (Claude 호출 포함, 초과 시 폴백)
- 광고/제휴 노출 필터링은 조회 응답성 내 처리

**Constraints**:
- 한국 PIPA·정보통신망법 준수, k-익명성 ≥5 강제, 추천에서 성별·나이·출신학교 배제
- 광고·제휴는 학생 동의·직무 적합성 기준으로만 노출, '광고/제휴' 표기
- 파트너 데이터 제공·SaaS 라이선스는 동의 범위(공유 안 함/통계만/개인 단위)·권한 분리 준수
- 결제(멤버십/단건/수수료) 멱등성·상태 일관성(003 결제 구조 위)
- 활동·스펙은 수기 입력 중심, 외부 시스템 자동 연동은 범위 외
- 초기 한국어만 지원, 네트워크 표준값 불변

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재검토.*

`.specify/memory/constitution.md` 는 미작성 템플릿(플레이스홀더)이라 형식 게이트 위반 없음(N/A). 사실상의 원칙을 자율 게이트로 적용:

- **단일 코드베이스 계승**: 새 프로젝트 없이 001~003 모노레포 위에서 기존 모듈 확장 → ✅
- **테스트로 계약 강제**: 동의 기준 노출·k-익명성·직무 맞춤·용어 통일을 계약/통합 테스트로 검증 → ✅
- **점진 활성화·폴백 필수**: 신규 외부 연동(광고/제휴 정산 등)은 자체 집계로 시작, 외부 연동은 범위 외/추후 → ✅
- **네트워크 표준 불변** → ✅

결론: **PASS** (위반 없음, Complexity Tracking 불필요).

## Project Structure

### Documentation (this feature)

```text
specs/004-intent-specify/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output (004 delta)
├── checklists/
│   └── requirements.md  # /speckit.specify 산출물
└── tasks.md             # /speckit.tasks 산출물 (이 명령에서 생성 안 함)
```

### Source Code (repository root) — 기존 구조 위 004 변경 지점

```text
backend/
├── src/
│   ├── modules/
│   │   ├── activities/          # ★ 활동 이력 + 보유 스펙 입력/조회 확장 (G1)
│   │   ├── gap-diagnosis/       # ★ 활동·스펙을 진단 입력으로 반영 (G1)
│   │   ├── roadmap/             # ★ 추천 근거·'가중치' 설명 부가 (G3)
│   │   ├── documents/           # ★ 활동·스펙 반영 문서 생성 (G1)
│   │   ├── missions/            # ★ 직무별 기본 세트 + 멘토 출제 우선 (G2)
│   │   ├── alumni/              # ★ 표본 직무당 10건 + 용어 '합격 경험 공유' (G6/용어)
│   │   ├── payments/            # ★ 멤버십 등급·기능 게이팅·실무 단건 과금 (G5)
│   │   ├── university/          # ★ SaaS 대시보드·연간 라이선스 (G5/G4)
│   │   ├── companies/           # ★ 채용 성사 수수료·타겟 광고주 (G5/G4)
│   │   ├── ads/                 # ★ 신규: 자체 타겟 채용 광고 슬롯 (G5)
│   │   ├── partners/            # ★ 신규: 파트너 운영자 등록·제휴 배너 (G4/G5)
│   │   └── feeds/               # ★ 교육/활동 플랫폼 콘텐츠 연계 (G4)
│   ├── services/
│   │   ├── recommendation/gateway.ts  # ★ 추천 근거(rationale) 생성·설명 (G3)
│   │   ├── membership.ts        # ★ 신규: 등급·기능 게이팅 SSOT (G5)
│   │   └── ads/                 # ★ 신규: 동의·직무 기준 노출 필터·집계 (G5)
│   ├── db/ (migrations)         # ★ 004 신규/확장 테이블·시드(표본 10/직무, 미션 세트)
│   └── lib/privacy/             # ★ 동의 범위·민감정보 가드 재사용 (003 계승)
frontend-web/                    # ★ 활동/스펙 입력·멤버십 비교표·추천채용/제휴배너·파트너콘솔·추천근거
frontend-shared/                 # ★ 공유 컴포넌트·스토어·타입 갱신
frontend-mobile/                 # ★ 활동/스펙 입력·멤버십 화면 동등 제공
shared/types/                    # ★ OpenAPI delta → 타입 자동 생성
```

**Structure Decision**: web + mobile 단일 백엔드 모노레포(001~003 계승). 004는 신규 디렉터리를 최소화(`modules/ads`, `modules/partners`, `services/membership`, `services/ads`)하고 나머지는 기존 모듈 확장으로 처리한다.

## Implementation Phases (점진 활성화 순서 = spec 우선순위)

| 단계 | 작업영역(US) | 핵심 산출 | 폴백/안전장치 |
|---|---|---|---|
| **A. P1 (즉시 착수)** | US1 활동·스펙 기록 | activities 확장·보유 스펙 엔티티·온보딩/마이페이지 입력 | 비차단(스킵 가능), 빈 입력 시 안내 |
| **A. P1** | US2 표본 확충 | alumni 표본 직무당 10건 시드·k≥5 검증 | 미달 코호트 일반 가이드 폴백 |
| **B. P2** | US3 직무 맞춤 미션 | 직무별 기본 세트(≥3)·멘토 출제 우선 | 멘토 미출제 시 기본 세트 |
| **B. P2** | US4 로드맵 설명가능성 | 추천 근거·'가중치' 설명·추가입력 유도 | 데이터 부족 시 '일반 가이드' 명시 |
| **B. P2(병행)** | US5 파트너십 | university/companies/partners 확장·운영자 등록 | 동의 범위·권한 분리 강제 |
| **C. P3** | US6 멤버십·실무 과금 | 등급·기능 게이팅·단건 수수료(결제 003 위) | 결제 멱등·상태 일관 |
| **C. P3** | US7 타겟 채용 광고 | 자체 광고 슬롯·동의/직무 필터·과금 | 미동의 미노출 |
| **C. P3** | US8 제휴 배너 | 제휴사 배너·클릭/전환 자체 집계 | '광고/제휴' 표기 |
| **D. P4** | US9 B2B/B2G 라이선스 | 대학 SaaS 라이선스·기업 채용 수수료 | 동의·권한 분리 |
| **전 과정** | 용어 통일 | '기부→합격 경험 공유' 전역 치환 | 잔존 0 검증 |

## Complexity Tracking

> Constitution Check 위반 없음 — 본 섹션 해당 없음.
