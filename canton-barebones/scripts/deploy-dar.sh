#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/deploy-dar.sh path/to/file.dar" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DAR_PATH="$1"

if [ ! -f "$DAR_PATH" ]; then
  echo "DAR not found: $DAR_PATH" >&2
  exit 1
fi

mkdir -p "$ROOT/dars"
DAR_NAME="$(basename "$DAR_PATH")"
cp "$DAR_PATH" "$ROOT/dars/$DAR_NAME"

docker compose --project-directory "$ROOT" exec -T canton /app/bin/canton \
  run /dev/stdin \
  --no-tty \
  -C canton.remote-participants.participant1.ledger-api.address=127.0.0.1,canton.remote-participants.participant1.ledger-api.port=5011,canton.remote-participants.participant1.admin-api.address=127.0.0.1,canton.remote-participants.participant1.admin-api.port=5012 <<SCRIPT
utils.retry_until_true {
  participant1.synchronizers.active("local")
}
participant1.dars.upload("/dars/$DAR_NAME")
SCRIPT

echo "deployed $DAR_NAME"
