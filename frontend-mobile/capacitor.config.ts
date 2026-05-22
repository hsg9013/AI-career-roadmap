import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sumzip.p16',
  appName: 'AI Career Roadmap',
  webDir: 'dist',
  server: {
    // 운영 빌드는 번들된 자산을 사용. 개발 핫리로드 시 아래 url로 dev 서버 연결 가능
    // url: 'http://192.168.x.x:9516',
    // cleartext: true,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
