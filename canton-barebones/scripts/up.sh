#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/splice-common.sh"

cd "$ROOT"

GATEWAY_MODE="${1:-wallet-gateway-devkit}"

docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop and retry."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."

require_auth_config
check_docker_memory
check_localnet_hosts
ensure_splice_bundle

log "Pulling Splice LocalNet images"
splice_compose pull --quiet || splice_compose pull

log "Starting Splice LocalNet profiles: ${SPLICE_PROFILES[*]}"
COMPOSE_IGNORE_ORPHANS=true splice_compose up -d

wait_http "http://localhost:4903/api/validator/readyz" "sv validator" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"
wait_http "http://localhost:2903/api/validator/readyz" "app-user validator" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"
wait_http "http://localhost:2975/readyz" "app-user JSON API" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"

start_wallet_gateway() {
  log "Starting wallet-gateway"
  COMPOSE_IGNORE_ORPHANS=true docker compose \
    --project-directory "$ROOT" \
    up -d --build wallet-gateway
  wait_http "http://localhost:3010/readyz" "wallet-gateway" "${WALLET_GATEWAY_HEALTH_TIMEOUT_SECONDS:-120}"
}

start_wallet_gateway_devkit() {
  log "Starting wallet-gateway-devkit"
  COMPOSE_IGNORE_ORPHANS=true docker compose --project-directory "$ROOT" up -d --build wallet-gateway wallet-gateway-devkit
  wait_http "http://localhost:3011/health" "wallet-gateway-devkit" "${WALLET_GATEWAY_DEVKIT_HEALTH_TIMEOUT_SECONDS:-120}"
}

case "$GATEWAY_MODE" in
  wallet-gateway)
    start_wallet_gateway
    ;;
  wallet-gateway-devkit)
    start_wallet_gateway_devkit
    ;;
  *)
    die "Unknown gateway mode: $GATEWAY_MODE. Use wallet-gateway or wallet-gateway-devkit."
    ;;
esac

cat <<EOF

Local stack is up:
  gateway mode            $GATEWAY_MODE
  wallet-gateway URL      http://localhost:3010
  devkit URL              http://localhost:3011
  app-user wallet UI      http://wallet.localhost:2000
  app-user JSON API       http://localhost:2975
  app-user Ledger API     grpc://localhost:2901
  app-user Validator API  http://localhost:2903
  Scan UI                 http://scan.localhost:4000
  SV UI                   http://sv.localhost:4000
EOF
