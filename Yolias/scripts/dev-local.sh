#!/usr/bin/env bash
# One command to run Yolias locally: starts Yolias's own local Supabase,
# writes .env.local from it, then starts the Next.js dev server.
# Taysonsta BOS data is never touched (separate Supabase project "yolias").
#   YOLIAS_PORT=3201          port of the Next.js server (default 3200)
#   YOLIAS_SITE_URL=...       public URL (default http://localhost:3200)
#   YOLIAS_PREPARE_ONLY=1     set everything up but don't start Next.js
#                             (used by the root `npm run local`, docs/02)
set -uo pipefail
cd "$(dirname "$0")/.."
PORT="${YOLIAS_PORT:-3200}"
SITE_URL="${YOLIAS_SITE_URL:-http://localhost:3200}"

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

# Email: Yolias sends through the Taysonsta Resend account (D-111). The key
# comes from .env.local, else from the Taysonsta project (root .env.local or
# its Integration Hub). With a key, Supabase Auth sends sign-in emails via
# Resend SMTP; without one they're caught by Inbucket (local only).
envval() { [ -f .env.local ] && grep -E "^$1=" .env.local | tail -1 | cut -d= -f2- || true; }
RESEND_API_KEY="$(envval RESEND_API_KEY)"
RESEND_FROM="$(envval RESEND_FROM)"
if [ -z "$RESEND_API_KEY" ] && [ -f ../scripts/taysonsta-resend.mjs ]; then
  eval "$(node ../scripts/taysonsta-resend.mjs 2>/dev/null | sed -E "s/^([A-Z_]+)=(.*)$/\1='\2'/")"
  [ -z "${RESEND_FROM:-}" ] && RESEND_FROM="$(envval RESEND_FROM)"
fi
RESEND_FROM_EMAIL="$(printf '%s' "${RESEND_FROM:-}" | sed -E 's/.*<([^>]+)>.*/\1/')"
if [ -n "${RESEND_API_KEY:-}" ] && [ -n "$RESEND_FROM_EMAIL" ]; then SMTP=true; else SMTP=false; fi

# Variables this script owns; everything else in .env.local is kept.
OWNED='^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SITE_URL|BILLING_TEST_MODE|RESEND_API_KEY|RESEND_FROM|RESEND_FROM_EMAIL|YOLIAS_SMTP_ENABLED)='
write_env() {
  local extra=""
  [ -f .env.local ] && extra="$(grep -vE "$OWNED" .env.local || true)"
  {
    [ -n "${API_URL:-}" ] && echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
    [ -n "${ANON_KEY:-}" ] && echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
    [ -n "${SERVICE_ROLE_KEY:-}" ] && echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
    echo "NEXT_PUBLIC_SITE_URL=$SITE_URL"
    # Local only: plans activate without payment (no payment provider yet).
    echo "BILLING_TEST_MODE=true"
    # Read by supabase/config.toml ([auth.email.smtp]) and lib/email/send.ts.
    echo "YOLIAS_SMTP_ENABLED=$SMTP"
    echo "RESEND_API_KEY=${RESEND_API_KEY:-}"
    echo "RESEND_FROM=${RESEND_FROM:-}"
    echo "RESEND_FROM_EMAIL=$RESEND_FROM_EMAIL"
    if [ -n "$extra" ]; then echo "$extra"; fi
  } > .env.local.tmp
  mv .env.local.tmp .env.local
}
# Keep the Supabase keys we already have while the database starts.
API_URL="$(envval NEXT_PUBLIC_SUPABASE_URL)"; ANON_KEY="$(envval NEXT_PUBLIC_SUPABASE_ANON_KEY)"; SERVICE_ROLE_KEY="$(envval SUPABASE_SERVICE_ROLE_KEY)"
write_env

# Auth reads the SMTP settings at start: restart the stack when they change.
mkdir -p supabase/.temp
if [ "$(cat supabase/.temp/smtp-state 2>/dev/null)" != "$SMTP:$RESEND_FROM_EMAIL" ] && npx supabase status >/dev/null 2>&1; then
  say "Email settings changed. Restarting the Yolias database services…"
  npx supabase stop >/dev/null 2>&1 || true
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
write_env
echo "$SMTP:$RESEND_FROM_EMAIL" > supabase/.temp/smtp-state

if [ "$SMTP" = true ]; then MAIL="sign-in emails: sent by Resend from $RESEND_FROM_EMAIL"; else MAIL="sign-in emails: http://127.0.0.1:54634 (no Resend key found)"; fi
[ -n "${YOLIAS_PREPARE_ONLY:-}" ] && { say "Database ready · $MAIL"; exit 0; }

lsof -ti:"$PORT" 2>/dev/null | xargs kill 2>/dev/null || true

say "Ready → app: $SITE_URL   ·   $MAIL"
exec npx next dev --port "$PORT"
