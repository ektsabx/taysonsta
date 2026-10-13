#!/usr/bin/env bash
# Copies the website content shipped in code (Help, Docs, Blog, legal) into the
# PRODUCTION Yolias database. Rows edited in Yolias Admin are never overwritten.
# Reads the production URL and key from ../.env.yolias-production.local.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
. ../.env.yolias-production.local
set +a
export NEXT_PUBLIC_SUPABASE_URL="$YOLIAS_SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="$YOLIAS_SUPABASE_SERVICE_ROLE_KEY"
echo "Seeding content into: $NEXT_PUBLIC_SUPABASE_URL"
npx -y tsx --tsconfig tsconfig.json scripts/seed-content.mts
