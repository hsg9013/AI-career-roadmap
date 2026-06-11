import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

// T036: 공유 axios 인스턴스 + 401 refresh 회전 1회 + 표준 헤더
// web/mobile 양쪽이 동일 클라이언트 사용. base URL은 .env(VITE_API_BASE_URL) 우선.

export interface ApiClientOptions {
  baseURL?: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => Promise<string | null>; // refresh 시도 → 새 access token 반환 또는 null
}

let client: AxiosInstance | null = null;
let opts: ApiClientOptions = {};

export function configureApi(options: ApiClientOptions): void {
  opts = options;
  client = null; // 재생성 트리거
}

export function getApi(): AxiosInstance {
  if (client) return client;

  const baseURL =
    opts.baseURL ??
    (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined) ??
    'http://localhost:9536/v1';

  const instance = axios.create({
    baseURL,
    timeout: 15_000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config) => {
    const token = opts.getAccessToken?.();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // 401 → onUnauthorized 호출(예: refresh) → 한 번 재시도
  // 단, 인증 엔드포인트(refresh/login/logout) 자체의 401 은 회전 대상에서 제외한다.
  // 그렇지 않으면 refresh 가 401 일 때 onUnauthorized→refresh→401… 무한 재귀가 발생한다.
  const isAuthEndpoint = (url?: string): boolean =>
    !!url && /\/auth\/(refresh|login|logout)\b/.test(url);

  instance.interceptors.response.use(
    (resp) => resp,
    async (error) => {
      const original = error.config as AxiosRequestConfig & { _retry?: boolean };
      if (
        error.response?.status === 401 &&
        !original._retry &&
        !isAuthEndpoint(original.url) &&
        opts.onUnauthorized
      ) {
        original._retry = true;
        const newToken = await opts.onUnauthorized();
        if (newToken) {
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
          return instance.request(original);
        }
      }
      return Promise.reject(error);
    },
  );

  client = instance;
  return instance;
}
