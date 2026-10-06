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

envval() { grep -E "^$1=" "$2" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

# Fresh clone: no root .env.local yet. Create one for a local Admin database
# (with demo data) so everything runs. To use the real Taysonsta keys instead,
# copy your existing .env.local into the repo root before running this.
if [ ! -f .env.local ]; then
  say "No .env.local at the repo root — setting up a local Admin database with demo data…"
  npx supabase start -x "$EXCLUDE" || { say "Admin database failed to start."; exit 1; }
  eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
  [ -n "${API_URL:-}" ] || { say "Couldn't read the Admin database keys."; exit 1; }
  {
    echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
    echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
    echo "BOS_SECRETS_KEY=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  } > .env.local
  npx supabase migration up --local >/dev/null 2>&1 || true
  DB="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_taysonsta' | head -1)"
  SEEDED="$( [ -n "$DB" ] && docker exec -i "$DB" psql -U postgres -d postgres -tAX -c "select count(*) from auth.users where email = 'admin@taysonsta.local'" 2>/dev/null || echo 0)"
  if [ -n "$DB" ] && [ "${SEEDED:-0}" = 0 ]; then
    for f in supabase/seed-bos.sql supabase/seed-bos-hr.sql; do
      docker exec -i "$DB" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 < "$f" >/dev/null || say "Demo data in $f didn't load fully (the app still runs)."
    done
  fi
  say "Admin login: admin@taysonsta.local / Taysonsta!2026"
fi

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
# After `npm run deploy:production` the local Admin manages the published
# Yolias (D-148): .env.yolias-production.local (git-ignored) holds its URL,
# service key and site. Delete that file to go back to the local Yolias.
Y_URL="$(envval NEXT_PUBLIC_SUPABASE_URL Yolias/.env.local)"
Y_KEY="$(envval SUPABASE_SERVICE_ROLE_KEY Yolias/.env.local)"
Y_SITE="http://localhost:$PROXY_PORT"
if [ -f .env.yolias-production.local ]; then
  Y_URL="$(envval YOLIAS_SUPABASE_URL .env.yolias-production.local)"
  Y_KEY="$(envval YOLIAS_SUPABASE_SERVICE_ROLE_KEY .env.yolias-production.local)"
  Y_SITE="$(envval YOLIAS_SITE_URL .env.yolias-production.local)"
  say "Admin manages the published Yolias ($Y_SITE)."
fi
grep -vE '^(YOLIAS_SUPABASE_URL|YOLIAS_SUPABASE_SERVICE_ROLE_KEY|YOLIAS_SITE_URL|ADMIN_URL)=' .env.local > .env.local.tmp
{
  cat .env.local.tmp
  echo "YOLIAS_SUPABASE_URL=$Y_URL"
  echo "YOLIAS_SUPABASE_SERVICE_ROLE_KEY=$Y_KEY"
  echo "YOLIAS_SITE_URL=$Y_SITE"
  # Where Yolias's server reaches the Admin (support widget proxy).
  echo "ADMIN_URL=http://127.0.0.1:$ADMIN_PORT"
} > .env.local && rm .env.local.tmp

# 4) Servers. Free the ports first: an old `next dev` on :3200 (e.g. Yolias
# started alone) would answer every host, so admin.localhost would show Yolias.
port_pids() {
  {
    command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$1" -sTCP:LISTEN 2>/dev/null
    command -v fuser >/dev/null 2>&1 && fuser "$1"/tcp 2>/dev/null
  } | tr -s ' \t' '\n' | grep -E '^[0-9]+$' | sort -u
}
port_busy() { (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null; }
for p in $PROXY_PORT $YOLIAS_PORT $ADMIN_PORT; do
  pids_on="$(port_pids "$p" | tr '\n' ' ')"
  [ -n "${pids_on// /}" ] && { say "Stopping what was running on port $p…"; kill $pids_on 2>/dev/null; }
  for _ in $(seq 1 20); do port_busy "$p" || break; sleep 0.5; done
  if port_busy "$p"; then
    [ -n "${pids_on// /}" ] && kill -9 $pids_on 2>/dev/null; sleep 1
    port_busy "$p" && { say "Port $p is still in use by another program. Stop it and run npm run local again."; exit 1; }
  fi
done
pids=()
# Ctrl+C stops everything this run started, including the next dev
# processes behind the pipes. Only our own processes: a newer `npm run local`
# that took over the ports must not be killed when this one exits.
OWNED=""
cleanup() {
  kill "${pids[@]}" 2>/dev/null
  [ -n "$OWNED" ] && kill $OWNED 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

prefix() { sed -u "s/^/[$1] /"; }
(cd "$ROOT/Yolias" && exec npx next dev --port $YOLIAS_PORT 2>&1 | prefix yolias) & pids+=($!)
(cd "$ROOT" && exec npx next dev --port $ADMIN_PORT 2>&1 | prefix admin) & pids+=($!)
(PROXY_PORT=$PROXY_PORT YOLIAS_PORT=$YOLIAS_PORT ADMIN_PORT=$ADMIN_PORT exec node "$ROOT/scripts/dev-proxy.mjs" 2>&1 | prefix proxy) & pids+=($!)
# Background jobs (discovery): what the Cloudflare Cron Trigger does in production.
(WORKER_URL="http://127.0.0.1:$YOLIAS_PORT/api/worker" exec node "$ROOT/scripts/dev-worker.mjs" 2>&1 | prefix worker) & pids+=($!)

# 5) Self-test the routing through the front door before saying "ready".
check() { curl -s --noproxy '*' -m 5 -H "Host: $1:$PROXY_PORT" "http://127.0.0.1:$PROXY_PORT/__yolias-proxy" | grep -o '"app":"[a-z]*"' | cut -d'"' -f4; }
for _ in $(seq 1 40); do port_busy $PROXY_PORT && break; sleep 0.5; done
OWNED="$(port_pids $PROXY_PORT | tr '\n' ' ')"
for _ in $(seq 1 20); do
  Y_APP="$(check localhost)"; A_APP="$(check admin.localhost)"
  [ "$Y_APP" = yolias ] && [ "$A_APP" = admin ] && break; sleep 0.5
done
if [ "$Y_APP" != yolias ] || [ "$A_APP" != admin ]; then
  say "Routing check failed (localhost → ${Y_APP:-nothing}, admin.localhost → ${A_APP:-nothing}). See the [proxy] lines above."
  exit 1
fi
for _ in $(seq 1 120); do
  code="$(curl -s --noproxy '*' -o /dev/null -m 10 -w '%{http_code}' -H "Host: admin.localhost:$PROXY_PORT" "http://127.0.0.1:$PROXY_PORT/admin/login")"
  [ "$code" = 200 ] && break; sleep 1
done
OWNED="$(for p in $PROXY_PORT $YOLIAS_PORT $ADMIN_PORT; do port_pids "$p"; done | tr '\n' ' ')"
say "Routing OK ✓  localhost → Yolias · admin.localhost → Yolias Admin"
say "Ready →  Yolias: http://localhost:$PROXY_PORT   ·   Yolias Admin: http://admin.localhost:$PROXY_PORT"
say "If a browser can't open admin.localhost, add this line to /etc/hosts: 127.0.0.1 admin.localhost"
wait
