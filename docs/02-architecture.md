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

Today they are **separate projects** (local ports 5463x and 5442x). How
Yolias Admin reads and manages Yolias data is an open decision; see D-010 in
`12-decisions.md`. Recommended: the admin server reaches the Yolias database
through a server-only client with dedicated credentials, behind BOS RBAC
(`platform.*` permissions) and audit logging. No merging of the two schemas.

## Hosting

Not hardcoded. Next apps run anywhere Next runs (the root app has
OpenNext/Cloudflare config). The worker is a long-running Node process
(Fly / Railway / Render are candidates). Decision pending: D-001.

## Local development

| Service | Port |
| --- | --- |
| Yolias app | 3200 (`cd Yolias && npm run local`) |
| Yolias Supabase | 5463x, Inbucket 54634 |
| BOS / Admin app | 3000 today (`npm run dev` at root) |
| BOS Supabase | 5442x |

Target: `admin.localhost:3200` serves the admin. Browsers resolve
`*.localhost` to 127.0.0.1, so no hosts file is needed; what's needed is
routing by `Host` on port 3200. See D-011.
