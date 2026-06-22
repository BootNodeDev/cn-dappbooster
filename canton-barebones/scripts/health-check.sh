#!/usr/bin/env bash
set -euo pipefail

# This script checks externally visible endpoints for the selected local stack.
# It reports all checks first, then exits non-zero if any endpoint was down.

# Step 1: load shared paths and service env files so port overrides are honored.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/splice-common.sh"

cd "$ROOT"

load_env_file "$ROOT/env/.env.wallet-gateway"
load_env_file "$ROOT/env/.env.wallet-gateway-devkit"

status=0

# Checks one HTTP endpoint and records a non-zero final exit if it is down.
check_http() {
  local label="$1"
  local url="$2"
  printf '%-32s' "$label"
  if curl -fsS "$url" >/dev/null 2>&1; then
    printf 'UP   %s\n' "$url"
  else
    printf 'DOWN %s\n' "$url"
    status=1
  fi
}

# Step 2: check the Splice LocalNet endpoints exposed through the official bundle.
echo "Splice LocalNet"
check_http "sv validator" "http://localhost:4903/api/validator/readyz"
check_http "app-user validator" "http://localhost:2903/api/validator/readyz"
check_http "app-user JSON API" "http://localhost:2975/readyz"
check_http "app-user wallet UI" "http://wallet.localhost:2000"
check_http "Scan UI" "http://scan.localhost:4000"
check_http "SV UI" "http://sv.localhost:4000"

# Step 3: check the gateway layer. Devkit is optional because pure wallet-gateway
# mode does not start the facade.
echo ""
echo "Wallet gateway"
check_http "wallet-gateway" "http://localhost:${WALLET_GATEWAY_PORT:-3010}/readyz"
if docker compose --project-directory "$ROOT" ps --services --filter status=running | grep -qx 'wallet-gateway-devkit'; then
  check_http "wallet-gateway-devkit" "http://localhost:${WALLET_GATEWAY_DEVKIT_PORT:-3011}/health"
fi

# Step 4: print container state to show which compose services are actually running.
echo ""
if docker info >/dev/null 2>&1; then
  if [ "$SPLICE_COMPOSE_PROJECT_NAME" = "$COMPOSE_PROJECT_NAME" ]; then
    echo "Docker compose project: $COMPOSE_PROJECT_NAME"
    COMPOSE_IGNORE_ORPHANS=true docker compose --project-directory "$ROOT" ps
  else
    echo "wallet-gateway-devkit compose:"
    COMPOSE_IGNORE_ORPHANS=true docker compose --project-directory "$ROOT" ps
    if [ -f "$LOCALNET_DIR/compose.yaml" ]; then
      echo ""
      echo "Splice compose:"
      splice_compose ps
    fi
  fi
else
  warn "Docker is not running; skipping container status"
fi

# Step 5: return the accumulated health status to callers and CI.
exit "$status"
