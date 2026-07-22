#!/usr/bin/env bash
set -euo pipefail

DEFAULT_PORT=28123
PROCESS_NAME="smarttrans"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$REPO_ROOT/server/.env"
ENV_TEMPLATE="$REPO_ROOT/server/.env.production.example"

PORT="$DEFAULT_PORT"
RUN_INGEST=0
SKIP_INSTALL=0
SKIP_BUILD=0

if [[ -t 1 ]]; then
  C_BLUE=$'\033[34m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_RESET=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi

log()  { printf '%s[%s]%s %s\n' "$C_BLUE"   "deploy" "$C_RESET" "$*"; }
ok()   { printf '%s[%s]%s %s\n' "$C_GREEN"  "ok"     "$C_RESET" "$*"; }
warn() { printf '%s[%s]%s %s\n' "$C_YELLOW" "warn"   "$C_RESET" "$*" >&2; }
die()  { printf '%s[%s]%s %s\n' "$C_RED"    "error"  "$C_RESET" "$*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: $0 [options]

One-click deploy for SmartTrans: install deps, prepare server/.env,
build the web frontend, and (re)start the Express server under PM2.

Options:
  --port <N>        Server port (written to server/.env, default: $DEFAULT_PORT)
  --ingest          Rebuild the RAG vector store (npm run rag:ingest) before starting
  --skip-install    Skip npm install:all
  --skip-build      Skip the web build
  -h, --help        Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2;;
    --ingest) RUN_INGEST=1; shift;;
    --skip-install) SKIP_INSTALL=1; shift;;
    --skip-build) SKIP_BUILD=1; shift;;
    -h|--help) usage; exit 0;;
    *) die "Unknown argument: $1 (try --help)";;
  esac
done

[[ "$PORT" =~ ^[0-9]+$ ]] || die "Invalid port: $PORT"
(( PORT >= 1 && PORT <= 65535 )) || die "Port out of range: $PORT"

log "Repo root : $REPO_ROOT"
log "Port      : $PORT"
log "Process   : $PROCESS_NAME"
[[ -f "$REPO_ROOT/package.json" && -d "$REPO_ROOT/server" && -d "$REPO_ROOT/web" ]] \
  || die "Must run from the SmartTrans repo root (expected package.json, server/, web/)."

command -v node >/dev/null || die "node not found in PATH."
command -v npm  >/dev/null || die "npm not found in PATH."
command -v pm2  >/dev/null || die "pm2 not found in PATH. Install it with: npm i -g pm2"

INTERACTIVE=1
[[ -t 0 ]] || INTERACTIVE=0

get_env_var() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r' || true
}

set_env_var() {
  local key="$1" val="$2" escaped
  escaped="$(printf '%s' "$val" | sed -e 's/[\\&]/\\&/g')"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i -E "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

is_placeholder() {
  case "$1" in
    ""|"sk-xxxx"|"sk-xxx"|"sk-your-key-here"|"change-me"*|"smarttrans-dev-secret-change-in-production") return 0;;
    *) return 1;;
  esac
}

prompt_for_value() {
  local label="$1" allow_gen="${2:-0}" val
  while true; do
    if [[ "$allow_gen" == "1" ]]; then
      read -rp "$label (press Enter to auto-generate): " val
      if [[ -z "$val" ]]; then
        if command -v openssl >/dev/null; then val="$(openssl rand -hex 32)"
        else val="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"; fi
        printf '%s' "$val"; return 0
      fi
    else
      read -rp "$label: " val
    fi
    if is_placeholder "$val"; then
      warn "Value looks empty or placeholder. Please enter a real value."
      continue
    fi
    printf '%s' "$val"; return 0
  done
}

if [[ "$SKIP_INSTALL" == "1" ]]; then
  warn "Skipping install (--skip-install)."
else
  log "Installing dependencies (install:all)..."
  npm --prefix "$REPO_ROOT" run install:all
  ok "Dependencies installed."
fi

log "Preparing server/.env..."
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_TEMPLATE" ]]; then die "Neither server/.env nor server/.env.production.example found."; fi
  cp "$ENV_TEMPLATE" "$ENV_FILE"
  ok "Created server/.env from .env.production.example."
fi

set_env_var "PORT" "$PORT"
ok "PORT=$PORT written to server/.env."

for key in QWEN_API_KEY DEEPSEEK_API_KEY EMBEDDING_API_KEY JWT_SECRET; do
  cur="$(get_env_var "$key")"
  if is_placeholder "$cur"; then
    if [[ "$INTERACTIVE" == "0" ]]; then
      die "$key is missing or placeholder in server/.env, and stdin is not a TTY. Edit server/.env manually and re-run."
    fi
    case "$key" in
      JWT_SECRET)        val="$(prompt_for_value "  Enter JWT_SECRET" 1)";;
      QWEN_API_KEY)      val="$(prompt_for_value "  Enter QWEN_API_KEY (vision model)" 0)";;
      DEEPSEEK_API_KEY)  val="$(prompt_for_value "  Enter DEEPSEEK_API_KEY (reasoning model)" 0)";;
      EMBEDDING_API_KEY) val="$(prompt_for_value "  Enter EMBEDDING_API_KEY (embedding model)" 0)";;
    esac
    set_env_var "$key" "$val"
    ok "$key written to server/.env."
  else
    ok "$key already set."
  fi
done

if [[ "$SKIP_BUILD" == "1" ]]; then
  warn "Skipping build (--skip-build)."
else
  log "Building web frontend (web -> web/dist)..."
  npm --prefix "$REPO_ROOT" run build
  ok "Web build complete."
fi

if [[ "$RUN_INGEST" == "1" ]]; then
  log "Rebuilding RAG vector store (rag:ingest)..."
  npm --prefix "$REPO_ROOT" run rag:ingest
  ok "RAG ingest complete."
else
  log "Skipping RAG ingest (pass --ingest to rebuild the vector store)."
fi

mkdir -p "$REPO_ROOT/logs"
export PORT
export PROCESS_NAME

log "(Re)starting PM2 process '$PROCESS_NAME' on port $PORT..."
pm2 delete "$PROCESS_NAME" >/dev/null 2>&1 || true
pm2 start "$REPO_ROOT/ecosystem.config.cjs"
pm2 save >/dev/null
ok "PM2 process started and process list saved."

log "Health check http://localhost:$PORT/api/health ..."
healthy=0
for i in $(seq 1 15); do
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 1
done
if [[ "$healthy" == "1" ]]; then ok "Service is healthy."; else warn "Health check did not pass within 15s. Inspect: pm2 logs $PROCESS_NAME"; fi

echo
pm2 describe "$PROCESS_NAME" 2>/dev/null | sed -n '1,18p' || true
echo
ok "Deploy complete."
echo "  Service URL : http://localhost:$PORT"
echo "  Health      : http://localhost:$PORT/api/health"
echo "  Logs        : pm2 logs $PROCESS_NAME"
echo "  Stop        : pm2 stop $PROCESS_NAME"
echo "  Restart     : pm2 restart $PROCESS_NAME"
echo "  Boot startup: pm2 startup   (run once, follow the printed command, then: pm2 save)"
