# syntax=docker/dockerfile:1.7

# --- builder ---
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY backend/package.json ./backend/
COPY frontend-shared/package.json ./frontend-shared/
COPY shared/types/package.json ./shared/types/

RUN pnpm install --frozen-lockfile --filter backend... || pnpm install --filter backend...

COPY backend ./backend
COPY shared/types ./shared/types
RUN pnpm --filter backend build

# --- runtime ---
FROM node:20-alpine AS runtime
RUN addgroup -g 1001 app && adduser -u 1001 -G app -D app
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared/types/package.json ./shared/types/

RUN pnpm install --prod --filter backend... --no-frozen-lockfile

USER app
ENV NODE_ENV=production
ENV PORT=9536
EXPOSE 9536

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:9536/healthz || exit 1

CMD ["node", "backend/dist/server.js"]
