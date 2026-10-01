#!/usr/bin/env bash
# One command for the whole platform locally (docs/02-architecture.md):
#   http://localhost:3200        Yolias (customer app)
#   http://admin.localhost:3200  Yolias Admin (former Taysonsta BOS)
# Starts both databases (when local), both Next.js dev servers on internal
# ports and the host-based proxy on :3200 (scripts/dev-proxy.mjs).
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

PROXY_PORT=3200
YOLIAS_PORT=3201
ADMIN_PORT=3202
EXCLUDE="logflare,vector,imgproxy,edge-runtime,supavisor,studio,realtime,postgres-meta"
say() { printf "\n\033[1;31m▸ Yolias:\033[0m %s\n" "$1"; }

if ! docker info >/dev/null 2>&1; then
  if command -v colima >/dev/null 2>&1; then
    say "Starting Colima…"
    colima start --port-forwarder ssh --memory 6 || exit 1
  else
    say "Docker is not running. Start Docker (or Colima) and run this again."
    exit 1
  fi
fi

[ -f .env.local ] || { say "Missing .env.local at the repo root (Taysonsta/Admin settings). Copy .env.example and fill it."; exit 1; }
envval() { grep -E "^$1=" "$2" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

# 1) Admin database: start the local one only if .env.local points to it.
ADMIN_DB_URL="$(envval NEXT_PUBLIC_SUPABASE_URL .env.local)"
if [[ "$ADMIN_DB_URL" == *127.0.0.1* || "$ADMIN_DB_URL" == *localhost* ]]; then
  if ! npx supabase status >/dev/null 2>&1; then
    say "Starting the Admin database…"
    npx supabase start -x "$EXCLUDE" || { say "Admin database failed to start."; exit 1; }
  fi
  npx supabase migration up --local >/dev/null 2>&1 || npx supabase migration up --local
else
  say "Admin uses the hosted database in .env.local ($ADMIN_DB_URL)."
fi

# 2) Yolias database + Yolias/.env.local (also picks up the Taysonsta Resend key).
YOLIAS_PREPARE_ONLY=1 YOLIAS_SITE_URL="http://localhost:$PROXY_PORT" bash Yolias/scripts/dev-local.sh || exit 1

# 3) Let the Admin reach Yolias data (server-only; docs/12-decisions.md D-010).
Y_URL="$(envval NEXT_PUBLIC_SUPABASE_URL Yolias/.env.local)"
Y_KEY="$(envval SUPABASE_SERVICE_ROLE_KEY Yolias/.env.local)"
grep -vE '^(YOLIAS_SUPABASE_URL|YOLIAS_SUPABASE_SERVICE_ROLE_KEY|YOLIAS_SITE_URL)=' .env.local > .env.local.tmp
{
  cat .env.local.tmp
  echo "YOLIAS_SUPABASE_URL=$Y_URL"
  echo "YOLIAS_SUPABASE_SERVICE_ROLE_KEY=$Y_KEY"
  echo "YOLIAS_SITE_URL=http://localhost:$PROXY_PORT"
} > .env.local && rm .env.local.tmp

# 4) Servers.
for p in $PROXY_PORT $YOLIAS_PORT $ADMIN_PORT; do lsof -ti:"$p" 2>/dev/null | xargs kill 2>/dev/null || true; done
pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null; wait 2>/dev/null; }
trap cleanup EXIT INT TERM

prefix() { sed -u "s/^/[$1] /"; }
(cd "$ROOT/Yolias" && exec npx next dev --port $YOLIAS_PORT 2>&1 | prefix yolias) & pids+=($!)
(cd "$ROOT" && exec npx next dev --port $ADMIN_PORT 2>&1 | prefix admin) & pids+=($!)
(PROXY_PORT=$PROXY_PORT YOLIAS_PORT=$YOLIAS_PORT ADMIN_PORT=$ADMIN_PORT exec node "$ROOT/scripts/dev-proxy.mjs" 2>&1 | prefix proxy) & pids+=($!)

say "Ready →  Yolias: http://localhost:$PROXY_PORT   ·   Yolias Admin: http://admin.localhost:$PROXY_PORT"
wait
