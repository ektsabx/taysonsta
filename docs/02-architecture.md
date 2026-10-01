# 02 — Architecture

## Components

```text
┌────────────────────┐    ┌──────────────────────────────┐
│ Yolias (Next.js)   │    │ Yolias Admin (Next.js, BOS)  │
│ Yolias/            │    │ repo root: app/admin, lib/bos│
│ customer UI, AI,   │    │ company modules + platform   │
│ server actions     │    │ modules                      │
└─────────┬──────────┘    └──────────────┬───────────────┘
          │ server only                  │ server only
          ▼                              ▼
┌──────────────────────────────────────────────────────────┐
│ Intelligence Layer (TypeScript, server-only)             │
│ registry · capabilities · router · cache · provenance ·  │
│ dedup · TTL · cost engine · budget guard · rate limits   │
└─────────┬───────────────────────────────┬────────────────┘
          │ enqueue                        │ adapters
          ▼                                ▼
┌──────────────────┐            ┌──────────────────────────┐
│ Queue: pgmq +    │──worker──▶│ Providers: PDL, Coresignal│
│ pg_cron (Postgres)│           │ Brave, Exa, Google Places,│
└──────────────────┘            │ Firecrawl, verifiers, ... │
                                └──────────────────────────┘
          ▲
┌─────────┴────────────────────────────────────────────────┐
│ Yolias Supabase (Postgres)                               │
│ public.* (workspace data, RLS)  intel.* (shared, no      │
│ customer access)  usage_ledger, campaign_runs, Vault     │
└──────────────────────────────────────────────────────────┘
```

## Code layout (target)

```text
Yolias/
  lib/intel/                 Intelligence Layer (server-only)
    registry.ts              provider registry (reads intel.providers config)
    capabilities.ts          capability names and input/output contracts
    router.ts                picks providers per capability (ladder, cost, health, license)
    cache.ts                 search fingerprint + response cache
    provenance.ts            field-level source/time/confidence
    dedup.ts                 natural keys, identity resolution
    cost.ts                  cost engine (provider_calls, llm_calls)
    usage.ts                 reserve / consume / release Prospects
    providers/<name>.ts      one adapter per provider
  lib/discovery/             pipeline stages (uses lib/intel only)
  lib/agent/                 agent tools (typed, authorized, audited)
  worker/                    Node worker: reads pgmq, runs jobs
  supabase/migrations/       public + intel schema
```

`lib/discovery/types.ts` already defines the first provider contracts
(`CompanySource`, `PeopleSource`, `Enricher`, `EmailVerifier`). They evolve
into capability adapters in phase 1; don't fork a second set.

## Request flow (create a search)

1. Server action validates input (zod), saves the strategy.
2. ICP: fingerprint lookup in `llm_cache`, otherwise the LLM parses it (structured output).
3. Creates the campaign, reserves usage, enqueues `discover_companies`.
4. Returns at once. The UI reads progress from `campaigns` / `campaign_events` / `campaign_runs`.
5. The worker runs the stages (`05-pipeline-and-workers.md`).

The server action never calls paid providers inline.

## Databases

| Database | Owner | Holds |
| --- | --- | --- |
| Yolias Supabase | `Yolias/supabase` | workspaces, users, strategies, campaigns, prospects, billing, `intel.*`, usage, cost |
| BOS Supabase | `supabase/` (root) | Taysonsta company operations: CRM, projects, finance, HR, support, ... |

They are **separate projects** (local ports 5463x and 5442x; in production
both live in the Taysonsta Supabase account). The Admin reaches the Yolias
database through a server-only client (`lib/yolias/db.ts`) behind the
`platform.*` permissions (D-010). No merging of the two schemas
(`13-audit.md` §4).

## Hosting

**Cloudflare** (D-001): both Next apps through OpenNext on Cloudflare
Workers (the Admin already has `wrangler.jsonc`), the background worker as
Cloudflare Workers (Cron Triggers / Queues). Deployment happens once the
product is finished; until then everything runs locally.

## Local development

One command at the repo root:

```bash
npm run local
```

| URL / service | What |
| --- | --- |
| http://localhost:3200 | Yolias (proxied to its Next server on :3201) |
| http://admin.localhost:3200 | Yolias Admin (proxied to :3202) |
| Yolias Supabase | 5463x, Inbucket (when no Resend key) 54634 |
| Admin Supabase | 5442x (only when the root `.env.local` points to a local database) |

`scripts/dev-all.sh` starts the databases, writes `Yolias/.env.local`
(including the Taysonsta Resend key) and the Admin's `YOLIAS_*` variables,
then runs both apps and `scripts/dev-proxy.mjs`. Browsers resolve
`*.localhost` to 127.0.0.1, so no hosts-file change is needed. Each host
keeps its own login cookies.

Routing safeguards:
- `npm run local` works from the root and from `Yolias/` (same command).
- Before starting, it stops anything already on :3200/:3201/:3202 (an old `next dev` on :3200 would answer every host, which is how `admin.localhost` used to show Yolias).
- After starting, it checks the routing through `/__yolias-proxy` and stops with a clear error if a host goes to the wrong app.
- Responses carry `x-yolias-app: yolias|admin`.
- If an `admin.*` request ever reaches Yolias directly, Yolias shows "Yolias Admin isn't running" instead of the customer app.
- `cd Yolias && npm run local:yolias-only` runs Yolias alone on :3200 (no Admin).
- A browser that can't resolve `admin.localhost` needs `127.0.0.1 admin.localhost` in `/etc/hosts`.
