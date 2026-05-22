# syntax=docker/dockerfile:1.7

# --- builder ---
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY frontend-web/package.json ./frontend-web/
COPY frontend-shared/package.json ./frontend-shared/
COPY shared/types/package.json ./shared/types/

RUN pnpm install --frozen-lockfile --filter frontend-web... || pnpm install --filter frontend-web...

COPY frontend-web ./frontend-web
COPY frontend-shared ./frontend-shared
COPY shared/types ./shared/types
COPY specs/001-ai-career-roadmap/contracts ./specs/001-ai-career-roadmap/contracts

RUN pnpm --filter @ai-career/shared-types gen || true
RUN pnpm --filter frontend-web build

# --- runtime: nginx static ---
FROM nginx:1.27-alpine AS runtime

# 컨테이너 내부 nginx는 9516에서 정적 자산 서빙. 운영 진입점 nginx(별도 컨테이너)가 9516을 upstream으로 사용.
COPY infra/docker/frontend-web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend-web/dist /usr/share/nginx/html

EXPOSE 9516

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:9516/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
