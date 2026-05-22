#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: npm run build-dar -- path/to/daml/project" >&2
  exit 1
fi

PROJECT_DIR="$1"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "DAML project directory not found: $PROJECT_DIR" >&2
  exit 1
fi

cd "$PROJECT_DIR"
dpm build
