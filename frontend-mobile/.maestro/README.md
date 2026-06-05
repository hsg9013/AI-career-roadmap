# 모바일 E2E (Maestro) — T067

P3 단계에서 도입한 모바일 자동화 스모크. CI에서는 시뮬레이터/에뮬레이터가 있는 잡에서만 실행한다.

## 설치
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## 실행
```bash
# 1) 앱 빌드 + 디바이스 설치
pnpm --filter frontend-mobile build && pnpm --filter frontend-mobile cap:sync
# iOS: Xcode로 시뮬레이터에 실행 / Android: 에뮬레이터에 실행
# 2) 플로우 실행
pnpm --filter frontend-mobile e2e
```

## 플로우
- `smoke.yaml` — 로그인 → 대시보드/온보딩 → 로드맵 진입 스모크.

추후 미션 제출·문서 생성 플로우를 추가한다. 로컬 무인 실행이 어려운 환경(시뮬레이터 부재)에서는 스킵되며, CI 모바일 잡에서 게이트한다.
