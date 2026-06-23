#!/usr/bin/env bash
set -euo pipefail

# This script starts the Canton gateway layer. The default is Splice plus
# wallet-gateway-tools; callers can pass --no-splice for external Canton/Splice
# endpoints or wallet-gateway to expose only the official gateway.

# Step 1: load shared config, logging, compose wrappers, and validation helpers.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Load shared paths, env-file loading, Splice compose helpers, logging, waits,
# and validation used by every stack lifecycle script.
# shellcheck disable=SC1091
source "$SCRIPT_DIR/splice-common.sh"

cd "$ROOT"

GATEWAY_MODE="wallet-gateway-tools"
WITH_SPLICE=1

# Prints the supported startup modes without touching Docker.
usage() {
  cat <<EOF
Usage: npm run canton:up -- [--splice|--no-splice] [wallet-gateway|wallet-gateway-tools]

Defaults:
  --splice wallet-gateway-tools

Examples:
  npm run canton:up
  npm run canton:up -- wallet-gateway
  npm run canton:up -- --no-splice wallet-gateway-tools
EOF
}

# Step 2: parse a small command surface: Splice on/off plus one gateway mode.
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --splice | --with-splice)
      WITH_SPLICE=1
      ;;
    --no-splice)
      WITH_SPLICE=0
      ;;
    wallet-gateway | wallet-gateway-tools)
      GATEWAY_MODE="$1"
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
  shift
done

# Step 3: fail early if Docker or Compose cannot run the selected stack.
docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop and retry."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."

check_docker_memory

# Step 4: optionally start Splice LocalNet from the official downloaded bundle.
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

# Builds the local compose command for the official wallet-gateway service only.
wallet_gateway_compose() {
  docker compose \
    --env-file "$ROOT/env/.env.wallet-gateway" \
    --project-directory "$ROOT" \
    "$@"
}

# Builds the local compose command for tools mode, where tools needs both env files.
wallet_gateway_tools_compose() {
  docker compose \
    --env-file "$ROOT/env/.env.wallet-gateway" \
    --env-file "$ROOT/env/.env.wallet-gateway-tools" \
    --project-directory "$ROOT" \
    "$@"
}

# Starts the official wallet-gateway and exposes it on WALLET_GATEWAY_PORT.
start_wallet_gateway() {
  load_env_file "$ROOT/env/.env.wallet-gateway"
  log "Starting wallet-gateway"
  COMPOSE_IGNORE_ORPHANS=true wallet_gateway_compose up -d --build wallet-gateway
  wait_http "http://localhost:${WALLET_GATEWAY_PORT:-3010}/readyz" "wallet-gateway" "${WALLET_GATEWAY_HEALTH_TIMEOUT_SECONDS:-120}"
}

# Starts wallet-gateway plus tools; tools owns /rpc and forwards gateway routes upstream.
start_wallet_gateway_tools() {
  load_env_file "$ROOT/env/.env.wallet-gateway"
  load_env_file "$ROOT/env/.env.wallet-gateway-tools"
  require_tools_auth_config
  log "Starting wallet-gateway-tools"
  COMPOSE_IGNORE_ORPHANS=true wallet_gateway_tools_compose up -d --build wallet-gateway wallet-gateway-tools
  wait_http "http://localhost:${WALLET_GATEWAY_TOOLS_PORT:-3011}/health" "wallet-gateway-tools" "${WALLET_GATEWAY_TOOLS_HEALTH_TIMEOUT_SECONDS:-120}"
}

# Step 5: start the requested public gateway surface.
case "$GATEWAY_MODE" in
  wallet-gateway)
    start_wallet_gateway
    ;;
  wallet-gateway-tools)
    start_wallet_gateway_tools
    ;;
  *)
    die "Unknown gateway mode: $GATEWAY_MODE. Use wallet-gateway or wallet-gateway-tools."
    ;;
esac

# Step 6: print the URLs operators need after the containers become healthy.
cat <<EOF

Local stack is up:
  splice localnet         $WITH_SPLICE
  gateway mode            $GATEWAY_MODE
  wallet-gateway URL      http://localhost:${WALLET_GATEWAY_PORT:-3010}
  tools URL              http://localhost:${WALLET_GATEWAY_TOOLS_PORT:-3011}
  app-user wallet UI      http://wallet.localhost:2000
  app-user JSON API       http://localhost:2975
  app-user Ledger API     grpc://localhost:2901
  app-user Validator API  http://localhost:2903
  Scan UI                 http://scan.localhost:4000
  SV UI                   http://sv.localhost:4000
EOF
