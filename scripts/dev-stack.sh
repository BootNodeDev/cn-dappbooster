#!/usr/bin/env bash
#
# dev-stack.sh — start or stop the full local Canton dApp stack.
#
# Docker lifecycle is managed separately from the stack: start/quit Docker with
# `docker-up` / `docker-down` (macOS only), the Docker app, or your CLI. `up`
# and `down` assume Docker is already running and never start or quit it.
#
# Usage:
#   ./scripts/dev-stack.sh             # interactive arrow-key menu (default)
#   ./scripts/dev-stack.sh menu        # same as above
#   ./scripts/dev-stack.sh install     # install + link every workspace from the repo root (npm install)
#   ./scripts/dev-stack.sh docker-up   # macOS only: launch Docker Desktop, wait for the daemon
#   ./scripts/dev-stack.sh up          # start the stack (containers, DAR, dev servers, extension)
#   ./scripts/dev-stack.sh down        # stop dev servers and tear down containers
#   ./scripts/dev-stack.sh docker-down # macOS only: quit Docker Desktop
#   ./scripts/dev-stack.sh status      # show what is currently running
#   ./scripts/dev-stack.sh extension   # build the Chrome extension and copy it to ~/Desktop
#   ./scripts/dev-stack.sh mock-up     # mock-only: mocked wallet-service + carpincho web app (no Docker)
#   ./scripts/dev-stack.sh mock-down   # stop the mocked wallet-service + carpincho web app only
#
# What `up` starts (in order; Docker must already be running):
#   1. Canton + Postgres + wallet-service containers (npm run canton:up)
#   2. Health checks (canton + wallet-service)
#   3. Builds and deploys the Daml DAR (name derived from daml.yaml)
#   4. Carpincho wallet dev server  -> http://localhost:3011  (background)
#   5. dApp frontend dev server     -> http://localhost:3012  (background)
#   6. Builds the Chrome extension and copies it to ~/Desktop/dist-extension
#
# `down` reverses 4/5 (kills the dev servers) and tears down the containers.

set -euo pipefail

# Resolve repo root from this script's location so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RUN_DIR="${TMPDIR:-/tmp}/cn-dev-stack"
WALLET_LOG="$RUN_DIR/wallet-dev.log"
DAPP_LOG="$RUN_DIR/dapp-dev.log"
WALLET_PID="$RUN_DIR/wallet-dev.pid"
DAPP_PID="$RUN_DIR/dapp-dev.pid"
MOCK_WS_LOG="$RUN_DIR/mock-wallet-service.log"
MOCK_WS_PID="$RUN_DIR/mock-wallet-service.pid"

# Derive the DAR name from daml.yaml so renames/bumps need no edits here.
DAML_DIR="dapp/daml"
DAR_NAME="$(awk '/^name:/{n=$2} /^version:/{v=$2} END{print n"-"v".dar"}' "$DAML_DIR/daml.yaml")"
DAR_PATH="$DAML_DIR/.daml/dist/$DAR_NAME"
EXT_SRC="carpincho-wallet/dist-extension"
EXT_DEST="$HOME/Desktop/$(basename "$EXT_SRC")"

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# Carpincho is an optional workspace; a custom scaffold can omit it. Guard the
# wallet/extension steps on its presence so the rest of the stack still works.
has_carpincho() { [ -d carpincho-wallet ]; }

case "$DAR_NAME" in
  -.dar | -*.dar | *-.dar) die "Could not derive DAR name from $DAML_DIR/daml.yaml (got '$DAR_NAME')" ;;
esac

wait_for() { # wait_for <seconds> <logfile> <grep-pattern> <label>
  local timeout="$1" file="$2" pattern="$3" label="$4" i
  for ((i = 0; i < timeout; i++)); do
    if [ -f "$file" ] && grep -qiE "$pattern" "$file" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  warn "$label did not report ready within ${timeout}s (check $file)"
  return 1
}

build_extension() {
  if ! has_carpincho; then
    log "Carpincho wallet absent; skipping extension build."
    return 0
  fi

  # A fresh clone may have no deps yet; one root install links every workspace.
  if [ ! -d node_modules ]; then
    install_deps
  fi

  log "Building the Carpincho Chrome extension..."
  npm run carpincho:build:extension
  log "Copying extension to $EXT_DEST"
  rm -rf "$EXT_DEST"
  cp -R "$EXT_SRC" "$EXT_DEST"
  log "Extension ready at $EXT_DEST"
  echo "   Load it via chrome://extensions -> Developer mode -> Load unpacked"
}

