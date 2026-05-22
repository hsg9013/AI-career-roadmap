# Phase 0 Research: AI 기반 커리어 로드맵 서비스

**Branch**: `001-ai-career-roadmap` | **Date**: 2026-05-15

본 문서는 `plan.md` Technical Context에서 마킹한 5개 NEEDS CLARIFICATION 항목과 기술 스택 선택의 근거·대안을 정리한다. 결정은 Intent-Plan.md의 기술 스택 제약과 spec.md의 요구사항(특히 한국 PIPA, k-익명성, 5영업일 SLA, 4채널 수익 모델)을 고려해 도출했다.

---

## R-1. AI / 추천 엔진 전략

**Decision**: **외부 LLM API 게이트웨이 + 룰 기반 매칭 하이브리드**. 1차 출시는 OpenAI/Anthropic 등 검증된 LLM API를 백엔드 `services/RecommendationGateway`로 추상화하여 호출. 룰 기반 매칭(직무 키워드·선배 합격 사례의 코사인 유사도)을 1차 필터로 두고, 자유 텍스트 분석·문서 초안 생성에만 LLM을 사용한다.

**Rationale**:
- 콜드 스타트 시 자체 학습 데이터 부족 — 선배 합격 사례가 누적되기 전에는 학습 기반 모델 정확도 보장 어려움.
- 추천 가능 시점(P2 출시)을 단축. 인프라·MLOps 부담 회피.
- 외부 호출은 Gateway로 캡슐화하므로 향후 자체 모델로 점진적 이전 가능.
- 비용·지연 관리는 추천 결과 Redis 캐시(TTL 24h) + 비동기 큐 처리로 흡수.

**Alternatives considered**:
- 자체 학습 모델 호스팅 (예: PyTorch + FastAPI 서비스): 인프라·인력 부담 큼, 1차 출시 일정 지연. 향후 데이터 누적 시 검토.
- 룰 기반만으로 운용: spec FR-009(자동 태깅), FR-017(문서 초안), FR-022(루브릭 분석)의 자연어 처리 요구를 만족시키기 어려움.
- 검색 엔진(OpenSearch) + BM25: 키워드 매칭에는 적합하나 의미 기반 매칭·문서 생성에는 부족.

**구현 메모**:
- 외부 API 키는 .env 분리, 백엔드만 호출(클라이언트 노출 금지).
- 학생의 민감 데이터는 LLM에 전송 시 익명화 처리 후 전송, 응답 캐시는 학생 ID와 매핑하여 재사용.
- 외부 LLM 장애 시 fallback: 룰 기반 추천만 제공 + "AI 강화 분석 일시 중단" 표시.

---

## R-2. 파일 스토리지

**Decision**: **MinIO 자체호스팅(S3 호환)**. 백엔드 컨테이너와 동일 Docker 네트워크에 배치. 라이브러리는 `@aws-sdk/client-s3`(MinIO도 S3 API 호환) 사용.

**Rationale**:
- 팀 인프라가 자체 서버(mis.iptime.org)이므로 외부 클라우드 비용 회피.
- MinIO는 S3 API 호환이므로 향후 AWS S3·NCP Object Storage로 마이그레이션 시 코드 변경 최소.
- 민감 데이터(미션 제출물·이력서 PDF)를 자체 인프라 내에 보관하여 PIPA 위탁 처리 부담 감소.

**Alternatives considered**:
- AWS S3 직접: 비용·외부 의존 발생. 데이터 국외 이전 시 동의 필요.
- 로컬 파일시스템: 컨테이너 재배포 시 데이터 손실 위험. 백업·접근 제어 별도 구현 필요.
- MariaDB BLOB 저장: 1MB 이상 파일 시 DB 부하·백업 비용 급증.

**구현 메모**:
- 버킷 분리: `portfolios/`, `mission-submissions/`, `mentor-attachments/`, `senior-anonymized/`.
- 업로드는 presigned URL로 클라이언트 직접 업로드, 백엔드는 메타데이터만 기록.
- 다운로드는 백엔드 권한 확인 후 presigned URL 발급(만료 시간 15분).

