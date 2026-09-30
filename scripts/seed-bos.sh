#!/usr/bin/env bash
# Loads BOS demo data into the LOCAL Supabase database (§92). Never run
# against production: the script refuses any non-local connection string.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="${BOS_SEED_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54422/postgres}"
case "$DB_URL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing to seed a non-local database: $DB_URL" >&2; exit 1 ;;
esac

psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f supabase/seed-bos.sql
psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f supabase/seed-bos-hr.sql
echo "BOS demo data loaded. Log in at /admin/login with e.g. admin@taysonsta.local / Taysonsta!2026"
