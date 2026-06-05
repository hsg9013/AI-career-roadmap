# Intent - Plan

## [ISP 기반 계획 의도] 데이터·애플리케이션·기술 아키텍처

### 전체 구조
하나의 저장소 안에 다섯 개의 작업 공간을 둡니다. 서버(백엔드), 웹 화면, 모바일 앱, 웹과 앱이 함께 쓰는 공통 부품, 그리고 화면과 서버가 주고받는 데이터 형식 정의입니다. 웹은 Vue로 만들고, 모바일 앱은 같은 화면 코드를 Capacitor로 감싸 iOS와 안드로이드에 함께 올립니다. 덕분에 같은 기능을 두 번 만들 필요가 없습니다. 외부 접속은 nginx가 받아 하나의 도메인에서 안전하게 연결해 줍니다.

### 주요 기술 선택
추천 엔진은 인공지능과 규칙 기반을 함께 사용하고, 파일은 MinIO에 저장하며, 결제와 정산은 PortOne을, 메일과 푸시 알림은 네이버 클라우드와 FCM·APNs를 사용합니다. 로그인은 보안 토큰 방식을 채택하고, 대학 기능은 통계용과 개인용 권한을 분리하며, 멘토 보상은 정액과 수수료 두 방식을 모두 지원합니다.

### 데이터 저장과 보호
데이터는 성격에 따라 세 곳에 나누어 저장합니다. 서로 연결된 핵심 데이터는 MariaDB에, 이력서·미션 제출물 같은 파일은 MinIO에, 빠른 조회용 임시 데이터와 작업 대기열은 Redis에 둡니다. 보호 측면에서는 선배 데이터를 익명화하고, 계좌번호·주민번호처럼 민감한 항목은 암호화해 저장하며, 동의 내역은 바꿀 때마다 기록을 새로 남깁니다. 대학 공유 동의는 '공유 안 함 / 통계만 / 개인 단위'의 세 단계로 세분화합니다.

### 성능 목표
로드맵 생성은 2초 안에, 일반 조회는 0.2초 안에 응답하도록 합니다. 모바일 앱은 3초 안에 켜지고, 푸시 알림은 5초 안에 도착하도록 합니다.

---

[웹스택] Vue.js + Node.js

# Vue.js + Node.js

현대적인 웹 개발 패턴을 따르는 풀스택 애플리케이션입니다. 프론트엔드와 백엔드가 분리된 구조로, REST API를 통해 데이터를 주고받습니다.

**프론트엔드**
- Vue.js 3 (v3.4+): Composition API 기반 컴포넌트
- TypeScript (v5.x): 정적 타입 지원
- Vite (v5.x): 빠른 개발 서버 및 빌드 도구
- Pinia (v2.x): 상태 관리

**백엔드**
- Node.js (v20 LTS): JavaScript 서버 런타임
- Express.js (v4.x): 웹 프레임워크
- TypeScript (v5.x): 타입 안전성
- mysql2 (v3.x): MariaDB 연결 드라이버

**데이터베이스 기술**
- MariaDB: MySQL 호환 관계형 DB
- mysql2 드라이버: Promise 기반 비동기 쿼리
- SQL 쿼리 기반 데이터 조작

※ 실제 연결 정보는 [데이터베이스 설정]을 참고하세요.

**개발환경/배포**
- Docker: 컨테이너 패키징
- Nginx: 리버스 프록시, HTTPS
- GitLab CI/CD: 자동화 배포

**빠른 시작**
```bash
# 프론트엔드
cd frontend && npm install && npm run dev

# 백엔드
cd backend && npm install && npm run dev
```

[데이터베이스 설정]

# 팀 데이터베이스 연결 정보

**외부 접속 정보** (권장)
- 호스트: mis.iptime.org
- 포트: 13306
- 사용자명: pioneer16
- 데이터베이스: pioneer16
- 비밀번호: pioneer26

**연결 예시 (Node.js mysql2)**
```javascript
const mysql = require('mysql2/promise');

const connection = await mysql.createConnection({
  host: 'mis.iptime.org',
  port: 13306,
  user: 'pioneer16',
  password: 'pioneer26',
  database: 'pioneer16'
});
```

**연결 예시 (터미널)**
```bash
mysql -h mis.iptime.org -P 13306 -u pioneer16 -ppioneer26 pioneer16
```

**내부 접속 정보** (서버 내부용)
- 호스트: 192.168.0.91
- 포트: 3306

⚠️ **주의: Homebrew mysql 바이너리 사용 금지!**
반드시 Docker 컨테이너를 통해 접속하세요:
```bash
# Docker 컨테이너 내부에서 실행
docker exec -it mariadb mysql -u pioneer16 -ppioneer26 pioneer16
```