---

## R-3. 결제 게이트웨이

**Decision**: **PortOne(구 아임포트) 통합 결제**. 카드·간편결제(카카오페이·네이버페이·토스)·계좌이체를 단일 SDK로 통합.

**Rationale**:
- 한국 시장 대학생 사용자의 결제 수단 다양성(간편결제·카드) 단일 통합으로 커버.
- spec US9·FR-042~044(멤버십·단건 결제·환불) 모든 흐름을 PortOne 단일 인터페이스로 처리 가능.
- 정산·환불 API와 웹훅 표준 제공으로 자체 회계 처리 단순화.

**Alternatives considered**:
- Toss Payments 직접 연동: 토스 점유율 높으나 카카오페이·네이버페이는 별도 통합 필요.
- 스트라이프 등 해외: 한국 카드사 호환·정산 복잡, 일반적이지 않음.
- PG사(KCP·NICE)와 직접 계약: 운영·기술 부담 큼. 초기 단계에 비효율.

**구현 메모**:
- 멤버십 정기결제는 PortOne 빌링키 발급 + 매월 결제 요청 잡(BullMQ)으로 처리.
- 결제 실패 시 재시도 정책: D+0/D+1/D+3 최대 3회, 이후 권한 정지 후 사용자 안내.
- 결제 웹훅 검증은 서명 헤더로 인증, 멱등성 키로 중복 처리 방지.

---

## R-4. 이메일·알림 발송

**Decision**: **Naver Cloud Outbound Mailer + 백엔드 자체 라우팅**. 일반 알림(마감 임박·정기 리포트)은 Outbound Mailer, 트랜잭션 알림(결제·로그인)은 동일 채널로 통합. 인앱 알림은 자체 DB 기록 + 클라이언트 폴링/SSE로 제공.

**Rationale**:
- 한국 사용자 대상 .ac.kr 도메인 발송 안정성 확보(국내 발송 IP 평판 양호).
- 가격 합리적, 정량 발송 단가 낮음.
- 향후 SMS·알림톡 확장 시 Naver Cloud 라인업으로 일관성 유지.

**Alternatives considered**:
- AWS SES: 가격 저렴하나 .ac.kr 일부 학교 메일 서버에서 스팸 분류 사례 있음.
- 자체 SMTP(Postfix): IP 평판 관리·보안 부담 큼. 운영 인력 부담.
- SendGrid: 글로벌 표준이나 한국 도메인 도달률·가격 면에서 Naver Cloud 대비 우위 없음.

**구현 메모**:
- 메일 템플릿은 백엔드 `lib/mailer/templates/` 디렉토리에 한국어 마크다운으로 관리.
- 사용자별 발송 빈도 제한(예: 동일 알림 1일 1회) 큐 단계에서 적용.
- 발송 실패 로그·재시도(최대 3회, 지수 백오프).

---

## R-5. 인증 토큰 전략

**Decision**: **JWT(액세스) + Refresh Token(DB 저장)**. 액세스 토큰은 15분 단명, refresh 토큰은 30일 + 회전(rotation). HttpOnly·Secure·SameSite=Lax 쿠키.

**Rationale**:
- 멀티 인스턴스 확장 시 서버 세션(메모리/Redis) 대비 stateless 액세스 토큰이 운영 단순.
- Refresh 회전으로 탈취 시 무효화 가능(이전 refresh 사용 시도 시 모든 refresh 무효화).
- 소셜 로그인(Google·Naver) 콜백 후 JWT 발급으로 단일 흐름.

**Alternatives considered**:
- 서버 세션(express-session + Redis): 무효화 즉시 가능하지만 Redis 의존성 증가, 멀티 리전 시 동기화 복잡.
- 액세스 토큰만(no refresh): UX 저하(빈번한 재로그인).
- OAuth2 표준 서버 자체 구축: 과도한 복잡도, 단일 클라이언트(우리 SPA)에는 불필요.

