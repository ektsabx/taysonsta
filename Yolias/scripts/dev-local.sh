#!/usr/bin/env bash
# One command to run Yolias locally: starts Yolias's own local Supabase,
# writes .env.local from it, then starts the Next.js dev server on :3200.
# Taysonsta BOS data is never touched (separate Supabase project "yolias").
set -uo pipefail
cd "$(dirname "$0")/.."

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

start_supabase() {
  npx supabase start -x "$EXCLUDE"
}

if ! npx supabase status >/dev/null 2>&1; then
  say "Starting Yolias database (first time can take a few minutes)…"
  if ! start_supabase; then
    if [ "$(docker context show 2>/dev/null)" = "colima" ]; then
      # Colima's default port forwarder can expose the database port too late
      # for the Supabase CLI. The ssh forwarder is reliable; restart once with it.
      say "Colima port forwarding was too slow. Restarting Colima with the ssh forwarder (other projects' data is kept)…"
      npx supabase stop --no-backup >/dev/null 2>&1 || true
      colima stop && colima start --port-forwarder ssh --memory 6 || exit 1
      start_supabase || { say "Database still failed to start. Send the output above to Claude."; exit 1; }
    else
      say "Database failed to start. Send the output above to Claude."
      exit 1
    fi
  fi
fi

# Apply any database migrations added since the database was created.
npx supabase migration up --local >/dev/null 2>&1 || npx supabase migration up --local

eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
if [ -z "${API_URL:-}" ]; then say "Couldn't read Supabase keys."; exit 1; fi

# Keep any extra variables (e.g. ANTHROPIC_API_KEY) already in .env.local.
EXTRA=""
[ -f .env.local ] && EXTRA="$(grep -vE '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SITE_URL|BILLING_TEST_MODE)=' .env.local || true)"
{
  echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
  echo "NEXT_PUBLIC_SITE_URL=http://localhost:3200"
  # Local only: plans activate without payment (no payment provider yet).
  echo "BILLING_TEST_MODE=true"
  [ -n "$EXTRA" ] && echo "$EXTRA"
} > .env.local

lsof -ti:3200 2>/dev/null | xargs kill 2>/dev/null || true

say "Ready → app: http://localhost:3200   ·   sign-in emails: http://127.0.0.1:54634"
exec npx next dev --port 3200
