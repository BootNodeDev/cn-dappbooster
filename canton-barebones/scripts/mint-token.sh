#!/usr/bin/env bash
set -euo pipefail

# Thin Bash entrypoint kept for callers that expect a shell script.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Delegate all token behavior to the Node implementation.
node "$ROOT/scripts/mint-token.mjs" "$@"