**구현 메모**:
- JWT 서명 키는 .env로 분리, 정기 로테이션 절차 문서화(`infra/SECURITY.md` 향후 작성).
- 권한 클레임: `role`(student/mentor/university/enterprise/admin), `student_id` 등 식별자.
- 비밀번호: bcrypt 비용 12, 로그인 5회 실패 시 5분 잠금.

---

## R-6. 모바일 앱 프레임워크 (2026-05-22 추가)

**Decision**: **Capacitor 6 + Ionic Vue + 기존 Vue 3.4 코드베이스 공유**. 웹·앱이 동일한 Vue 컴포넌트·Pinia 스토어·`shared/types`를 사용하며, 네이티브 기능(푸시·카메라·바이오메트릭)은 Capacitor 공식·커뮤니티 플러그인으로 노출한다. 빌드 산출물은 iOS(Xcode) + Android(Gradle) 두 트랙.

**Rationale**:
- Intent-Plan.md가 강제하는 Vue 3.4 + TS 스택을 그대로 재사용 → 인력·일정 부담 최소.
- 본 서비스의 UI는 로드맵·문서·동영상·차트 중심이며 60fps 게임형 애니메이션이 필요 없어 WebView 기반의 미세한 성능 차이가 사용자 가치에 큰 영향을 주지 않음.
- Ionic Vue가 iOS/Android Material/Cupertino 컴포넌트를 자동 제공 → 플랫폼별 UX 가이드라인 준수 비용 감소.
- 향후 단일 코드베이스로 PWA 모드 동시 제공 가능(웹+앱+오프라인 캐시 일원화).

**Alternatives considered**:
- React Native: 네이티브 성능·생태계 강하나 Vue 자산 재사용 불가, 신규 React 스택 학습 + 별도 디자인 시스템 필요. 인력 부담↑.
- Flutter: 최고 UX/성능이나 Dart 신규 학습, OpenAPI 타입을 별도 생성, Intent-Plan.md의 TS+Vue 제약과 정면 충돌.
- 네이티브 분리(Swift + Kotlin): 1차 일정 내 불가능, 인력 2배.

**구현 메모**:
- 디렉터리: `frontend-web/`(Vite 빌드 → 정적 자산 → nginx) + `frontend-mobile/`(Capacitor 래퍼, `ionic build` 후 `npx cap sync`). 공유 컴포넌트는 `frontend-shared/` 패키지로 분리.
- 라우팅: vue-router 기반 라우터 인스턴스 공유. 모바일은 Ionic의 `IonRouterOutlet`로 스택 네비게이션 적용.
- 푸시: Capacitor Push Notifications + FCM(Android)·APNs(iOS). 백엔드는 `push_tokens` 테이블에 디바이스 토큰 적재 후 `notification_events`에서 분기.
- OTA 업데이트: 1차에는 도입하지 않음(스토어 심사 정책 변동·잠재 리스크 회피). 6개월 이상 운영 후 사용량 데이터 기반 재평가.
- 배포: iOS는 TestFlight → App Store(연 $99), Android는 Internal Testing → Google Play(일회 $25). CI는 `infra/ci/.gitlab-ci.yml`에 `mobile:build:android`, `mobile:build:ios`(macOS 러너 필요) 잡 추가.

---

## R-7. 대학 대시보드 권한 이중화 (2026-05-22 추가, FR-034 갱신 대응)

**Decision**: **두 가지 분리 엔드포인트 + RBAC scope claim + 학생측 차등 동의(`university_consent_scope` 컬럼)**. 대학 관리자 JWT의 `scope` 클레임에 `university:aggregate` 또는 `university:individual` 권한을 부여하고, 백엔드 미들웨어 `middlewares/scopeGuard.ts`가 엔드포인트별 검사. 개인 단위 조회는 학생이 `university_consent_scope = 'individual'`을 명시적으로 부여한 경우에만 응답에 포함.

**Rationale**:
- 단일 엔드포인트 + 응답 마스킹 방식은 권한 누수 시 영향이 큼. 엔드포인트·DB 쿼리 자체를 분리하는 것이 PIPA 최소수집·최소이용 원칙에 부합.
- 개인 단위 조회는 audit_logs에 강제 적재되어 사후 추적 가능.
- 차등 동의(`'aggregate_only'` vs `'individual'`)는 학생이 마이페이지에서 단방향 토글로 관리 가능(즉시 무효화).

