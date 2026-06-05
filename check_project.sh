#!/usr/bin/env bash
#
# check_project.sh — ai-career-roadmap (mis2601) 서비스 관리 스크립트
#
#   사용법:  ./check_project.sh {start|stop|restart|status}
#
#   - start   : 인프라(OrbStack 도커: mariadb/redis/minio) 확인·기동 후
#               앱 프로세스(backend / worker / web) 기동
#   - stop    : 앱 프로세스만 종료 (인프라 컨테이너는 유지 — 공유 자원)
#   - restart : stop 후 start
#   - status  : 인프라·앱·포트 상태 점검
#
#   런타임 토폴로지:
#     인프라  : infra/docker/docker-compose.yml (mariadb 3306 / redis 6379 / minio 9000)
#     backend : pnpm --filter backend dev          → :9536  (/healthz)
#     worker  : pnpm --filter backend worker:dev    (BullMQ 큐 6종)
#     web     : pnpm --filter frontend-web dev      → :9516  (vite)
#     운영진입: https://p16.sumzip.com
#
set -uo pipefail

# ── 경로/환경 ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

RUN_DIR="$SCRIPT_DIR/.run"
COMPOSE_FILE="$SCRIPT_DIR/infra/docker/docker-compose.yml"
mkdir -p "$RUN_DIR"

# 포트(.env 우선, 없으면 기본값)
BACKEND_PORT="$(grep -E '^PORT=' .env 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' \r')"
WEB_PORT="$(grep -E '^VITE_PORT=' .env 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' \r')"
BACKEND_PORT="${BACKEND_PORT:-9536}"
WEB_PORT="${WEB_PORT:-9516}"

INFRA_SERVICES="mariadb redis minio"

# 앱 서비스 정의: 이름|pidfile|logfile|시작명령|포트(고아 정리용, 없으면 빈값)
# ※ 멀티유저 박스라 명령 패턴(tsx watch src/server.ts 등)이 타 사용자와 겹치므로
#   종료는 PID파일 트리 + "본인 UID 한정 포트 리스너"로만 처리한다.
declare -a APP_SERVICES=(
  "backend|$RUN_DIR/backend.pid|$RUN_DIR/backend.log|pnpm --filter backend dev|$BACKEND_PORT"
  "worker|$RUN_DIR/worker.pid|$RUN_DIR/worker.log|pnpm --filter backend worker:dev|"
  "web|$RUN_DIR/web.pid|$RUN_DIR/web.log|pnpm --filter frontend-web dev|$WEB_PORT"
)

# ── 색상 출력 ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_B=$'\033[1m'; C_0=$'\033[0m'
else
  C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_B=""; C_0=""
fi
ok()   { echo "  ${C_OK}✓${C_0} $*"; }
warn() { echo "  ${C_WARN}•${C_0} $*"; }
err()  { echo "  ${C_ERR}✗${C_0} $*"; }
hdr()  { echo "${C_B}$*${C_0}"; }

# ── 유틸 ────────────────────────────────────────────────────────────────────
is_alive() { local p="$1"; [ -n "$p" ] && kill -0 "$p" 2>/dev/null; }

pid_from_file() { local f="$1"; [ -f "$f" ] && cat "$f" 2>/dev/null || true; }

# pid 및 모든 자식 프로세스를 재귀적으로 종료
kill_tree() {
  local pid="$1" sig="${2:-TERM}" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child" "$sig"
  done
  kill -"$sig" "$pid" 2>/dev/null || true
}

port_listening() { nc -z -w1 127.0.0.1 "$1" >/dev/null 2>&1; }

# ── 도커/인프라 ──────────────────────────────────────────────────────────────
ensure_docker() {
  if docker info >/dev/null 2>&1; then
    ok "Docker 데몬 정상"
    return 0
  fi
  warn "Docker 데몬 미동작 — OrbStack 기동 시도"
  orb start >/dev/null 2>&1 || open -a OrbStack >/dev/null 2>&1 || true
  for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && { ok "OrbStack 기동 완료 (${i}s)"; return 0; }
    sleep 1
  done
  err "Docker 데몬을 띄우지 못했습니다 (OrbStack 확인 필요)"
  return 1
}

start_infra() {
  hdr "[1/2] 인프라 (도커 컨테이너)"
  ensure_docker || return 1
  if [ ! -f "$COMPOSE_FILE" ]; then
    err "compose 파일 없음: $COMPOSE_FILE"; return 1
  fi
  docker compose -f "$COMPOSE_FILE" up -d $INFRA_SERVICES >/dev/null 2>&1 \
    && ok "compose up: $INFRA_SERVICES" \
    || { err "compose up 실패"; return 1; }
  # mariadb healthy 대기
  for i in $(seq 1 30); do
    local st; st="$(docker inspect -f '{{.State.Health.Status}}' mariadb 2>/dev/null)"
    [ "$st" = "healthy" ] && { ok "mariadb healthy (${i}s)"; break; }
    [ "$i" -eq 30 ] && warn "mariadb healthcheck 대기 시간 초과(계속 진행)"
    sleep 1
  done
  port_listening 6379 && ok "redis :6379" || warn "redis :6379 미응답"
  port_listening 9000 && ok "minio :9000" || warn "minio :9000 미응답"
}