install_deps() { # one root npm install links every workspace
  log "Installing workspace dependencies (root npm install)..."
  npm install
  log "Workspaces installed and linked."
}

docker_up() { # macOS only — launch Docker Desktop and wait for the daemon
  if [ "$(uname -s)" != "Darwin" ]; then
    warn "docker-up is macOS only. Start Docker with your platform's tools, then run 'up'."
    return 0
  fi
  if docker info >/dev/null 2>&1; then
    log "Docker daemon already running."
    return 0
  fi
  log "Starting Docker Desktop and waiting for the daemon..."
  open -a Docker
  local i
  for ((i = 0; i < 120; i++)); do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
  docker info >/dev/null 2>&1 || die "Docker daemon did not come up within 120s"
  log "Docker daemon is ready."
}

docker_down() { # macOS only — quit Docker Desktop
  if [ "$(uname -s)" != "Darwin" ]; then
    warn "docker-down is macOS only. Stop Docker with your platform's tools."
    return 0
  fi
  log "Quitting Docker Desktop..."
  osascript -e 'quit app "Docker Desktop"' 2>/dev/null \
    || osascript -e 'quit app "Docker"' 2>/dev/null \
    || warn "Could not quit Docker Desktop (already closed?)"
}

up() {
  mkdir -p "$RUN_DIR"

  # A fresh clone may have no deps yet; one root install links every workspace.
  if [ ! -d node_modules ]; then
    install_deps
  fi

  # Docker must already be running (start it via 'docker-up', the app, or your CLI).
  docker info >/dev/null 2>&1 \
    || die "Docker daemon not reachable. Start Docker first (menu: docker-up, the Docker app, or your CLI), then run 'up'."

  # canton .env (README step) — create from example if missing.
  if [ ! -f canton-barebones/.env ]; then
    log "Creating canton-barebones/.env from .env.example"
    cp canton-barebones/.env.example canton-barebones/.env
  fi

  # 1. Containers
  log "Bringing up Canton + Postgres + wallet-service containers..."
  npm run canton:up

  # 2. Health
  log "Checking Canton health..."
  npm run canton:health
  log "Checking wallet-service health..."
  npm run wallet-service:health && echo

  # 3. Build + deploy DAR
  log "Building the $DAR_NAME DAR..."
  npm run build-dar -- "$DAML_DIR"
  log "Deploying the DAR to Canton..."
  npm run deploy-dar -- "$DAR_PATH"

  # 4. Carpincho wallet dev server (3011)
  if ! has_carpincho; then
    log "Carpincho wallet absent; skipping wallet dev server."
  elif lsof -nP -iTCP:3011 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3011 already in use; skipping wallet dev server."
  else
    log "Starting Carpincho wallet dev server -> http://localhost:3011"
    nohup npm run wallet:dev >"$WALLET_LOG" 2>&1 &
    echo $! >"$WALLET_PID"
    wait_for 60 "$WALLET_LOG" "ready in|localhost:3011" "wallet dev server" || true
  fi

  # 5. dApp frontend dev server (3012)
  if lsof -nP -iTCP:3012 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3012 already in use; skipping dApp dev server."
  else
    log "Starting dApp frontend dev server -> http://localhost:3012"
    nohup npm run app:dev >"$DAPP_LOG" 2>&1 &
    echo $! >"$DAPP_PID"
    wait_for 60 "$DAPP_LOG" "ready in|localhost:3012" "dApp dev server" || true
  fi

  # 6. Build extension + copy to Desktop
  build_extension

  echo
  log "Stack is up:"
  echo "   wallet-service   http://localhost:3010"
  if has_carpincho; then
    echo "   carpincho wallet http://localhost:3011   (log: $WALLET_LOG)"
  fi
  echo "   dApp frontend    http://localhost:3012   (log: $DAPP_LOG)"
  echo "   Canton JSON API  http://localhost:3013"
  if has_carpincho; then
    echo "   extension folder $EXT_DEST"
    echo "   Load the extension via chrome://extensions -> Developer mode -> Load unpacked"
  fi
}

