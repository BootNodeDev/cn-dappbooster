#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

timeout="${HEALTH_TIMEOUT_SECONDS:-120}"
health_port="${CANTON_HTTP_HEALTH_PORT:-3016}"
deadline=$((SECONDS + timeout))

while true; do
  health_status="$(
    docker compose ps --format json canton 2>/dev/null \
      | sed -n 's/.*"Health":"\([^"]*\)".*/\1/p'
  )"
  health_body="$(
    curl -fsS "http://127.0.0.1:${health_port}/health" 2>/dev/null || true
  )"

  if [ "$health_status" = "healthy" ] && grep -q "connected-synchronizer : Ok()" <<<"$health_body"; then
    docker compose ps
    echo "canton health-check succeeded"

    wallet_service_port="${WALLET_SERVICE_PORT:-3010}"
    if curl -fsS "http://localhost:${wallet_service_port}/health" >/dev/null 2>&1; then
      echo "wallet-service health-check succeeded (port ${wallet_service_port})"
      exit 0
    fi
    echo "wallet-service health-check failed on port ${wallet_service_port}" >&2
    docker compose logs --tail=120 wallet-service >&2
    exit 1
  fi

  if (( SECONDS >= deadline )); then
    docker compose ps
    docker compose logs --tail=120 canton >&2
    echo "canton health-check failed after ${timeout}s" >&2
    exit 1
  fi

  sleep 2
done
