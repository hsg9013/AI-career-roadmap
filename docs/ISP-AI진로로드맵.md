# 정보화전략계획(ISP) — AI 기반 커리어 로드맵·포트폴리오 관리 서비스

| 항목 | 내용 |
|---|---|
| 대상 시스템 | AI 기반 커리어 로드맵·포트폴리오 관리 SaaS (`p16.sumzip.com`) |
| 기능 브랜치 | `001-ai-career-roadmap` |
| 근거 산출물 | `specs/001-ai-career-roadmap/{spec,plan,research,data-model}.md` |
| 작성일 | 2026-05-29 |
| 현재 단계 | 모노레포·인프라 셋업 완료, Foundational/User Story 구현 착수 (태스크 27/194) |

> 본 ISP는 spec.md의 10개 User Story·52개 기능요구(FR)·35개 Key Entity, plan.md의 8개 기술결정(R-1~R-8)을 단일 진실 공급원으로 삼아 작성되었다.

---

## 1. 정보화 비전·목표 (Vision & Objectives)

### 1.1 비전
> **"선배 합격 데이터와 현직자 피드백을 결합한, 데이터 기반 맞춤형 커리어 설계·포트폴리오 자동화 플랫폼."**

단순 채용 정보 나열형 서비스를 넘어, 실제 합격한 선배의 익명화된 경로 데이터와 현직자의 정성 피드백을 AI로 결합하여 학생 개개인의 진로를 **진단→설계→강화→관리**의 폐루프로 지원한다.

### 1.2 핵심 가치 제안
- **데이터 기반 차별화**: 인기 직무 쏠림형 일반 정보가 아닌, k-익명성(k≥5)을 충족한 선배 합격 경로 표본 기반 맞춤 추천.
- **입력 부담 최소화**: 키워드 선택 기반 간편 입력 → 활동 자동 분류·태깅 → 이력서·자소서·포트폴리오 자동 생성으로 락인.
- **하이브리드 피드백**: AI 1차 분석 + 현직자 심층 코멘트 결합.

### 1.3 정보화 목표 (4대 핵심 활동)
| # | 목표 영역 | 정의 |
|---|---|---|
| 1 | 데이터 기반 역량 분석·진단 | 목표 직무 요구역량 대비 보유역량 갭 진단 시각화 (US1/P1) |
| 2 | 데이터 기반 합격 로드맵 설계 | 선배 경로 기반 시기별 추천 로드맵 생성 (US2/P2) |
| 3 | 실무 역량 강화·하이브리드 피드백 | 현직자 미션 + AI·현직자 결합 피드백 (US3·US4) |
| 4 | 상시 이력 관리·문서 자동화·진척 점검 | 활동 자동분류·문서 생성·정기 진척 알림 (US3·US5) |

### 1.4 사업 목표 (수익 4채널)
1. **B2C**: 프리미엄 멤버십 + 단건 결제(자소서 첨삭·멘토링·미션 평가)
2. **B2B/B2G**: 대학 취업지원센터 SaaS 라이선스(연 단위) + 기업 채용 성사 수수료
3. **광고/노출**: 인턴십·신입 채용 공고 타겟 노출
4. **제휴 수수료**: 외부 교육·자격증·어학 콘텐츠 중개

---

## 2. 환경·개선 동인 (Drivers & Environment)

### 2.1 시장·사용자 동인
| 동인 | 설명 |
|---|---|
| 진로 정보 비대칭 | 학생은 "무엇을 언제 준비해야 합격하는지"의 시계열 경로 정보 부재 |
| 포트폴리오 작성 부담 | 활동을 매번 수동으로 정리·재구성하는 반복 노동 |
| 검증된 피드백 부재 | 실무자 관점의 구체 피드백을 받을 채널 부족 |
| 대학의 취업률 KPI 압박 | 취업지원센터의 학생 진로 관리·데이터화 수요 (B2G) |
| 기업의 조기 인재 발굴 수요 | 검증된 재학생 풀에 대한 접근 수요 (B2B) |

