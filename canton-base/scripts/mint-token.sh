#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$ROOT/.env"
set +a

SUBJECT="${1:-$CANTON_ADMIN_USER_ID}"

python3 - "$SUBJECT" "$CANTON_AUTH_AUDIENCE" "$CANTON_AUTH_SECRET" <<'PY'
import base64
import hashlib
import hmac
import json
import sys

subject, audience, secret = sys.argv[1:4]

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

header = {"alg": "HS256", "typ": "JWT"}
payload = {"sub": subject, "aud": audience}
encoded = f"{b64url(json.dumps(header, separators=(',', ':')).encode())}.{b64url(json.dumps(payload, separators=(',', ':')).encode())}"
sig = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).digest()
print(f"{encoded}.{b64url(sig)}")
PY
