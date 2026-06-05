# Phase 0 Research: AI 기반 진로·취업 로드맵 플랫폼

**Feature**: 002-intent-specify | **Date**: 2026-06-05

001-ai-career-roadmap에서 확정된 기술 결정을 계승하되, 002 명세의 전체 범위와 clarify 결과(가용성 99.5%/24h, 규모 ~1만/~1천)에 맞춰 재확인한다.

## R-1. 추천 엔진 하이브리드(AI + 규칙) 및 편향 제외

- **Decision**: 규칙 기반 1차 후보 생성(목표 직무 요구 역량 ↔ 보유 역량 갭 매핑, 선배 경로 빈도) + LLM 2차 재정렬·설명. 추천 입력 피처에서 성별·나이·출신학교를 제외하고, 학생의 거부 이력을 음의 가중치로 반영.
- **Rationale**: 규칙 기반은 설명가능성·재현성을, LLM은 자연어 근거와 개인화를 제공. 민감 속성 제외로 FR-007·편향 위험을 구조적으로 차단.
- **Alternatives**: 순수 LLM(설명·재현성↓, 비용↑), 순수 규칙(개인화·문맥↓). → 하이브리드 채택.

## R-2. k-익명성(≥5) 코호트 판정 및 미달 대체

- **Decision**: 추천 질의 시 (목표직무 × 전공계열 × 학년대) 코호트의 익명화 선배 표본 수를 집계하여 ≥5인 경우에만 해당 표본 기반 추천을 노출. 미달 시 상위 일반 코호트로 폴백하고 "표본 부족, 일반 추천" 안내를 표시.
- **Rationale**: 초기 규모(~1천 선배)에서는 세부 코호트가 자주 5 미달 → 폴백 경로가 빈번히 동작함을 전제(Edge Cases). k-익명성을 추천 게이트로 강제해 FR-019 충족.
- **Alternatives**: 미달 시 추천 차단(UX↓) → 폴백 안내가 우월.

## R-3. 민감 데이터 암호화 + 동의 이력

- **Decision**: 계좌번호·주민번호 등은 AES-256-GCM 컬럼 단위 암호화(키는 배포 변수/KMS, 평문 비저장). 동의(Consent)는 갱신이 아닌 append-only 이벤트로 기록해 시점별 동의 상태 추적. 보존기간 경과 데이터는 배치 잡으로 익명화/삭제.
- **Rationale**: PIPA·정보통신망법 대응(FR-020~022, FR-025), 감사 추적성 확보.
- **Alternatives**: 전체 DB 암호화(쿼리·운영 부담) → 컬럼 단위가 적정.

## R-4. 대학 이중 모드 권한(통계/개인)

- **Decision**: JWT `scope` 클레임 + 학생측 `university_consent_scope`('none'/'stats'/'individual') 차등. 대학 조회 API는 동의 범위를 서버에서 강제 필터링하여 stats 모드는 집계 지표만, individual 모드는 동의 학생의 개인 단위 정보만 반환.
- **Rationale**: FR-014 충족, 동의 미달 데이터 노출 차단.
- **Alternatives**: 단일 모드(개인정보 위험) → 이중 모드 분리.

## R-5. 멘토 정산 하이브리드(정액/수수료) + PortOne Payouts

- **Decision**: `mentor_track`(정액/수수료) + `commission_rates` + `mentor_payouts` + `payment_methods` 구조. 결제(PortOne 빌링) 수금 후 정산(PortOne Payouts) 산출. 결제 도메인이 정산 데이터 구조에 의존하므로 함께 설계.
- **Rationale**: FR-016~017, spec Assumptions의 결제↔정산 의존성 반영.
- **Alternatives**: 정액 전용(현직자 유인↓) → 하이브리드 채택.

## R-6. 웹+모바일 단일 코드베이스(Capacitor)

- **Decision**: Vue 3.4 + TS 자산을 `frontend-shared`로 공유하고 `frontend-web`(Vite), `frontend-mobile`(Capacitor 6 + Ionic Vue)로 빌드. 기능은 플랫폼 간 동등(spec Assumptions).
- **Rationale**: 동일 기능 중복 개발 회피, intent의 기술 아키텍처와 일치.
- **Alternatives**: 네이티브 별도 개발(비용 2배) → 거부.

## R-7. 가용성 99.5% · 24h 복구 (SC-012)

- **Decision**: 단일 MariaDB 인스턴스 전제에서 일일 자동 백업(논리 덤프 + 스냅샷) + 복구 런북으로 24h 내 복구 보장. `/healthz`·`/readyz` 헬스체크, nginx 재시작 정책. 향후 read-replica로 SPOF 완화(로드맵).
- **Rationale**: 초기 규모·비용 대비 현실적 목표(clarify). 99.9%/이중화는 후속 단계.
- **Alternatives**: 즉시 이중화(초기 비용·복잡도↑) → 단계적 도입.

## R-8. 미션 검수 SLA 5영업일 큐

- **Decision**: 제출물 배정 시 5영업일 데드라인 타이머(BullMQ delayed job). 기한 초과 시 (a) 가용 멘토 재배정 큐로 이동, (b) 재배정 실패 시 AI 피드백으로 대체하고 학생에게 통지.
- **Rationale**: FR-012·SC-006(5영업일 80%) 충족, 멘토 지연 위험 대응.
- **Alternatives**: 무기한 대기(UX·SLA 위반) → 거부.

## 종합

모든 NEEDS CLARIFICATION 해소 완료. Phase 1 설계 진행 가능.
