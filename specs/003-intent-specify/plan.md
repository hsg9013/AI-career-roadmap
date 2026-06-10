# Implementation Plan: AI 커리어 로드맵 플랫폼 — 실연동·안정화 (003)

**Branch**: `003-intent-specify` | **Date**: 2026-06-10 | **Spec**: `/Users/pioneer16/mis2601/specs/003-intent-specify/spec.md`

**Input**: Feature specification from `/specs/003-intent-specify/spec.md` (Clarifications 2026-06-10: 사전 규모 산업 10·직무 ~50, 외부 수집 공식 API·제휴 피드만, AI 제공자 Claude 최신)

## Summary

001·002로 12개 기능군의 **구조**는 완성되어 `p16.sumzip.com`에 라이브로 동작한다. 003은 신규 기능이 아니라 **아직 stub(규칙 기반·시범 데이터·미연동) 수준인 핵심 가치의 알맹이를 실제 동작으로 전환하고, 실연동이 들어오는 만큼 운영 안정성을 끌어올리는** 루프다. 8개 작업영역(US1~US8)을 동일 코드베이스 위에서 진행하며, 외부 연동은 "한 번에 다 켜지 않고 검증 가능한 단위로, 각 연동에 폴백을 둔다"는 원칙으로 점진 활성화한다.

핵심 기술 결정(002 계승 + 003 확정):
- **AI 연동**: 추천·문서·미션 피드백을 **Claude 최신 모델(Opus/Sonnet 4.x, Anthropic SDK)** 로 생성. 기존 `services/recommendation/gateway.ts`의 하이브리드 구조를 유지하되 stub 경로를 실제 LLM 호출로 교체하고, 실패·비용 한도·타임아웃 시 기존 규칙 기반 결과로 자동 폴백.
- **직무·산업 사전**: 산업 10개·대표 직무 약 50개(산업당 5직무 내외)·직무별 핵심 역량 키워드를 시드로 확충. 회원가입 선택지·갭 진단 기준의 단일 출처.
- **결제·정산**: PortOne 실연동(승인/취소/환불 웹훅) + 멘토·선배 정산 위에 결제 흐름 안착.
- **알림 3채널**: 앱 내 알림 + FCM/APNs 푸시 + Naver Cloud 메일, 채널별 사용자 설정 반영.
- **외부 수집**: 공식 오픈API·제휴 피드만 BullMQ 일일 스케줄로 수집, 크롤링 제외, 신선도 표시.
- **소셜 로그인·학교 검증**: 네이버 OAuth + `.ac.kr` 이메일 검증.
- **모바일 배포**: 동일 Capacitor 빌드를 iOS·Android 스토어 배포.
- **운영 안정성**: 일일 백업·24h 복구 절차, 단일 DB SPOF 보완(standby), 모니터링·경보 → 월 99.5%.

## Network Standards (변경 불가)

| 항목 | 값 |
|---|---|
| 운영 도메인 | `p16.sumzip.com` (HTTPS) |
| 운영 API 베이스 | `https://p16.sumzip.com/api/v1` (nginx 단일 도메인 라우팅) |
| 로컬 웹 (Vite dev) | `http://localhost:9516` |
| 로컬 백엔드 API | `http://localhost:9536/v1` |

위 값은 프로젝트 표준값이며 `.env`·`vite.config.ts`·`docker-compose.yml`·`nginx.conf`·OpenAPI `servers`에 동일 적용. 003에서 변경하지 않는다.

## Technical Context

**Language/Version**: TypeScript 5.x (backend/web/mobile 공통), Node.js 20 LTS, Java 17(Android 빌드), Xcode 16 / Swift 5.10(iOS 빌드) — 002 계승

