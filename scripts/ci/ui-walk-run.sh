#!/usr/bin/env bash
# Runs the settings walk against a fresh SillyTavern with this checkout as its Story_suite extension. No secrets, no model calls.
# Usage: ui-walk-run.sh <SillyTavern folder (npm ci done)> <port> <output folder> [walk options, e.g. --sizes 390x844 --themes dark]
# The data root is new (SillyTavern fills it on first start); the walk refuses model calls itself.
set -euo pipefail
ST="$(cd "$1" && pwd)"; PORT="$2"; OUT="$3"; shift 3
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
mkdir -p "$OUT" "$WORK/root/default-user/extensions"
# A new data root opens SillyTavern's welcome popup, which blocks the page until a persona name is saved; firstRun false skips it.
# SillyTavern copies its default character card (Seraphina) in at its first start; the walk opens that character's chat.
echo '{"firstRun": false}' > "$WORK/root/default-user/settings.json"
ln -s "$REPO" "$WORK/root/default-user/extensions/Story_suite"
PID=""
stop() { [ -n "$PID" ] && kill "$PID" 2>/dev/null || true; rm -rf "$WORK"; }
trap stop EXIT
(cd "$ST" && exec node server.js --port "$PORT" --dataRoot "$WORK/root" --listen=false > "$OUT/server.log" 2>&1) &
PID=$!
for _ in $(seq 1 120); do
  curl -fs "http://127.0.0.1:$PORT/" > /dev/null 2>&1 && break
  kill -0 "$PID" 2>/dev/null || { echo "SillyTavern stopped at start (see server.log)"; tail -20 "$OUT/server.log"; exit 1; }
  sleep 1
done
curl -fs "http://127.0.0.1:$PORT/" > /dev/null || { echo "SillyTavern is not answering on $PORT"; exit 1; }
echo "SillyTavern pid $PID on $PORT"
status=0
node "$REPO/scripts/ui-walk/settings-walk.mjs" --url "http://127.0.0.1:$PORT" --out "$OUT" "$@" || status=$?
exit "$status"