**Alternatives considered**:
- 단일 엔드포인트 + 응답 필터링: 권한 코드 한 줄 누락 시 개인정보 노출. 단순하나 위험.
- 별도 마이크로서비스 분리: 1차 단계 과도. 단일 모놀리스 내 모듈 경계로 충분.

**구현 메모**:
- 신규 엔드포인트:
  - `GET /api/v1/university/dashboard/aggregate?cohort=2024&major=경영` — scope `university:aggregate` 필요, k-익명성 5 미만 셀은 자동 마스킹.
  - `GET /api/v1/university/students/{studentId}/progress` — scope `university:individual` + 해당 학생의 `university_consent_scope='individual'` AND 대학 ID 일치 확인.
- DB: `students` 테이블에 `university_consent_scope ENUM('none','aggregate_only','individual') NOT NULL DEFAULT 'aggregate_only'` 컬럼 추가, 변경 시 `consent_records` 적재.
- audit_logs에 `action='university_view_individual'` 적재 의무.

---

## R-8. 멘토 하이브리드 보상 정산 (2026-05-22 추가, FR-045/Assumptions 갱신 대응)

**Decision**: **`mentor_track` 컬럼 + `commission_rates`(정책 테이블) + `mentor_payouts`(정산 원장) 3-테이블 모델**. 멘토는 가입 시 트랙 선택(`fixed` 또는 `commission`), 세션 종료 시 백엔드가 트랙에 따라 분기 계산 → `mentor_payouts`에 적재. 월 마감 시 BullMQ 잡이 정산 합산·송금 요청(PortOne Payouts API).

**Rationale**:
- 두 트랙을 단일 멘토 엔티티에 표현하므로 멘토 풀 통합 관리, 트랙 변경(갱신 주기마다) 시 이력 보존 가능.
- `commission_rates`를 별도 테이블로 두어 운영팀이 코드 배포 없이 수수료율(20%) 또는 정액 단가(30분 30,000원)를 변경 가능.
- PortOne Payouts는 사업자 등록 멘토 대상 정산 표준 제공(원천징수 3.3% 자동 처리).
- 세금: 정액·수수료 모두 인적용역 사업소득(3.3% 원천)으로 처리, 연 1회 종합소득세 자료 발급.

**Alternatives considered**:
- 단일 트랙(수수료만): 장기 계약 멘토 유인 부족, 신규 멘토 유입 둔화.
- 단일 트랙(정액만): 플랫폼 초기 비용 부담, 단위 경제 불리.
- 외부 정산 서비스(예: HR Tech의 프리랜서 정산): 종속성·수수료 추가, 자체 데이터 모델 통제 불가.

**구현 메모**:
- DB 신규 테이블: `mentor_payouts`, `commission_rates`(시기별·트랙별 정책), `payment_methods`(멘토 계좌·사업자 정보 암호화 보관).
- `mentors.mentor_track ENUM('fixed','commission') NOT NULL` + `mentor_track_history` 변경 이력 테이블.
- 멘토 트랙 변경은 분기당 1회로 제한(쿨다운), 시도 시 `mentor_track_history` 검사.
- 정산 잡: 매월 1일 02:00 KST, 직전월 정산 분 일괄 처리 → 운영자 검수 후 송금.

---

## 기술 스택 베스트 프랙티스 요약

