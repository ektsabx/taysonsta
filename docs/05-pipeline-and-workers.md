# 05 — Discovery Pipeline & Workers

A campaign is a **discovery job**. It runs in the background through these
stages, each one a queued, idempotent job.

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
- **Node worker**: long-running process reading pgmq, running jobs with per-provider concurrency. Hosting TBD (D-001).
- The web app only enqueues. It never runs provider calls in a request.

## Failure handling

1. Retry same provider with backoff (transient errors, 429 respecting `Retry-After`).
2. Circuit open or retries exhausted → fallback provider if it has the capability **and** the license fits.
3. No fallback → stage ends with what it has. Campaign becomes `partial` with a reason, or `failed` if nothing usable.
4. Reserved usage not consumed is released.

## Search cache & coverage

- Same fingerprint within TTL → reuse results (still dedup against the workspace's existing prospects).
- Log per search: country, industry, results per provider. This feeds `intel.provider_coverage` and routing.
