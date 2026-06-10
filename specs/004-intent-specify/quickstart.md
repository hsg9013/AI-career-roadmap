# Quickstart: 004 — 가치사슬 앞단·생태계·수익 보강

**Branch**: `004-intent-specify` | **Date**: 2026-06-10

001~003 모노레포·실연동 위에서 004를 개발·검증하는 빠른 경로. 네트워크 표준값(도메인·포트)은 변경하지 않는다.

## 0. 전제

- 003까지 구현·통합됨(main 에 specs/001~003, 실연동 코드 포함). 인프라(OrbStack: MariaDB 3306·Redis·MinIO) 가동.
- 백엔드 `pnpm --filter backend dev`(:9536, tsx watch), 웹 `pnpm --filter frontend-web dev`(:9516). 로그 `.run/*.log`.

## 1. 마이그레이션·시드 (Phase 1 산출 반영 시)

```bash
pnpm --filter backend migrate:up      # V026~V034 신규 테이블
pnpm --filter backend exec tsx scripts/seed-job-missions.ts   # 직무당 기본 미션 ≥3
pnpm --filter backend exec tsx scripts/seed-alumni-samples.ts # 직무당 합격 경로 10건(k≥5)
# 시연용 임의 계정(학생/선배/멘토) 시드 시 생성 목록을 콘솔로 출력
```

## 2. 작업영역별 검증 (US 단위 독립 테스트)

| US | 검증 방법 |
|---|---|
| US1 활동·스펙 | `POST /students/me/credentials` 등록 → `GET .../profile-completeness` 로 `ready_for_documents` 확인 → 문서 생성에 반영 |
| US2 표본 | 확충 직무로 로드맵 생성 시 `rationale.basis=personalized`, `sample_size≥5` |
| US3 미션 | 서로 다른 직무로 `GET /missions/for-job` → 서로 다른 미션, 멘토 출제 시 우선 |
| US4 설명가능성 | `GET /roadmap/latest` 응답에 `rationale.explanation`·`weight_note` 노출 |
| US5 파트너십 | `POST /admin/partners`(운영자) → 역할 계정 발급 → `GET /university/students-overview` 동의 범위별 |
| US6 멤버십 | `GET /membership/tiers` 비교표 → `POST /membership/subscribe` 결제 → 기능 게이팅 활성 |
| US7 광고 | 동의 학생 `GET /ads/recommended-jobs` 노출, 미동의 시 빈 목록 |
| US8 제휴 배너 | `GET /partners/banners`('광고/제휴' 표기) → `track` 클릭/전환 집계 |
| US9 라이선스 | `POST /admin/licenses` 등록 → 대학 대시보드/기업 수수료 산출 |
| 용어 | '기부' 문자열 잔존 0 (`grep -ri 기부` 화면·카피·라벨) |

## 3. 계약·통합 테스트 (Polish에서 강제)

- 동의 기준 광고/제휴 노출(미동의 미노출), k-익명성 ≥5 폴백, 직무 맞춤 미션 분기, 멤버십 기능 게이팅, 용어 통일.
- 결제(멤버십/단건/수수료)는 003 멱등·상태기계 재사용 — 웹훅 재수신·환불 일관성 회귀.

## 4. 성능·안전 점검

- 일반 조회(활동/스펙·목록·멤버십) p95 < 200ms, 로드맵 생성(근거 포함) p95 < 2s(초과 폴백).
- 외부 광고/제휴 정산 연동은 범위 외 — 자체 집계만 검증.

## 5. 단일 진실 공급원

- ISP 캔버스 #60 "ISP 캔버스 수정본"(004 갱신본). 비교 스냅샷 #86 "ISP 캔버스(003)".
- 캔버스 갱신 시 spec.md 동기화.