### 2.2 고객 세그먼트
- **학생**(1차 사용자): 진로 설정·역량 강화·포트폴리오 구축
- **대학 취업지원센터·학과**(B2B/B2G): 학생 진로 관리·취업률 제고
- **기업 HR·현직자**(B2B + 멘토 풀): 인재 조기 발굴·멘토링 수익화
- **선배·졸업생**(데이터 제공자 겸 멘토 후보): 콜드스타트 해소의 데이터 공급원

### 2.3 규제·기술 환경
- **법·규제**: 한국 개인정보보호법(PIPA)·정보통신망법 1차 준수 대상. 민감 학적·성적·활동 데이터 취급 → 익명화·동의·감사 체계 필수.
- **기술 환경**: 모던 브라우저(최신 2개 메이저) + iOS 15+/Android 9+ 모바일 동시 출시. 클라우드 컨테이너 인프라(Docker/nginx).
- **외부 의존**: 채용·자격증 외부 데이터 소스(공식 API·파트너 피드·합법 스크래핑), 결제(PortOne), 메일(Naver Cloud), 푸시(FCM/APNs).

---

## 3. AS-IS 기능 현황 (Current Features)

> 본 서비스는 신규 구축 대상이므로 AS-IS는 **(a) 시장의 현행 학생 진로 준비 방식**과 **(b) 현재 구현 진척 상태** 두 축으로 기술한다.

### 3.1 시장 현행 방식 (대체 대상)
| 영역 | 현행 수단 | 특성 |
|---|---|---|
| 진로 탐색 | 채용 포털·커뮤니티·블로그 후기 | 산발적·비구조화, 시계열 경로 부재 |
| 역량 진단 | 자가 판단·일반 직무기술서 | 정량 비교 불가, 표본 근거 없음 |
| 포트폴리오 | 워드·한글 수기 작성 | 활동 재입력 반복, 직무 정렬 수동 |
| 피드백 | 지인·교내 상담·유료 첨삭 | 비표준·비연속·고비용 |
| 진척 관리 | 개인 메모·캘린더 | 자동 점검·알림 없음 |

### 3.2 구현 진척 현황 (As-Is of build)
- ✅ **Setup(Phase 1) 완료**: pnpm 5-워크스페이스 모노레포(`backend`/`frontend-web`/`frontend-mobile`/`frontend-shared`/`shared/types`), 인프라 컨테이너(MariaDB·Redis·MinIO), nginx·GitLab CI 골격.
- 🔄 **Foundational(Phase 2) 착수**: 인증·DB 마이그레이션·미들웨어·프런트 골격 진행 중.
- ⏳ **User Story 미구현**: US1(갭 진단)~US10 본 기능 대기.
- **정량 진척**: 태스크 **27/194 완료(약 14%)**.

---

## 4. AS-IS 문제점·한계 (Pain Points & Limits)

### 4.1 사용자/시장 측 한계
| 문제 | 영향 |
|---|---|
| 학생 데이터 입력 번거로움 | 진단·추천의 기초 데이터 확보 실패 → 가치 제공 불가 |
| 추천 알고리즘 부재 | 인기 직무 쏠림, 비인기 전공 표본 부족 시 무대응 |
| 비표준 피드백 | 품질·전달 속도 보장 불가 |
| 민감 정보 보안 공백 | 학적·성적 데이터 유출·오남용 위험 |
| 채용 트렌드 정보 노후화 | 외부 데이터 갱신 지연 시 잘못된 의사결정 유도 |

### 4.2 구축 측 리스크(현 시점)
- **데이터 콜드스타트**: 선배 합격 데이터 미축적 → 추천 품질의 핵심 공급원 부재.
- **단일 장애점**: MariaDB 단일 인스턴스(향후 replica 도입 전).
- **테스트 우선 원칙 부분 적용**: 통합 테스트는 P2 마무리 시점 도입 예정(현재 구현 우선).
- **거버넌스 미문서화**: `constitution.md` placeholder 상태.

