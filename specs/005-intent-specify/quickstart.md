# Quickstart: 005 검증 (역할별 실동작·세션/문서/결제 데모)

005는 "시연 가능성"이 1급 목표다. 아래 흐름으로 각 H를 단독 검증한다. (로컬: 웹 `http://localhost:9516`, API `http://localhost:9536/v1`)

## 0. 준비
```bash
# 인프라(OrbStack: mariadb/redis/minio) 기동 후
pnpm install
pnpm --filter backend migrate     # 005 마이그레이션(기간 컬럼·코호트·결제 이력 등)
pnpm --filter backend seed:demo    # 데모 계정 세트·합격경험 코호트·매칭 시드
pnpm --filter backend dev          # :9536
pnpm --filter frontend-web dev     # :9516
```

## H1. 합격 경험 공유 → 로드맵 연계
1. 멘토(현직자) 데모 계정 로그인 → 합격 경험 1건 등록(직무 코드 선택).
2. `GET /alumni/success-experiences?job_code=...` → `k_anonymity_met=true`(시드로 ≥5) 확인.
3. 같은 직무 학생 데모 계정 → `POST /roadmap/generate` → `personalized=true`, `rationale`에 "선배 N명 경로" 문구 확인.
4. 코호트 5 미달 직무로 요청 → `personalized=false`(일반 가이드 폴백) 확인.

## H2. 인증·세션
1. 로그인 후 임의 화면에서 **새로고침(F5)** → 같은 화면·로그인 유지(localStorage 토큰 하이드레이션).
2. **로그아웃** 클릭 → 세션 파기 + 즉시 메인(`/`) 이동, 새로고침해도 비로그인.
3. 토큰 강제 만료(개발자도구에서 토큰 변조) 후 새로고침 → 저장소 클리어·재로그인 안내.

## H3. 파트너별 가입·권한
1. 파트너 유형별 가입(`/partners/signup`, university/company/mentor/edu_activity_platform) → 유형별 양식 확인.
2. 각 역할 로그인 → 내비게이션에 **허용 메뉴만** 노출(`GET /auth/menus`).
3. 권한 밖 경로 직접 접근 → `Forbidden` 차단.

## H4. 역할별 실동작
1. 기업 계정 인재 검색 → 산업·직무 **드롭다운** 선택만으로 `GET /companies/talent-search` 매칭 결과(자유 텍스트 없음).
2. 멘토 미션 출제 + `POST /missions/{id}/comments` 심층 코멘트 → 연결된 학생 데모 계정에서 확인.
3. 데모 계정에 활동·진단 입력 → `GET /dashboard/score` 점수 산출·반영.

## H5. 활동 기간·문서 다운로드
1. 활동 입력 시 **시작일~종료일** 지정(`POST /activities`), 종료<시작이면 400 거부.
2. `GET /documents/{docType}/export-data?format=pdf|docx` → 활동 누적 데이터 수신 → 버튼 클릭 시 **jsPDF/docx로 실제 파일 다운로드**(화면 캡처 아님).
3. 활동 0건 상태에서 문서 요청 → 409 "먼저 기록" 안내.
4. 진척 점검(방학/학기말) 업데이트 후 재생성 → 누적 반영 확인.

## H6. 결제·노출
1. 멤버십 결제 `POST /payments/checkout {mode: sandbox|virtual}` → 성공 시 등급 변경, 화면 "실제 거래 아님" 표기.
2. 가상 시나리오 `force_result: fail` → 실패 팝업·등급 불변.
3. 광고/제휴/채용 노출 대상 계정 → `GET /promotions` → 가입자 직무 맞춤 항목 숨김 없이 노출, '광고/제휴' 표기, 미동의·부적합 미노출.

## 자동 테스트(계약/통합/E2E)
```bash
pnpm --filter backend test     # k-익명성·기간 검증·결제 시나리오·드롭다운 매칭·노출 규칙 계약/통합
pnpm --filter frontend-web e2e # 세션 유지/로그아웃·권한 메뉴·문서 다운로드 E2E
```

## 통과 기준(SC 매핑)
- SC-001 코호트≥5 100% 개인화 / 미달 100% 폴백
- SC-002 새로고침 유지 ≥95% / 로그아웃 100% 파기
- SC-003 권한 메뉴 100% 일치 / 직접 접근 100% 차단
- SC-004 드롭다운 매칭, 자유 텍스트 의존 0
- SC-005 데모 점수 ≥90% 산출
- SC-006 문서 실다운로드 ≥90%
- SC-007 결제 시나리오 100% 정확·실거래 아님 표기
- SC-008 직무 맞춤 노출, 미동의/부적합 노출 0
