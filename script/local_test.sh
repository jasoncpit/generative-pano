#!/bin/bash
set -euo pipefail

# If the script is being sourced (e.g. `. script/local_test.sh`), abort with guidance.
# This prevents zsh/bosh sourcing issues (e.g. BASH_SOURCE unset) and trap contamination.
if (return 0 2>/dev/null); then
  echo "This script should be executed, not sourced. Run:"
  echo "  ./script/local_test.sh    (make it executable first with: chmod +x script/local_test.sh)"
  echo "or:"
  echo "  bash script/local_test.sh"
  return 1 2>/dev/null || exit 1
fi

# Simple local runner for both API (FastAPI) and Web (Next.js)
# - Starts both services concurrently
# - Cleans up on Ctrl-C
# - Writes logs to per-app files

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

# Robust script path detection across bash/zsh
if [[ -n "${BASH_SOURCE:-}" ]]; then
  SCRIPT_PATH="${BASH_SOURCE[0]}"
elif [[ -n "${ZSH_VERSION:-}" ]]; then
  # zsh: %N expands to script path
  SCRIPT_PATH="${(%):-%N}"
else
  SCRIPT_PATH="$0"
fi
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

API_DIR="$REPO_ROOT/apps/api"
WEB_DIR="$REPO_ROOT/apps/web"

API_LOG="$API_DIR/.local_api.log"
WEB_LOG="$WEB_DIR/.local_web.log"

API_PID=""
WEB_PID=""

start_api() {
  cd "$API_DIR"
  echo "Starting API on http://localhost:${API_PORT} ..."
  if [[ -z "${REPLICATE_API_TOKEN:-}" ]]; then
    echo "WARNING: REPLICATE_API_TOKEN is not set; generate endpoint will fail until provided."
  fi
  if command -v uv >/dev/null 2>&1; then
    uv run uvicorn api.main:app --host 0.0.0.0 --port "${API_PORT}" --reload >"$API_LOG" 2>&1 &
  else
    python -m uvicorn api.main:app --host 0.0.0.0 --port "${API_PORT}" --reload >"$API_LOG" 2>&1 &
  fi
  API_PID=$!
}

start_web() {
  cd "$WEB_DIR"
  echo "Starting Web on http://localhost:${WEB_PORT} ..."
  npm run dev -- -p "${WEB_PORT}" >"$WEB_LOG" 2>&1 &
  WEB_PID=$!
}

cleanup() {
  echo
  echo "Stopping services..."
  if [[ -n "${WEB_PID}" ]]; then kill "${WEB_PID}" 2>/dev/null || true; fi
  if [[ -n "${API_PID}" ]]; then kill "${API_PID}" 2>/dev/null || true; fi
  wait "${WEB_PID:-}" "${API_PID:-}" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

start_api
start_web

echo
echo "Both services are launching:"
echo "  Web: http://localhost:${WEB_PORT}"
echo "  API: http://localhost:${API_PORT}"
echo
echo "Logs:"
echo "  API -> $API_LOG"
echo "  Web -> $WEB_LOG"
echo
echo "Press Ctrl-C to stop both."

wait