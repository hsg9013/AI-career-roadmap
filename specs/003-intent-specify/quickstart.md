# Quickstart — 003 실연동·안정화

001/002와 동일 모노레포. 003은 기존 stub을 실연동으로 교체하는 작업이므로, 외부 연동 키 없이도 **폴백 경로로 전부 동작**해야 한다(키가 있으면 실연동 활성화).

## 1. 사전 준비
```bash
# 인프라(OrbStack docker): MariaDB 3306 / Redis / MinIO
# (DB가 죽어 있으면 OrbStack부터 기동)
pnpm install
pnpm migrate:up           # 003 신규 테이블 적용
pnpm gen:types            # contracts/openapi.yaml → shared/types
```

## 2. 환경변수(.env) — 003 신규 (미설정 시 폴백/비활성). **실제 구현 키 기준**
| 변수 | 용도 | 미설정 시 |
|---|---|---|
| `LLM_API_KEY` / `LLM_MODEL` / `LLM_PROVIDER` | Claude 연동 | 규칙 기반 폴백(`source=fallback_rule`, reason=`no_credentials`) |
| `LLM_TIMEOUT_MS` / `LLM_MAX_TOKENS` | 호출 가드 | 8000ms / 1024 |
| `AI_DAILY_TOKEN_BUDGET` | 비용 가드(일 토큰 상한) | 0=무제한(개발) |
| `PORTONE_IMP_KEY` / `PORTONE_IMP_SECRET` | 결제·웹훅 서명 | dev 즉시승인·서명검증 우회 |
| `FCM_SERVER_KEY` / `APNS_*` | 푸시 | 시뮬레이션 sent(앱 내 알림은 항상) |
| `MAILER_PROVIDER` / `MAILER_API_KEY` | 이메일 | 콘솔 메일러 |
| `OAUTH_NAVER_CLIENT_ID` / `OAUTH_NAVER_CLIENT_SECRET` | 소셜 로그인 | dev 합성 프로필(이메일 로그인 유지) |
| `WEB_BASE_URL` | 학교 이메일 확인 링크 | `https://p16.sumzip.com` |
| `FEED_JOBPOSTING_URL` / `FEED_CERTIFICATION_URL` / `FEED_CONTEST_URL` | 공식 API·제휴 피드 | dev 샘플 수집(기존 데이터 유지) |
| `FEED_STALE_AFTER_DAYS` / `FEED_COLLECT_INTERVAL_MS` | 신선도·수집 주기 | 14일 / 24h |

> 네트워크 표준값(도메인·포트)은 변경 금지. `.env`는 추적 대상.
> 마이그레이션: 003 신규 테이블은 `V017`~`V025` (catalog·ai_inference·payment 실거래·notification_delivery·social/school·external_feed).

## 3. 기동
```bash
pnpm dev          # backend(9536) + web(9516) + worker
# 운영 도메인: https://p16.sumzip.com (nginx → 9516)
```

## 4. 검증 시나리오 (수용 기준 매핑)
1. **AI 폴백(US1/SC-006)**: `ANTHROPIC_API_KEY` 없이 `/gap-diagnosis` 호출 → `source=fallback_rule`로 정상 응답. 키 설정 후 → `source=ai`.
2. **사전 확충(US2/SC-007)**: `/catalog/industries` 10개, 각 산업 `/jobs`에 키워드 보유, 합계 ~50직무.
3. **결제 멱등(US3)**: `/payments/checkout`→웹훅 2회 수신 시 1회만 반영(멱등).
4. **알림 채널(US4)**: 이메일 off 설정 후 이벤트 발생 → email `skipped`, in_app `sent`.
5. **수집 신선도(US5)**: 수집 잡 실행 → `freshness=fresh`, 기준 기간 초과 항목 `stale` 표시. 수집 실패 시 기존 데이터 유지.
6. **소셜·학교검증(US6)**: 네이버 코드로 로그인, `.ac.kr` 검증 발송, 비-`.ac.kr` 422.
7. **모바일(US7/SC-012)**: 모바일 빌드에서 로그인→진단→로드맵→미션 동작 + 푸시 수신.
8. **운영 안정성(US8/SC-011)**: `/ops/health` 구성요소 상태·`lastBackupAt` 노출, 일일 백업 success, 복구 리허설 24h 내.

9. **관측(Polish/T053)**: 관리자 토큰으로 `GET /v1/ops/metrics` → 폴백률·결제/발송/수집 성공률·미해결 critical 경보·`lastBackupAt` + 사업 KPI(eventCounts) 집계.

## 5. 테스트
```bash
pnpm test                 # Vitest(단위) + Supertest(API contract). 003 기준 121+건
# 폴백·웹훅 멱등·k≥5·민감정보 배제는 계약/통합/보안감사 테스트로 강제:
#   contract.test.ts(29) — 003 델타 엔드포인트 마운트
#   services/ai/infer.test.ts, services/metrics.test.ts — AI 폴백→로그→폴백률
#   modules/payments/payments.test.ts — 상태기계·웹훅 멱등·환불
#   modules/notifications/notifications.us4.test.ts — 3채널·설정 반영
#   modules/auth/social-school.test.ts — 네이버 생성/연결·.ac.kr 게이트
#   services/feeds/feeds.test.ts — 수집 멱등·실패 시 유지·stale
#   security.audit.test.ts, lib/privacy/privacy.test.ts — k≥5·민감속성 배제
```

## 5.1 성능 목표(T052) — 운영 기준
| 경로 | 목표(p95) | 비고 |
|---|---|---|
| 로드맵 생성 `POST /roadmap` | < 2.0s (폴백 포함) | AI 요약은 트랜잭션 밖 호출, 실패 시 규칙 요약 즉시 |
| 조회(`/catalog`,`/feeds/items`,`/roadmap/latest`) | < 200ms | 인덱스·60s 캐시 활용 |
| 푸시 도달 | < 5s | 발송은 인라인, 실패만 BullMQ 재시도 |
> 부하 측정은 운영 환경에서 k6/autocannon 으로 수행. 로컬은 단위 응답성 스모크로 회귀만 방지.

## 6. 점진 활성화 원칙
외부 연동(AI·결제·푸시·메일·소셜·수집)은 **키·비용·실패 대체 동작을 단계마다 확인하며 하나씩** 켠다. 어느 연동도 꺼져 있어도 서비스는 폴백으로 동작해야 한다.
