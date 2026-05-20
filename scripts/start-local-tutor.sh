#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env.local" ]]; then
  echo "[error] Missing .env.local in repo root."
  echo "Create it from .env.local.example before starting local tutor."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[error] npm is not installed or not in PATH."
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "[error] Firebase CLI is not installed or not in PATH."
  echo "Install with: npm i -g firebase-tools"
  exit 1
fi

REQUIRED_PORTS=(3000 4000 8080 9099 9199)
BUSY=0

for port in "${REQUIRED_PORTS[@]}"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    BUSY=1
  fi
done

if [[ "$BUSY" -eq 1 ]]; then
  echo "Some local tutor ports are already in use."
  echo "Close old tutor/emulator Terminal windows first, then run Start Tutor.command again."
  echo
  echo "Busy port details:"
  for port in "${REQUIRED_PORTS[@]}"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "- Port $port"
      lsof -nP -iTCP:"$port" -sTCP:LISTEN || true
      echo
    fi
  done
  exit 1
fi

if ! command -v osascript >/dev/null 2>&1; then
  echo "[error] osascript is unavailable. This launcher requires macOS."
  exit 1
fi

FIREBASE_CMD="cd '$ROOT_DIR'; clear; printf '\\n=== Firebase Emulators ===\\n\\n'; firebase emulators:start --only auth,firestore,storage --project demo-private-tutor"
NEXT_CMD="cd '$ROOT_DIR'; clear; printf '\\n=== Next.js Tutor App ===\\n\\n'; npm run dev"

osascript <<EOF_APPLESCRIPT
tell application "Terminal"
  activate
  do script "$FIREBASE_CMD"
  do script "$NEXT_CMD"
end tell
EOF_APPLESCRIPT

echo "[info] Waiting for app on http://localhost:3000 ..."
READY=0
for _ in {1..90}; do
  if curl -fsS "http://localhost:3000" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" -eq 1 ]]; then
  echo "App: http://localhost:3000"
  echo "Firebase Emulator UI: http://127.0.0.1:4000/"
  open "http://localhost:3000" >/dev/null 2>&1 || true
else
  echo "App did not become ready. Check the Next.js terminal window."
  echo "App: http://localhost:3000"
  echo "Firebase Emulator UI: http://127.0.0.1:4000/"
  exit 1
fi