---

## 5. AS-IS 데이터·기술 현황 (Current Data & Tech)

### 5.1 데이터 현황
- 운영 데이터 **미축적**(신규 구축). 선배 데이터셋·직무 요구역량 사전 0건.
- 데이터 모델은 설계 완료(`data-model.md`, 35개 엔티티 DDL) 단계이나 마이그레이션 적재 전.

### 5.2 기술 자산 현황
| 계층 | 현재 상태 |
|---|---|
| 저장소 | MariaDB 10.x(로컬 Docker `3306`), Redis 7(`6379`), MinIO(`9000/9001`) 컨테이너 가동 |
| 백엔드 | Node 20 + Express 4 + TypeScript, `/healthz` 가동, DB pool 연결 확인 |
| 프런트 | Vite 5 + Vue 3.4 dev 서버(`9516`), Capacitor 6 + Ionic Vue 모바일 초기화 |
| 배포 | nginx 리버스 프록시(`p16.sumzip.com` → vite/backend), OrbStack 도커 런타임 |
| CI | GitLab CI 골격(lint→test→build→mobile_build→image→deploy) |

### 5.3 네트워크 표준 (변경 불가)
| 항목 | 값 |
|---|---|
| 운영 도메인 | `p16.sumzip.com` (HTTPS) |
| 운영 API 베이스 | `https://p16.sumzip.com/api/v1` |
| 로컬 웹 | `http://localhost:9516` |
| 로컬 API | `http://localhost:9536/v1` |

---

## 6. 갭 분석·개선 기회 (Gap Analysis & Opportunities)

| # | AS-IS 갭 | TO-BE 개선 기회 | 연계 |
|---|---|---|---|
| G1 | 시계열 합격 경로 정보 부재 | 선배 익명화 데이터 기반 학년·학기별 로드맵 | US2, FR-010~015 |
| G2 | 정량 역량 진단 불가 | 목표 직무 요구역량 대비 갭 진단 시각화 | US1, FR-005~009 |
| G3 | 포트폴리오 수기 반복 | 활동 자동 분류·문서 자동 생성·템플릿 전환 | US3, FR-016~020 |
| G4 | 비표준·단발 피드백 | AI 1차 + 현직자 코멘트 하이브리드 + SLA | US4, FR-021~025 |
| G5 | 진척 자가 관리 | 정기 진척 점검·다채널 알림(인앱/이메일/푸시) | US5, FR-026~028 |
| G6 | 데이터 콜드스타트 | 선배 데이터 기부 인센티브(현금·크레딧·뱃지) | US10, FR-046 |
| G7 | 대학 진로 관리 수단 부재 | 집계/개인 이중 모드 대시보드 (차등 동의) | US7, FR-034~036 |
| G8 | 기업 조기 인재 접근 부재 | 직무 매칭·익명 집계·컨택·성사 수수료 | US8, FR-037~041 |
| G9 | 보안·규제 미대응 | k-익명성·컬럼 암호화·통합 동의·감사 로그 | FR-029~033 |

---

## 7. TO-BE 목표 기능 (Target Features)