**Primary Dependencies** (003 신규 ★):
- backend: Express 4.x, mysql2, zod, ioredis, bullmq, pino, @aws-sdk/client-s3(MinIO), @portone/server-sdk, **★ @anthropic-ai/sdk(Claude 연동)**, **★ firebase-admin(FCM)·apns2(APNs)**, **★ 네이버 메일/OAuth 연동 클라이언트**
- frontend-web: Vue 3.4, Vite 5, Pinia 2, axios, openapi-typescript
- frontend-mobile: Capacitor 6 + @ionic/vue, **★ @capacitor/push-notifications 실연동**, **★ 스토어 배포 구성(fastlane 등)**
- 테스트: Vitest, Supertest(API), Playwright(웹 E2E), **★ 모바일 E2E(Detox/Maestro) 도입**

**Storage**: MariaDB 10.x(관계형 핵심), MinIO(파일), Redis 7(세션·캐시·BullMQ). 003 추가 테이블: 직무·산업 사전, AI 추론 로그, 결제/정산 실거래, 외부 피드, 알림 발송, 소셜·학교검증, 백업/모니터링 메타.

**Testing**: Vitest + Supertest(API contract), Playwright(웹 E2E), 모바일 E2E 자동화 도입. **폴백 경로·웹훅·k-익명성·민감정보 배제는 계약/통합 테스트로 강제.**

**Target Platform**: 백엔드 Linux 컨테이너(Docker + nginx); 웹 모던 브라우저 최신 2개; 모바일 iOS 15+ / Android 9+(API 28). 003에서 모바일이 스토어 배포로 승격.

**Project Type**: web + mobile (단일 백엔드 API + 웹/모바일 빌드 + 공유 패키지)

**Performance Goals** (SC 기준):
- 로드맵 생성 API p95 < 2.0s (Claude 호출 포함, 초과 시 폴백)
- 일반 조회 API p95 < 200ms
- 모바일 콜드 스타트 < 3s, 푸시 도달 p95 < 5s
- 월 가용성 ≥ 99.5%, 핵심 데이터 24h 내 복구(일일 백업)

**Constraints**:
- 한국 PIPA·정보통신망법 준수, k-익명성 ≥5 강제, 추천에서 성별·나이·출신학교 배제
- 외부 수집은 공식 오픈API·제휴 피드만(크롤링 금지 — ToS·법적 위험)
- AI 연동은 비용 한도·타임아웃·실패 시 100% 규칙 기반 폴백, 폴백 발생 관측(로그/지표)
- 민감 컬럼 컬럼 단위 암호화, 동의 변경 append-only, 결제 멱등성(웹훅 재수신 대비)
- 미션 검수 SLA 5영업일, 초기 한국어만 지원, 네트워크 표준값 불변

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재검토.*

`.specify/memory/constitution.md`는 채워지지 않은 템플릿(플레이스홀더)으로, 비준된 강제 원칙이 정의돼 있지 않다. 따라서 형식적 게이트 위반은 없음(N/A). 단, 프로젝트가 일관되게 지켜온 사실상의 원칙을 자율 게이트로 적용한다:

- **단일 코드베이스 계승**: 새 프로젝트를 만들지 않고 001/002 모노레포 위에서 stub 교체 → ✅ 통과
- **테스트로 계약 강제**: 폴백·웹훅·익명화·민감정보 배제를 계약/통합 테스트로 검증 → ✅ 통과
- **점진 활성화·폴백 필수**: 외부 연동마다 안전한 대체 동작 보유 → ✅ 통과
- **네트워크 표준 불변** → ✅ 통과

결론: **PASS** (위반 없음, Complexity Tracking 불필요).

## Project Structure

### Documentation (this feature)

```text
specs/003-intent-specify/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (openapi delta)
│   └── openapi.yaml
├── checklists/
│   └── requirements.md  # /speckit.specify 단계 산출물
└── tasks.md             # /speckit.tasks 산출물 (이 명령에서 생성 안 함)
```

### Source Code (repository root) — 기존 구조 위 003 변경 지점