| 영역 | 결정 | 핵심 베스트 프랙티스 |
|------|------|----------------------|
| **Vue 3 + Composition API** | Pinia 스토어, `<script setup>` SFC, vue-router 4 | 컴포넌트 단위 단위 테스트(Vitest), 페이지 단위 E2E(Playwright), shared/types로 API 타입 강제 |
| **TypeScript** | `strict: true`, `noUncheckedIndexedAccess`, ESLint + Prettier | 양쪽(front/back) 공통 tsconfig 베이스 + 환경별 오버라이드 |
| **Express 4** | 모듈식 라우터, zod 요청 검증, async 핸들러 wrapper, errorHandler 미들웨어 | helmet, cors(allowlist), rate-limit, csrf(쿠키 사용 시) |
| **mysql2 (Promise pool)** | prepared statement 강제, raw SQL + repository 패턴 | 마이그레이션은 SQL 파일 기반 버전 관리(`db/migrations/V001__init.sql`), 트랜잭션은 connection.beginTransaction() |
| **MariaDB 10.x** | InnoDB, utf8mb4_unicode_ci, FK 강제, ROW-level 감사 컬럼(`created_at`, `updated_at`, `deleted_at`) | 인덱스: 자주 조회되는 외래키와 정렬·필터 컬럼, 익명화 뷰는 별도 스키마 |
| **Redis + BullMQ** | 큐: `mission-review`, `notification`, `external-fetch`, `recommendation-precompute`. 워커는 별도 컨테이너 가능 | 작업 멱등성 키, 실패 큐(`mission-review:failed`), 모니터링: bull-board |
| **Docker** | 멀티 스테이지 빌드(builder → runtime), non-root 유저, healthcheck, 환경 변수는 docker secrets/외부 .env | 이미지 크기 최소화(alpine), 빌드 캐시 활용 |
| **Nginx** | gzip/brotli, 정적 자산 1년 캐시, /api/* 백엔드 프록시, /healthz 라우팅, HTTPS(Let's Encrypt) | rate-limit(이중화), 클라이언트 IP 헤더 신뢰 정책 |
| **GitLab CI/CD** | 단계: lint → unit test → build → integration test → image push → deploy. main 브랜치만 prod 배포, feature 브랜치는 staging | 비밀은 GitLab variables(masked + protected), 자동 롤백 스크립트 보유 |

---

## 위험 및 후속 조치

| 위험 | 영향 | 완화 |
|------|------|------|
| 외부 LLM API 지연·비용 폭증 | 추천 SLA 미달, 단위 경제 악화 | 캐시·룰 기반 fallback, 사용량 모니터링·요청량 상한 |
| MariaDB 단일 인스턴스 장애 | 전 서비스 중단 | 정기 백업, 향후 replica 도입 검토, 백엔드는 짧은 connect timeout + circuit breaker |
| 익명화 우회 위험(준식별자 결합) | PIPA 위반 | k-익명성 자동 검증 배치(일 1회), 새 컬럼 추가 시 익명화 영향 평가 의무 |
| 정기결제 실패율 누적 | 매출 손실, 사용자 이탈 | 결제 실패 사유 모니터링 대시보드, 사용자 알림 자동화 |
| 미션 검수 SLA 미달 | 멘토 풀 부족 시 자주 발생 | AI 보강 피드백 자동화, 멘토 활성도 알림, 운영자 대시보드 |

---

## 결정 요약

| 항목 | 결정 |
|------|------|
| AI 엔진 | 외부 LLM API + 룰 기반 하이브리드 |
| 파일 스토리지 | MinIO 자체호스팅 (S3 호환) |
| 결제 게이트웨이 | PortOne 통합 결제 + Payouts API(멘토 정산) |
| 메일·알림 | Naver Cloud Outbound Mailer + FCM/APNs(모바일 푸시) |
| 인증 | JWT 액세스 + DB Refresh 회전, HttpOnly 쿠키, scope claim 도입 |
| 모바일 앱 (R-6) | Capacitor 6 + Ionic Vue, 기존 Vue 3.4 자산 공유 |
| 대학 권한 (R-7) | 집계/개인 엔드포인트 분리 + `scope` claim + `university_consent_scope` 차등 동의 |
| 멘토 보상 (R-8) | `mentor_track` + `commission_rates` + `mentor_payouts` 3-테이블, PortOne Payouts |

이상 8개 결정으로 Technical Context의 NEEDS CLARIFICATION 항목과 2026-05-22 추가 결정이 모두 해소되었다. Phase 1에서는 data-model.md·contracts/·quickstart.md를 산출한다.