### 7.1 기능 도메인 (FR 52건 / 12개 그룹)
| 그룹 | 핵심 기능 | FR |
|---|---|---|
| 1. 계정·권한 | 5종 역할(학생/현직자/기업HR/대학관리자/운영자), 이메일·소셜 로그인, .ac.kr 검증, 재직 검수, 데이터 4권한(열람·수정·내보내기·삭제) | FR-001~004 |
| 2. 프로필·진단 | 통합 프로필 입력(키워드+자유), 갭 진단 시각화(레이더), 목표 직무 최대 3개 | FR-005~009 |
| 3. 합격 로드맵 | 선배 경로 분석, 시계열 추천+근거, 완료/건너뛰기 재계산, 표본 부족 명시, 편향 속성 배제 | FR-010~015 |
| 4. 활동·문서 자동화 | 활동 자동 태깅, 이력서·자소서·포트폴리오 생성, 인용 활동 추적, PDF/공유링크, 템플릿 전환 | FR-016~020 |
| 5. 미션·피드백 | 현직자 미션 등록, AI 1차 분석, 통합 피드백, 5영업일 SLA 재할당/AI 대체, 멘토 품질 지표 | FR-021~025 |
| 6. 진척·알림 | 연 4회 정기 리포트, 3채널 알림(인앱/이메일/푸시+fallback), 채널·빈도 설정 | FR-026~028 |
| 7. 데이터 보호 | k-익명성(k≥5), 권한 기반 접근·감사, 5종 통합 동의, PIPA 준수, 운영자 접근 승인 | FR-029~033 |
| 8. 대학 인터페이스 | 집계/개인 이중 모드, 필터·익명 내보내기, 라이선스 청구 기초자료 | FR-034~036 |
| 9. 기업 인터페이스 | 직무 등록·익명 집계, 공고 노출, 컨택→수락 식별 공개, 성사 3단계(신고·확정·청구), 광고 구분 | FR-037~041 |
| 10. 결제·인센티브 | 멤버십·단건 결제, 권한 즉시 활성·영수증, 갱신·해지·환불, 멘토 정산(정액/수수료), 선배 기부 인센티브 | FR-042~046 |
| 11. 외부 데이터 | 일 단위 채용·자격증 갱신, 노후화 표시, 제휴 추적 | FR-047~049 |
| 12. 운영·관리 | 검수·승인·반려, 신고 큐, 운영 지표 대시보드 | FR-050~052 |

### 7.2 단계별 우선순위
**P1**: US1(갭 진단) · **P2**: US2(로드맵)·US3(문서) · **P3**: US4(미션)·US5(알림)·US6(멘토)·US7(대학) · **P4**: US8(기업)·US9(결제)·US10(선배 데이터)

---

## 8. TO-BE 데이터 아키텍처 (Target Data Architecture)

### 8.1 저장 계층
| 저장소 | 역할 |
|---|---|
| MariaDB 10.x | 메타데이터·관계형 데이터(35개 엔티티) — 단일 진실 공급원 |
| MinIO(S3 호환) | 미션 제출물·이력서·생성 문서 등 파일 객체 + presigned URL |
| Redis 7 | 세션 캐시, BullMQ 큐, rate-limit |

### 8.2 핵심 데이터 도메인 (35 엔티티)
- **학생 도메인**: Student Profile, Activity Record, Gap Diagnosis, Roadmap, Recommendation Rationale, Generated Document, Document Share Link
- **데이터·추천 엔진**: Senior Success Case(익명화 k값), Job Requirement, Recommendation Model State
- **미션·피드백**: Mission, Mission Submission, AI Feedback Report, Mentor Comment, Mentor Quality Metrics
- **알림·일정**: Notification Preference, Notification Event, Schedule Item, Recruitment Opening
- **파트너**: University/Enterprise Partner Account, University Dashboard Snapshot, Job Posting, Contact Request, Recruitment Match Record, License Usage Snapshot
- **결제·정산**: Membership Subscription, One-off Purchase, Payment Transaction, Mentor Compensation Ledger, Senior Contribution Ledger, Partner Invoice
- **동의·감사·운영**: Consent Record, Audit Log, Moderation Queue Item, Report

### 8.3 데이터 보호 설계
- **익명화**: 선배 데이터는 추천 풀 편입 전 `anonymizer` 서비스로 식별 정보 분리, **k-익명성(k≥5) 미달분은 풀에서 제외**.
- **컬럼 암호화**: 계좌·사업자번호·주민번호 등 민감 컬럼은 **AES-GCM 컬럼 단위 암호화**.
- **동의 이력**: 5종 동의(서비스·대학공유·기업공유·익명데이터셋·마케팅)를 `consent_records`에 변경마다 신규 행 적재 → 시점별 이력 보존.
- **차등 공유**: 대학 공유는 `none`/`aggregate_only`/`individual` 3단계(R-7).
- **보존·파기**: 졸업 후 1년 보관 → 미연장 시 야간 잡 자동 익명화·삭제(90·30·7일 사전 알림).

