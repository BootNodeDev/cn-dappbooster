#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/splice-common.sh"

cd "$ROOT"

GATEWAY_MODE="wallet-gateway-devkit"
WITH_SPLICE=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --with-splice)
      WITH_SPLICE=1
      ;;
    --no-splice)
      WITH_SPLICE=0
      ;;
    wallet-gateway | wallet-gateway-devkit)
      GATEWAY_MODE="$1"
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
  shift
done

docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop and retry."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."

check_docker_memory

if [ "$WITH_SPLICE" = "1" ]; then
  check_localnet_hosts
  ensure_splice_bundle

  log "Pulling Splice LocalNet images"
  splice_compose pull --quiet || splice_compose pull

  log "Starting Splice LocalNet profiles: ${SPLICE_PROFILES[*]}"
  COMPOSE_IGNORE_ORPHANS=true splice_compose up -d

  wait_http "http://localhost:4903/api/validator/readyz" "sv validator" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"
  wait_http "http://localhost:2903/api/validator/readyz" "app-user validator" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"
  wait_http "http://localhost:2975/readyz" "app-user JSON API" "${SPLICE_HEALTH_TIMEOUT_SECONDS:-300}"
fi

wallet_gateway_compose() {
  docker compose \
    --env-file "$ROOT/env/.env.wallet-gateway" \
    --project-directory "$ROOT" \
    "$@"
}

wallet_gateway_devkit_compose() {
  docker compose \
    --env-file "$ROOT/env/.env.wallet-gateway" \
    --env-file "$ROOT/env/.env.wallet-gateway-devkit" \
    --project-directory "$ROOT" \
    "$@"
}

start_wallet_gateway() {
  load_env_file "$ROOT/env/.env.wallet-gateway"
  log "Starting wallet-gateway"
  COMPOSE_IGNORE_ORPHANS=true wallet_gateway_compose up -d --build wallet-gateway
  wait_http "http://localhost:${WALLET_GATEWAY_PORT:-3010}/readyz" "wallet-gateway" "${WALLET_GATEWAY_HEALTH_TIMEOUT_SECONDS:-120}"
}

start_wallet_gateway_devkit() {
  load_env_file "$ROOT/env/.env.wallet-gateway"
  load_env_file "$ROOT/env/.env.wallet-gateway-devkit"
  require_devkit_auth_config
  log "Starting wallet-gateway-devkit"
  COMPOSE_IGNORE_ORPHANS=true wallet_gateway_devkit_compose up -d --build wallet-gateway wallet-gateway-devkit
  wait_http "http://localhost:${WALLET_GATEWAY_DEVKIT_PORT:-3011}/health" "wallet-gateway-devkit" "${WALLET_GATEWAY_DEVKIT_HEALTH_TIMEOUT_SECONDS:-120}"
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
  splice localnet          $WITH_SPLICE
  gateway mode            $GATEWAY_MODE
  wallet-gateway URL      http://localhost:${WALLET_GATEWAY_PORT:-3010}
  devkit URL              http://localhost:${WALLET_GATEWAY_DEVKIT_PORT:-3011}
  app-user wallet UI      http://wallet.localhost:2000
  app-user JSON API       http://localhost:2975
  app-user Ledger API     grpc://localhost:2901
  app-user Validator API  http://localhost:2903
  Scan UI                 http://scan.localhost:4000
  SV UI                   http://sv.localhost:4000
EOF
