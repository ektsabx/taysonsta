# 05 — Discovery Pipeline & Workers

A campaign is a **discovery job**. It runs in the background through these
stages, each one a queued, idempotent job.

## In the code

| Piece | Where |
| --- | --- |
| States + helpers (`isActive`, `finalState`) | `Yolias/lib/discovery/states.ts` |
| Job queue (pgmq `yolias_jobs`) + SQL wrappers, dead letters (`job_failures`), run log (`campaign_runs`) | `Yolias/supabase/migrations/20261004000000_campaign_states_jobs.sql` |
| Enqueue | `Yolias/lib/jobs/queue.ts` (`campaign.discover`) |
| Worker: time-boxed `tick()`, backoff 30s→30min, 5 attempts then dead letter + campaign failed | `Yolias/lib/jobs/worker.ts` |
| Worker endpoint (Bearer `WORKER_SECRET`) | `Yolias/app/api/worker/route.ts` |
| Local poller (what the Cron Trigger does in production) | `scripts/dev-worker.mjs`, started by `npm run local` |
| Admin: queue metrics, runs, failed jobs + retry | `/admin/platform/jobs` |

`runDiscovery` is idempotent: finished campaigns are skipped, one worker
claims a campaign with a conditional update, a retry may take over a
campaign left mid-run. A person the workspace already has (same LinkedIn
or email) is never delivered or charged again. Today one job runs the whole
pipeline and moves the campaign through the states; splitting it into one
job per stage comes with the first provider, when real latencies are known.

## Stages

```text
query → ICP (parse or cache) → fingerprint → campaign
  → company discovery → normalise → dedup → qualify companies
  → people discovery / matching → contacts (reuse → find) → verify
  → [optional] mobile → [only if justified] research
  → scoring (code) → prospects (consume usage) → deliver results
```

## Campaign states

`created` → `queued` → `discovering_companies` → `matching_companies` →
`discovering_people` → `enriching` → `verifying` → `researching` → `scoring`
→ `delivering` → `completed` | `partial` | `failed`

Today's states (`awaiting_source`, `queued`, `running`, `completed`, `failed`,
`paused`) migrate to these. `awaiting_source` remains meaningful while no
provider is enabled: the UI says "no data source connected", never fakes results.

`partial` = delivered fewer than asked, with `partial_reason` shown to the user.

## Jobs

| Job | Does | Then enqueues |
| --- | --- | --- |
| `discover_companies` | shared intel + `company.search`; normalise, dedup, qualify | `find_people` per qualified company (batched) |
| `find_people` | `person.search` / match titles & seniority | `find_contacts` |
| `find_contacts` | email reuse → `email.find`; phone only if requested | `verify` |
| `verify` | `email.verify` | `research` or `deliver` |
| `research` | `web.search` / `web.extract` + LLM summary, only when it adds value | `deliver` |
| `deliver` | code scoring, create prospects, consume usage, notify | finishes campaign |

Every job: **idempotent** (keyed by campaign + stage + entity), **retryable**
(exponential backoff, max attempts), **observable** (`campaign_runs` row,
`campaign_events` for the UI), dead-letter queue after max attempts,
provider rate limits, fallback, circuit breaker, and a **budget guard**
(stop when campaign / workspace / provider budget is reached).

## Queue & worker

- **pgmq** (Postgres queues) + **pg_cron** (sweeps: stuck jobs, TTL refresh, ledger expiry).
- **Worker on Cloudflare** (D-001, D-109): Workers triggered by Cron Triggers and/or Cloudflare Queues read jobs and run them with per-provider concurrency. Each job must fit the Workers time limits, which is another reason to keep jobs small and resumable.
- The web app only enqueues. It never runs provider calls in a request.

## Failure handling

1. Retry same provider with backoff (transient errors, 429 respecting `Retry-After`).
2. Circuit open or retries exhausted → fallback provider if it has the capability **and** the license fits.
3. No fallback → stage ends with what it has. Campaign becomes `partial` with a reason, or `failed` if nothing usable.
4. Reserved usage not consumed is released.

## Search cache & coverage

- Same fingerprint within TTL → reuse results (still dedup against the workspace's existing prospects).
- Log per search: country, industry, results per provider. This feeds `intel.provider_coverage` and routing.