---

## 9. TO-BE 애플리케이션·기술 아키텍처 (Target App & Tech Architecture)

### 9.1 전체 구조 (pnpm 모노레포 5 워크스페이스)
```
[브라우저]            [iOS/Android 앱]
 frontend-web   ←→   frontend-mobile
 (Vite5+Vue3.4)      (Capacitor6+Ionic Vue)
        \             /
       frontend-shared  ── shared/types (OpenAPI→TS 자동생성)
       (컴포넌트·composable·Pinia 공유)
                |  HTTPS  (nginx: p16.sumzip.com)
                ▼
        backend (Node20 + Express4 + TS)
   modules / services / workers / middlewares / lib
                |
   MariaDB(mysql2)  ·  Redis(BullMQ)  ·  MinIO(S3)
   PortOne(결제/Payouts) · Naver Cloud Mailer · FCM/APNs
```

### 9.2 기술 결정 (R-1~R-8)
| # | 영역 | 결정 |
|---|---|---|
| R-1 | AI 추천 엔진 | 외부 LLM API + 룰 기반 하이브리드(`services/recommendation`) |
| R-2 | 파일 스토리지 | MinIO 자체호스팅(S3 호환) |
| R-3 | 결제 게이트웨이 | PortOne(빌링키 + 멤버십 + Payouts) |
| R-4 | 메일·알림 | Naver Cloud Outbound Mailer + FCM/APNs |
| R-5 | 인증 | JWT 액세스 + DB refresh 회전, HttpOnly 쿠키, scope claim |
| R-6 | 모바일 앱 FW | Capacitor 6 + Ionic Vue + 기존 Vue 자산 공유 |
| R-7 | 대학 권한 | 집계/개인 엔드포인트 분리 + scope + 차등 동의 |
| R-8 | 멘토 보상 | `mentor_track`+`commission_rates`+`mentor_payouts`, PortOne Payouts |

### 9.3 백엔드 모듈 경계
- **modules**: auth · students · activities · gap-diagnosis · roadmap · documents · missions · mentor · payments · partners(universities/enterprises) · notifications · mobile · admin
- **services**: recommendation(LLM+룰) · anonymizer(k-익명성) · payout(월 정산) · push(FCM/APNs)
- **workers(BullMQ)**: missionReviewSla(5영업일) · recommendationPrecompute · payoutMonthly(매월 1일 02:00 KST) · pushDispatcher · externalDataFetch(일 단위)
- **lib**: logger(pino) · mailer · storage(presigned) · crypto(AES-GCM) · jwt(scope 빌더)

### 9.4 성능 목표
| 지표 | 목표 |
|---|---|
| 로드맵 생성 API p95 | < 2.0s (LLM 포함, 캐시 우회) |
| 일반 CRUD API p95 | < 200ms |
| 모바일 콜드 스타트 | < 3s |
| 푸시 도달 p95 | < 5s |

### 9.5 규모 가정 (1년차)
활성 학생 5천~1만, 멘토 200~500, 동시접속 500, 앱 다운로드 2만~4만(AOS 70%/iOS 30%), 학생당 활동·로드맵 50~200건.

---

## 10. 기대효과·성공지표 (Expected Benefits & KPIs)

