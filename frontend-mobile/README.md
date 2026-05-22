# Frontend Mobile (Capacitor + Ionic Vue)

R-6 결정에 따라 iOS·Android 모바일 앱을 Capacitor 6 + Ionic Vue로 래핑. 코드 자산은 `frontend-shared`와 공유.

## 최초 네이티브 프로젝트 생성 (1회만 실행)

`ios/`·`android/` 디렉터리는 빌드 환경(Xcode·Android Studio·CocoaPods)이 필요하므로 본 저장소에 커밋되지 않은 상태입니다. 다음 명령으로 생성하세요:

```bash
# 의존성 설치
pnpm install

# 웹 자산 1회 빌드 (cap add가 webDir 존재를 확인)
pnpm --filter frontend-mobile build

# 네이티브 프로젝트 추가 (생성 후 ios/ android/ 가 트리에 나타남)
pnpm --filter frontend-mobile exec npx cap add ios
pnpm --filter frontend-mobile exec npx cap add android
```

> 생성된 `ios/` `android/` 디렉터리는 `.gitignore`에서 빌드 산출물(`Pods/`, `DerivedData/`, `build/`, `.gradle/`)만 제외되도록 설정되어 있고, 프로젝트 파일(.xcodeproj, build.gradle 등)은 커밋 대상입니다.

## 일상 개발 사이클

```bash
pnpm --filter frontend-mobile build         # vite build → dist/
pnpm --filter frontend-mobile exec npx cap sync   # dist/ 자산을 네이티브 셸로 복사
pnpm --filter frontend-mobile exec npx cap run ios       # iOS 시뮬레이터
pnpm --filter frontend-mobile exec npx cap run android   # Android 에뮬레이터
```

## 환경 변수

`frontend-mobile/.env` (없으면 루트 `.env` 사용):

```dotenv
# 로컬 backend 접속 (Android 에뮬레이터에서 host loopback)
VITE_API_BASE_URL=http://10.0.2.2:9536/v1

# iOS 시뮬레이터는 http://localhost:9536/v1 사용 가능
# 운영 빌드는 https://p16.sumzip.com/api/v1
```

## 네트워크 표준값

- 운영 API: `https://p16.sumzip.com/api/v1`
- 로컬 API: `http://localhost:9536/v1`
- 앱 ID: `com.sumzip.p16` (capacitor.config.ts)
