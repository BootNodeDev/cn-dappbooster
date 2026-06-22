#!/usr/bin/env bash
set -euo pipefail

# This script stops the gateway compose file and the optional Splice LocalNet
# compose bundle without deleting Docker volumes.

# Step 1: load shared paths and compose helpers.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/splice-common.sh"

cd "$ROOT"

# Step 2: stop the local gateway compose services owned by this repository.
log "Stopping wallet-gateway services"
docker compose \
  --project-directory "$ROOT" \
  down

# Step 3: stop the downloaded Splice bundle only when it exists locally.
if [ -f "$LOCALNET_DIR/compose.yaml" ]; then
  log "Stopping Splice LocalNet containers, preserving data volumes"
  splice_compose down
else
  warn "Splice bundle is not present; skipping LocalNet down"
fi