| 영역 | KPI | 목표 |
|---|---|---|
| 학생 흐름 | 최초 입력→첫 갭진단 도달(SC-001) | 평균 15분 이내 |
| | 7일 내 3대 핵심행동 완수율(SC-002) | ≥ 50% |
| | 로드맵 항목 1건+ 완료 비율(SC-003) | ≥ 70% |
| | AI 추천 명시적 거부율(SC-004) | ≤ 30% |
| | 포트폴리오 외부 활용률(SC-005) | ≥ 90% |
| | 미션 피드백 5영업일 전달(SC-006) | ≥ 80% |
| | 비인기 전공 추천 만족도 편차(SC-007) | ±10%p 이내 |
| 데이터·보안 | 선배 데이터 k≥5 충족(SC-008) | 100% |
| | 권한 외 접근 차단·로깅 / 유출(SC-009) | 100% / 0건 |
| | 외부 데이터 갱신 지연(SC-010) | ≤ 24시간 |
| 파트너 | 대학 연동 완료(SC-011) | ≤ 10영업일 |
| | 대학 관리자 MAU(SC-012) | 계약 시트의 ≥ 60% |
| | 기업 매칭 통계 확인(SC-013) | ≤ 3분 |
| | 기업 컨택→성사 전환율(SC-014) | 월 단위 측정·공개 |
| 수익·운영 | 90일 내 결제 전환율(SC-015) | ≥ 8% |
| | 멤버십 월 해지율(SC-016) | ≤ 5% |
| | 활성 멘토 비율(SC-017) | 학생 100명당 ≥ 1명 |
| | 학기말 알림 재방문율(SC-018) | ≥ 60% |
| | 결제실패·환불 7일내 안내(SC-019) | 100% |
| 추천 품질 | 완료 vs 거부 항목 매칭점수 차(SC-020) | ≥ 20%p |

---

## 11. 이행 과제·우선순위 (Migration Tasks & Priority)

> 단계 진입 원칙: **이전 단계 안정화 후 다음 진입** (P1→P2→P3→P4). Foundational(Phase 2)이 끝나야 어떤 User Story도 시작 불가.

| 우선순위 | Phase | 과제 | 핵심 산출물 |
|---|---|---|---|
| 전제 | Phase 1 Setup ✅ | 모노레포·인프라·CI 골격 | 5 워크스페이스, Docker, nginx, GitLab CI |
| 전제 | Phase 2 Foundational 🔄 | 인증·DB·미들웨어·프런트 골격 | JWT+scopeGuard, V001~ 마이그레이션, auditLogger |
| **P1** | Phase 3 (US1) | 회원가입→프로필→갭 진단 (MVP) | gap-diagnosis 모듈, 진단 시각화 |
| **P2** | Phase 4~5 (US2·US3) | 로드맵 추천 + 문서 자동화 | recommendation 서비스, documents 모듈 |
| **P3** | Phase 6~9 (US4·US5·US6·US7) | 미션·피드백·알림·멘토 정산·대학 이중모드 | missionReviewSla, push, mentor payout, 대학 대시보드 |
| **P4** | Phase 10~12 (US8·US9·US10) | 기업 매칭·결제 본체·선배 데이터 기부 | enterprises, payments(PortOne), anonymizer |
| 보강 | Phase 13 | `/speckit.analyze` Critical 3 + High 6 해소 | 일관성 보강 |
| 완료 | Phase 14 Polish | E2E·CI deploy·성능·접근성 | Playwright, prod deploy + 롤백 |

**의존성 핵심**: US9(결제)는 US6의 R-8 정산 마이그레이션(V021)에 의존 → 동일 PR 또는 V021 배치 결정 필요.

---

## 12. 이행 로드맵 (Implementation Roadmap)

```
현재 (2026-05): Setup 완료 ✅ / Foundational 착수 🔄  (태스크 27/194 ≈ 14%)
        │
   [1] Foundational 완료 ──────────────► 인증·DB·미들웨어·프런트 골격
        │
   [2] P1: US1 갭 진단 (MVP) ──────────► 첫 사용자 가치, 단독 출시 가능
        │
   [3] P2: US2 로드맵 → US3 문서 ──────► 차별화 가치 + 락인 포인트
        │
   [4] P3: US4 미션 / US5 알림 /
           US6 멘토 정산 / US7 대학 ───► 피드백 공급망 + B2G 채널
        │
   [5] P4: US8 기업 / US9 결제 /
           US10 선배 데이터 ───────────► 수익 채널 + 콜드스타트 해소
        │
   [6] Phase 13 보강 → Phase 14 Polish ► E2E·prod deploy·성능·접근성
```

