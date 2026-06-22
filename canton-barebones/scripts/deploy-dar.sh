#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/deploy-dar.sh path/to/file.dar" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT/env/.env.wallet-gateway-devkit" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/env/.env.wallet-gateway-devkit"
  set +a
fi

DAR_PATH="$1"

if [ ! -f "$DAR_PATH" ]; then
  echo "DAR not found: $DAR_PATH" >&2
  exit 1
fi

# Resolves the JSON API bearer token without requiring LocalNet users to paste one.
resolve_auth_token() {
  if [ -n "${AUTH_TOKEN:-}" ]; then
    printf '%s\n' "$AUTH_TOKEN"
    return 0
  fi
  case "${AUTH_MODE:-self-signed}" in
    self-signed)
      node "$ROOT/scripts/mint-token.mjs" --raw
      ;;
    static-token)
      echo "AUTH_TOKEN is required for static-token auth" >&2
      return 1
      ;;
    oauth-client-credentials)
      echo "deploy-dar requires AUTH_TOKEN when AUTH_MODE=oauth-client-credentials" >&2
      return 1
      ;;
    *)
      echo "Unsupported AUTH_MODE: ${AUTH_MODE:-}" >&2
      return 1
      ;;
  esac
}

json_api_url="${APP_USER_JSON_API_URL:-http://localhost:2975}"
dar_name="$(basename "$DAR_PATH")"
auth_token="$(resolve_auth_token)"

echo "Uploading $dar_name to app-user JSON API at $json_api_url"

http_code="$(
  curl -sS -o /dev/null -w '%{http_code}' \
    -X POST \
    "$json_api_url/v2/packages" \
    -H "Authorization: Bearer $auth_token" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$DAR_PATH"
)"

case "$http_code" in
  200 | 204)
    echo "deployed $dar_name to app-user"
    ;;
  409)
    echo "$dar_name already deployed to app-user"
    ;;
  *)
    echo "DAR upload failed with HTTP $http_code" >&2
    exit 1
    ;;
esac