# ── 앱 프로세스 ──────────────────────────────────────────────────────────────
start_one() {
  local name="$1" pidfile="$2" logfile="$3" cmd="$4"
  local existing; existing="$(pid_from_file "$pidfile")"
  if is_alive "$existing"; then
    warn "$name 이미 실행 중 (pid $existing)"; return 0
  fi
  echo "" >> "$logfile"
  echo "==== start $(date '+%Y-%m-%d %H:%M:%S') ====" >> "$logfile"
  nohup $cmd >> "$logfile" 2>&1 &
  local pid=$!
  echo "$pid" > "$pidfile"
  ok "$name 시작 (pid $pid) → ${C_DIM}${logfile#$SCRIPT_DIR/}${C_0}"
}

# 본인(UID) 소유로, 주어진 포트를 LISTEN 중인 PID 목록
own_port_pids() {
  local port="$1"
  [ -n "$port" ] || return 0
  lsof -nP -tiTCP:"$port" -sTCP:LISTEN -a -u "$(id -u)" 2>/dev/null
}

stop_one() {
  local name="$1" pidfile="$2" port="$3"
  local pid; pid="$(pid_from_file "$pidfile")"
  local acted=0
  # 1) PID 파일 기준 프로세스 트리 종료
  if is_alive "$pid"; then
    kill_tree "$pid" TERM
    for i in $(seq 1 10); do is_alive "$pid" || break; sleep 0.5; done
    is_alive "$pid" && kill_tree "$pid" KILL
    acted=1
  fi
  # 2) 본인 UID 한정·해당 포트 리스너(고아) 정리 — 타 사용자/타 프로젝트 안전
  local p
  for p in $(own_port_pids "$port"); do
    is_alive "$p" || continue
    kill_tree "$p" TERM
    for i in $(seq 1 6); do is_alive "$p" || break; sleep 0.5; done
    is_alive "$p" && kill_tree "$p" KILL
    acted=1
  done
  rm -f "$pidfile"
  [ "$acted" -eq 1 ] && ok "$name 종료" || warn "$name 실행 중 아님"
}

start_app() {
  hdr "[2/2] 앱 프로세스"
  local entry name pidfile logfile cmd port
  for entry in "${APP_SERVICES[@]}"; do
    IFS='|' read -r name pidfile logfile cmd port <<< "$entry"
    start_one "$name" "$pidfile" "$logfile" "$cmd"
  done
}

stop_app() {
  hdr "앱 프로세스 종료"
  local entry name pidfile logfile cmd port
  for entry in "${APP_SERVICES[@]}"; do
    IFS='|' read -r name pidfile logfile cmd port <<< "$entry"
    stop_one "$name" "$pidfile" "$port"
  done
}

# ── 헬스 점검 ────────────────────────────────────────────────────────────────
verify() {
  hdr "헬스 점검"
  local code
  for i in $(seq 1 20); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$BACKEND_PORT/healthz" 2>/dev/null)"
    [ "$code" = "200" ] && break
    sleep 1
  done
  [ "$code" = "200" ] && ok "backend  http://localhost:$BACKEND_PORT/healthz → 200" \
                      || err "backend  /healthz → ${code:-no-response}"
  for i in $(seq 1 15); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$WEB_PORT/" 2>/dev/null)"
    [ "$code" = "200" ] && break
    sleep 1
  done
  [ "$code" = "200" ] && ok "web      http://localhost:$WEB_PORT/ → 200" \
                      || err "web      :$WEB_PORT → ${code:-no-response}"
}

# ── status ──────────────────────────────────────────────────────────────────
status() {
  hdr "인프라 (도커)"
  if docker info >/dev/null 2>&1; then
    local line
    for svc in $INFRA_SERVICES; do
      line="$(docker ps --filter "name=^${svc}$" --format '{{.Status}}' 2>/dev/null)"
      [ -n "$line" ] && ok "$svc — $line" || err "$svc — 미실행"
    done
  else
    err "Docker 데몬 미동작"
  fi
  echo
  hdr "앱 프로세스"
  local entry name pidfile logfile cmd port pid
  for entry in "${APP_SERVICES[@]}"; do
    IFS='|' read -r name pidfile logfile cmd port <<< "$entry"
    pid="$(pid_from_file "$pidfile")"
    if is_alive "$pid"; then ok "$name — 실행 중 (pid $pid)"; else err "$name — 중지"; fi
  done
  echo
  hdr "포트"
  port_listening "$BACKEND_PORT" && ok "backend :$BACKEND_PORT LISTEN" || err "backend :$BACKEND_PORT 닫힘"
  port_listening "$WEB_PORT"     && ok "web     :$WEB_PORT LISTEN"     || err "web     :$WEB_PORT 닫힘"
}

# ── 메인 ────────────────────────────────────────────────────────────────────
case "${1:-}" in
  start)
    hdr "▶ 서비스 시작"
    start_infra && start_app && verify
    echo; hdr "완료. 로그: tail -f .run/{backend,worker,web}.log"
    ;;
  stop)
    hdr "■ 서비스 종료"
    stop_app
    echo; warn "인프라 컨테이너는 유지됩니다 (완전 종료: docker compose -f infra/docker/docker-compose.yml stop)"
    ;;
  restart)
    hdr "↻ 서비스 재시작"
    stop_app
    echo
    start_infra && start_app && verify
    echo; hdr "완료."
    ;;
  status)
    status
    ;;
  *)
    echo "사용법: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