**증분 인도 전략**: MVP(US1) 출시 후 각 User Story를 독립 검증 가능한 슬라이스로 순차 출시. P2는 인력 여유 시 US1과 병렬 가능. 모바일 E2E 자동화(Detox/Maestro)는 P3에 도입.

---

## 13. 위험·제약·거버넌스 (Risks, Constraints & Governance)

### 13.1 위험 및 완화
| 위험 | 영향 | 완화 |
|---|---|---|
| 데이터 콜드스타트 | 추천 품질 저하 | US10 선배 기부 인센티브(현금·크레딧·뱃지), 초기 표본 부족 시 유사 직무군 보완 + 표본 수 명시 |
| 추천 편향(인기 직무 쏠림) | 비인기 전공 소외 | 거부 이력 학습 가중치 재조정, k<5 명시, 민감 속성(성별·연령·출신교) 매칭 입력 배제 |
| 민감 정보 유출 | 법적·신뢰 손실 | 권한 기반 접근 + 감사 로그, AES-GCM 컬럼 암호화, 운영자 접근 별도 승인 |
| MariaDB 단일 장애점 | 가용성 위험 | 향후 replica 도입(인지된 SPOF), 정기 백업 |
| 현직자 검수 SLA 초과 | 피드백 지연 | 5영업일 초과 시 타 멘토 재할당(+2영업일) → 실패 시 AI 보강 대체 |
| 외부 데이터 노후화 | 잘못된 의사결정 | 24h+ 미갱신 시 "최신 정보 아님" 표시, 마지막 정상 데이터 + 장애 표시로 운영 지속 |
| 결제 실패·이중 청구 | 분쟁 | 사유 안내·재시도, 중복 청구 운영자 검토 후 자동·수동 환불 |

### 13.2 제약 (Constraints)
- 한국 PIPA·정보통신망법 준수, **k-익명성 k≥5 강제**.
- 미션 검수 SLA **5영업일**(FR-024).
- 네트워크 표준값(`p16.sumzip.com`, 포트 9516/9536, 3306/6379/9000) **변경 불가**.
- 초기 출시 **한국어 단일** 언어, 영문·다국어는 후속.
- 채용 매칭에서 **민감 속성 배제**(법적 차별 방지).

### 13.3 거버넌스
| 게이트 | 상태 |
|---|---|
| 명세 ↔ 계획 일치 | ✅ (spec 2026-05-22 갱신본, R-6/R-7/R-8 명시) |
| Tests-first 원칙 | ⚠️ 부분 (통합 테스트 P2 마무리 시 도입) |
| 단일 책임 모듈 경계 | ✅ (도메인별 디렉터리) |
| Observability | ✅ (pino 구조화 로그 + requestId, /healthz·/readyz) |
| 비밀 분리 | ✅ (.env 분리, DB·PG·JWT 키는 GitLab Variables masked+protected) |
| Constitution 명문화 | ⏳ placeholder → `/speckit.constitution`으로 작성 권장 |

- **검수·승인 체계**: 미션·기업 공고·현직자 등록·데이터 기부·신고를 운영자 Moderation Queue로 라우팅(FR-050~051).
- **운영 지표 모니터링**: DAU/MAU·전환율·결제/환불·추천 만족도·검수 SLA·데이터 갱신 지연·파트너 활동량 대시보드(FR-052).
- **개인정보 거버넌스**: 처리방침·위탁내역·보존기간 명시, 변경 시 재동의(FR-032).

---

*본 ISP는 `specs/001-ai-career-roadmap/`의 spec·plan·research·data-model·tasks 산출물에 정렬되며, 해당 산출물 갱신 시 동기화되어야 한다.*
