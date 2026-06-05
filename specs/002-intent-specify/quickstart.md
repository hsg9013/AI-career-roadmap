# Quickstart: AI 기반 진로·취업 로드맵 플랫폼

**Feature**: 002-intent-specify | **Date**: 2026-06-05

001 모노레포 위에서 진행한다. 네트워크 표준값(plan.md)은 변경 불가.

## 1. 사전 조건

- Node.js 20 LTS, pnpm
- 인프라: OrbStack Docker (MariaDB 3306 / Redis / MinIO) — `check_project.sh`로 기동/상태 확인
- (모바일 빌드 시) Xcode 16 / Android SDK(API 28+)

## 2. 인프라 기동

```bash
./check_project.sh            # 인프라·앱 상태 점검/기동
```

> OrbStack이 내려가면 MariaDB도 내려간다. 포트 3316은 앱 스키마 없는 디코이 DB이므로 사용 금지.

## 3. 환경 변수

`.env`에 DB(pioneer16/pioneer26@pioneer16), Redis, MinIO, PortOne, Naver Cloud Mailer, FCM/APNs 키를 설정. JWT·암호화 키·PG 키는 평문 커밋 금지(배포 변수).

## 4. 의존성·마이그레이션·시드

```bash
pnpm install
pnpm --filter backend migrate          # data-model.md 기준 스키마
pnpm --filter backend seed:dev         # 학생/선배(익명화)/멘토 샘플
```

## 5. 실행

```bash
pnpm --filter backend dev              # http://localhost:9536/v1
pnpm --filter frontend-web dev         # http://localhost:9516
# 모바일(선택): pnpm --filter frontend-mobile build && npx cap run ios|android
```

## 6. P1 데모 시나리오 (US1 역량 갭 진단)

1. 학생 가입·로그인 → `PUT /students/me/profile`로 전공·학년·목표직무·보유역량 입력
2. `POST /diagnosis` 호출 → 충족/부족 역량 항목별 시각화 결과 확인
3. 누락 입력으로 호출 시 422 + 보완 안내 확인
4. 보유역량 갱신 후 재진단 → 갱신 반영 확인

## 7. 단계별 검증 포인트

| 단계 | 확인 |
|---|---|
| P1 | 첫 진단까지 평균 15분 이내(SC-001), 진단 시각화 |
| P2 | 로드맵 생성 p95 < 2s(SC-011), k<5 코호트 폴백 안내 |
| P3 | 미션 AI 피드백 즉시 + 5영업일 SLA(SC-006), 알림 발송 |
| P4 | 결제→권한 활성, 미동의 학생 매칭 제외, 선배 데이터 익명화 100%(SC-007) |

## 8. 테스트

```bash
pnpm --filter backend test             # Vitest + Supertest
pnpm --filter frontend-web test:e2e    # Playwright
```