stop_pidfile() { # stop_pidfile <pidfile> <label>
  local pidfile="$1" label="$2" pid
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      log "Stopping $label (pid $pid)"
      # kill the npm process group so child vite dies too
      kill "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
}

down() {
  # 1. Dev servers
  stop_pidfile "$WALLET_PID" "wallet dev server"
  stop_pidfile "$DAPP_PID" "dApp dev server"
  # Belt-and-suspenders: kill any stray vite on our ports.
  if has_carpincho; then
    pkill -f "carpincho-wallet run dev" 2>/dev/null || true
  fi
  pkill -f "vite --host localhost --port 3012" 2>/dev/null || true

  # 2. Containers (only if the daemon is reachable). Docker itself is left
  # running — quit it separately with 'docker-down', the app, or your CLI.
  if docker info >/dev/null 2>&1; then
    log "Tearing down Canton containers..."
    npm run canton:down || warn "canton:down reported an error"
  else
    warn "Docker daemon not reachable; skipping canton:down"
  fi

  echo
  log "Stack is down. Ports 3010-3018:"
  if lsof -nP -iTCP:3010-3018 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3010-3018 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
  else
    echo "   (all free)"
  fi
}

wait_http() { # wait_http <seconds> <url> <label>
  local timeout="$1" url="$2" label="$3" i
  for ((i = 0; i < timeout; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  warn "$label did not answer at $url within ${timeout}s"
  return 1
}

mock_up() {
  mkdir -p "$RUN_DIR"

  # Mock mode needs no Docker — it short-circuits the Canton SDK. A fresh clone
  # may have no deps yet; one root install links every workspace, including the
  # wallet-service started below.
  if [ ! -d node_modules ]; then
    install_deps
  fi

  # Mocked data server (wallet-service in MOCK MODE) -> http://localhost:3010
  if lsof -nP -iTCP:3010 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3010 already in use; skipping mocked wallet-service."
  else
    log "Starting mocked wallet-service (MOCK MODE) -> http://localhost:3010"
    WALLET_SERVICE_MOCK=1 nohup npm run wallet-service:dev >"$MOCK_WS_LOG" 2>&1 &
    echo $! >"$MOCK_WS_PID"
    wait_http 60 "http://localhost:3010/health" "mocked wallet-service" || true
  fi

  # Carpincho web app -> http://localhost:3011
  if ! has_carpincho; then
    log "Carpincho wallet absent; skipping carpincho web app."
  elif lsof -nP -iTCP:3011 -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port 3011 already in use; skipping carpincho web app."
  else
    log "Starting Carpincho web app -> http://localhost:3011"
    nohup npm run wallet:dev >"$WALLET_LOG" 2>&1 &
    echo $! >"$WALLET_PID"
    wait_for 60 "$WALLET_LOG" "ready in|localhost:3011" "carpincho web app" || true
  fi

  echo
  log "Mock stack is up:"
  echo "   mocked wallet-service  http://localhost:3010   (log: $MOCK_WS_LOG)"
  if has_carpincho; then
    echo "   carpincho web app      http://localhost:3011   (log: $WALLET_LOG)"
  fi
  echo "   No Docker / Canton / dApp frontend in this mode. Stop with: $0 mock-down"
}

mock_down() {
  stop_pidfile "$MOCK_WS_PID" "mocked wallet-service"
  stop_pidfile "$WALLET_PID" "carpincho web app"
  # Belt-and-suspenders for stray processes on our ports.
  pkill -f "WALLET_SERVICE_MOCK" 2>/dev/null || true
  pkill -f "tsx watch src/server.ts" 2>/dev/null || true
  if has_carpincho; then
    pkill -f "carpincho-wallet run dev" 2>/dev/null || true
  fi

  echo
  log "Mock stack is down. Ports 3010/3011:"
  if lsof -nP -iTCP:3010,3011 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3010,3011 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
  else
    echo "   (both free)"
  fi
}

menu() {
  if [ ! -t 0 ] || [ ! -t 1 ]; then
    die "The menu needs an interactive terminal. Run a subcommand directly instead."
  fi

  # Display label per item; `keys` is the matching action dispatched on select.
  local keys=(install docker-up docker-down up down mock-up mock-down extension quit)
  local labels=("Install" "Docker up" "Docker down" "Stack up" "Stack down" "Wallet up" "Wallet down" "Build extension" "Quit")
  local descs=(
    "install + link every workspace (root npm install)"
    "start Docker Desktop, wait for daemon (macOS)"
    "quit Docker Desktop (macOS)"
    "containers, DAR, dev servers, extension"
    "stop dev servers + tear down containers"
    "mock wallet-service + carpincho web app (no Docker)"
    "stop the mock server + web app only"
    "build the extension + copy to ~/Desktop"
    "exit this menu"
  )
  local n=${#keys[@]} sel=0 key rest i num choice

  tput civis 2>/dev/null || true                       # hide cursor
  trap 'tput cnorm 2>/dev/null || true' EXIT INT TERM  # restore on exit

  while true; do
    clear
    printf '\n  \033[1mCanton dApp dev stack\033[0m\n\n'
    for i in "${!keys[@]}"; do
      num=$((i + 1))
      if [ "$i" -eq "$sel" ]; then
        printf '  \033[7m  %d- %-16s %s  \033[0m\n' "$num" "${labels[$i]}" "${descs[$i]}"
      else
        printf '     %d- %-16s %s\n' "$num" "${labels[$i]}" "${descs[$i]}"
      fi
    done
    printf '\n  \033[2m[1-%d] jump    [up/down or j/k] move    [enter] select    [q] quit\033[0m\n' "$n"

    IFS= read -rsn1 key
    case "$key" in
      $'\033')                       # escape sequence (arrow keys)
        IFS= read -rsn2 rest
        case "$rest" in
          '[A') sel=$(((sel - 1 + n) % n)) ;;
          '[B') sel=$(((sel + 1) % n)) ;;
        esac
        continue ;;
      k) sel=$(((sel - 1 + n) % n)); continue ;;
      j) sel=$(((sel + 1) % n)); continue ;;
      [1-9])                          # number key jumps the highlight
        [ "$key" -le "$n" ] && sel=$((key - 1))
        continue ;;
      q | Q) break ;;
      '') ;;                          # Enter -> dispatch below
      *) continue ;;
    esac

    choice="${keys[$sel]}"
    [ "$choice" = "quit" ] && break

    tput cnorm 2>/dev/null || true
    clear
    printf '\n'
    # Run in a subshell so a failing action returns to the menu instead of
    # killing the whole script under `set -e`.
    case "$choice" in
      install)     ( install_deps ) || warn "install did not finish cleanly" ;;
      docker-up)   ( docker_up ) || warn "docker-up did not finish cleanly" ;;
      docker-down) ( docker_down ) || warn "docker-down did not finish cleanly" ;;
      up)          ( up ) || warn "up did not finish cleanly (see output above)" ;;
      down)        ( down ) || warn "down did not finish cleanly" ;;
      mock-up)     ( mock_up ) || warn "mock-up did not finish cleanly" ;;
      mock-down)   ( mock_down ) || warn "mock-down did not finish cleanly" ;;
      extension)   ( build_extension ) || warn "extension build failed" ;;
    esac
    printf '\n  \033[2mPress Enter to return to the menu...\033[0m'
    read -r _ || true
    tput civis 2>/dev/null || true
  done

  tput cnorm 2>/dev/null || true
  clear
}

status() {
  log "Containers:"
  docker ps --filter "name=canton-barebones" --format '   {{.Names}}  {{.Status}}' 2>/dev/null \
    || echo "   (docker daemon not running)"
  log "Listening ports 3010-3018:"
  if lsof -nP -iTCP:3010-3018 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:3010-3018 -sTCP:LISTEN | awk 'NR>1{print "   "$1, $9}'
  else
    echo "   (none)"
  fi
}

case "${1:-menu}" in
  menu)        menu ;;
  install)     install_deps ;;
  docker-up)   docker_up ;;
  up)          up ;;
  down)        down ;;
  docker-down) docker_down ;;
  status)      status ;;
  extension)   build_extension ;;
  mock-up)     mock_up ;;
  mock-down)   mock_down ;;
  *)           die "Usage: $0 {menu|install|docker-up|up|down|docker-down|status|extension|mock-up|mock-down}" ;;
esac
