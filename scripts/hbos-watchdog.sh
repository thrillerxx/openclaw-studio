#!/usr/bin/env bash
set -euo pipefail

# HBOS watchdog (local)
# - Checks Studio health endpoint periodically.
# - If it fails, restarts `npm start`.
#
# Safe-by-default: binds to localhost only.

PORT="${PORT:-3000}"
CHECK_URL="${CHECK_URL:-http://127.0.0.1:${PORT}/api/studio}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-15}"
LOG_PATH="${LOG_PATH:-/tmp/hbos-watchdog.log}"

WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"

log() {
  printf "%s %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_PATH" >/dev/null
}

start_server() {
  log "Starting HBOS server…"
  (cd "$WORKDIR" && nohup env PORT="$PORT" NEXT_TELEMETRY_DISABLED=1 NODE_NO_WARNINGS=1 OPENCLAW_GATEWAY_PORT=18790 npm start >>/tmp/hbos-next.log 2>&1 &) >/dev/null 2>&1 || true
}

restart_server() {
  log "Restarting HBOS server…"
  pkill -f "next-server (v" >/dev/null 2>&1 || true
  start_server
}

log "HBOS watchdog running. URL=$CHECK_URL interval=${INTERVAL_SECONDS}s"

while true; do
  if curl -fsS --max-time 2 "$CHECK_URL" >/dev/null 2>&1; then
    sleep "$INTERVAL_SECONDS"
    continue
  fi

  log "Health check failed."
  restart_server
  sleep "$INTERVAL_SECONDS"
done
