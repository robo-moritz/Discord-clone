#!/usr/bin/env bash
# BlurChat Launcher (Linux/macOS) — Start & Update direkt aus dem Repo
# usage: ./launch.sh [dev|update|stop]
set -e
cd "$(dirname "$0")"

STOP() { pkill -f "node server/index.js" && echo "BlurChat gestoppt." || echo "Läuft nicht."; }
NEED_INSTALL() { [ ! -d "$2" ] || [ "$1" -nt "$2" ]; }

case "${1:-run}" in
  stop) STOP; exit 0;;
  dev)  exec npm run dev;;
esac

echo "[1/4] git pull..."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git pull --ff-only || echo "  (kein Git-Repo – übersprungen)"

echo "[2/4] Abhängigkeiten..."
command -v node >/dev/null || { echo "Node.js fehlt! -> https://nodejs.org"; exit 1; }
NEED_INSTALL package.json node_modules && npm install --no-audit --no-fund
NEED_INSTALL client/package.json client/node_modules && (cd client && npm install --no-audit --no-fund)

[ "$1" = "update" ] && [ -f .built-hash ] && [ "$(git rev-parse HEAD)" = "$(cat .built-hash)" ] && { echo "Aktuellste Version bereits gebaut."; exec node server/index.js; }

echo "[3/4] Client bauen..."
(cd client && npm run build)

echo "[4/4] Starte BlurChat..."
git rev-parse HEAD > .built-hash 2>/dev/null || true
exec node server/index.js