```text
backend/
├── src/
│   ├── modules/
│   │   ├── auth/                 # ★ 네이버 OAuth · .ac.kr 학교 이메일 검증
│   │   ├── gap-diagnosis/        # ★ 진단 기준을 직무·산업 사전 연동으로
│   │   ├── roadmap/              # ★ 추천 LLM 실연동
│   │   ├── documents/            # ★ 문서 생성 LLM 실연동
│   │   ├── missions/             # ★ AI 1차 피드백 + 현직자 결합
│   │   ├── payments/             # ★ PortOne 실연동(승인/취소/환불 웹훅)·정산
│   │   ├── notifications/        # ★ 3채널(앱/푸시/메일) + 채널 설정
│   │   ├── jobpostings/          # ★ 공식 API·제휴 피드 수집·신선도
│   │   └── catalog/              # ★ 신규: 직무·산업 사전(산업10·직무~50)
│   ├── services/
│   │   ├── recommendation/gateway.ts  # ★ stub→Claude, 폴백 라우팅
│   │   ├── ai/                   # ★ 신규: Anthropic 클라이언트·프롬프트·비용가드·폴백
│   │   ├── payments.ts           # ★ 실거래 로직
│   │   └── notifications/        # ★ 발송 어댑터(FCM/APNs/Naver Mail)
│   ├── queues/ · workers/        # ★ 외부수집 스케줄·알림 발송·정산 잡
│   ├── db/ (migrations)          # ★ 003 신규 테이블·인덱스
│   └── lib/health.ts             # ★ 모니터링·헬스·백업 메타
├── ops/                          # ★ 신규: 백업·복구·standby·모니터링 스크립트/문서
infra/                            # ★ docker-compose·nginx: standby/모니터링 반영
frontend-web/                     # ★ 회원가입 사전 선택지·결제·알림설정·네이버 로그인 UI
frontend-mobile/                  # ★ 푸시 실연동·스토어 배포 구성
frontend-shared/                  # ★ 공유 컴포넌트·스토어 갱신
shared/types/                     # ★ OpenAPI delta → 타입 자동 생성
```

**Structure Decision**: web + mobile 단일 백엔드 모노레포(001/002 계승). 003은 신규 디렉터리를 최소화하고(`modules/catalog`, `services/ai`, `backend/ops`) 나머지는 기존 모듈의 stub 경로 교체로 처리한다.

## Implementation Phases (점진 활성화 순서 = spec 우선순위)

| 단계 | 작업영역(US) | 핵심 산출 | 폴백/안전장치 |
|---|---|---|---|
| **A. P1 (즉시 착수)** | US2 직무·산업 사전 | catalog 모듈·시드(10/50)·진단 연동 | 외부 의존 없음 |
| **A. P1** | US1 AI 실연동 | services/ai, gateway 교체 | 실패·한도·타임아웃→규칙 기반 100% 폴백 |
| **B. P2** | US3 결제·정산 | PortOne 웹훅·멱등·정산 | 테스트 모드 우선, 상태 불일치 자동 정정/보류 |
| **B. P2(병행)** | US8 운영 안정성 | 일일 백업·24h 복구·standby·모니터링 | 복구 리허설로 검증 |
| **C. P3** | US4 알림 3채널 | FCM/APNs·Naver Mail·채널설정 | 앱 내 알림 보장, 실패 채널 재시도·기록 |
| **C. P3** | US5 외부 수집 | 공식 API·제휴 피드 일일 잡·신선도 | 수집 실패 시 기존 데이터 유지·'최신 아님' |
| **C. P3** | US6 소셜·학교검증 | 네이버 OAuth·.ac.kr 검증 | 기존 이메일 로그인 유지 |
| **D. P4** | US7 모바일 배포 | iOS/Android 스토어 빌드·심사 | 반려 시 웹 운영 무영향 |

## Complexity Tracking

> Constitution Check 위반 없음 — 본 섹션 해당 없음.
