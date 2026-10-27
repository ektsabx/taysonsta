#!/usr/bin/env bash
# Seeds the first SEO content (drafts only) into the PRODUCTION Yolias
# database, after migration 20261123000000. Rows that already exist are never
# overwritten. Reads the production URL and key from ../.env.yolias-production.local.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
. ../.env.yolias-production.local
set +a
export NEXT_PUBLIC_SUPABASE_URL="$YOLIAS_SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="$YOLIAS_SUPABASE_SERVICE_ROLE_KEY"
echo "Seeding SEO drafts into: $NEXT_PUBLIC_SUPABASE_URL"
npx -y tsx --tsconfig tsconfig.json scripts/seed-seo.mts
