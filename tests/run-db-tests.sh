#!/usr/bin/env bash
# Runs every SQL test in tests/db against the LOCAL Supabase database.
# Each test file wraps itself in begin/rollback, so no data is kept.
set -euo pipefail

cd "$(dirname "$0")/.."
DB_URL="${BOS_TEST_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54422/postgres}"

case "$DB_URL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing to run DB tests against a non-local database: $DB_URL" >&2; exit 1 ;;
esac

status=0
for f in tests/db/*.sql; do
  echo "▶ $f"
  if out=$(psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$f" 2>&1); then
    echo "$out" | grep -E "NOTICE" || true
    echo "✓ $f"
  else
    echo "$out"
    echo "✗ $f failed"
    status=1
  fi
done
exit $status
