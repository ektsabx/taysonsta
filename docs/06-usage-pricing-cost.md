# 06 — Usage, Pricing & Cost

## What customers pay for

**Prospects only.** UI: "Prospects 0 / X". Never credits, never provider
names, never internal costs. All plans have the same features and unlimited users.

Current plans (`Yolias/lib/plans.ts`):

| Plan | Price / month | Prospects / month |
| --- | --- | --- |
| Free | $0 | 50 |
| Pro | $20 | 1,000 |
| Growth | $50 | 3,000 |

**Pricing decision (D-005):** if unit economics demand it, reduce Prospects
per plan instead of raising prices. Quotas must therefore be configuration
(DB/admin), not constants. Annual = 12 × monthly today.

## Usage ledger

`usage_ledger` rows: `workspace_id`, `campaign_id`, `kind` (`reserve` /
`consume` / `release` / `grant` / `adjust`), `prospects`, `period_start`,
`reason`, `created_by`, `created_at`.

- **Reserve atomically** at campaign start (single SQL function with row lock: available = quota − consumed − active reservations).
- **Consume** when a prospect is delivered (one per new `(workspace_id, person_id)`).
- **Release** the remainder when the campaign ends.
- Re-delivering a person the workspace already has costs nothing.
- Quota is checked in the database, never in the browser.

## Cost engine

Every external call writes `intel.provider_calls`:

`workspace_id`, `campaign_id`, `provider`, `operation`, `request_hash`,
`input_cost`, `output_cost` (or unit cost × units), `success`,
`records_returned`, `latency_ms`, `cache_hit`, `created_at`.

LLM calls the same way: model, input/output/cached tokens, cost.

Derived metrics (SQL only): cost per campaign, per prospect, per workspace,
per provider, per capability; cache hit rate; gross margin per plan.

## Estimates

Before running, the campaign gets an **estimated cost** from coverage stats
and unit prices (companies needed ÷ qualify rate, people per company, email
find + verify rate). Shown in the admin, used by the budget guard. Not shown
to customers as money.

## Economics levers (in order)

1. Reuse shared intel and caches.
2. Qualify companies before buying people.
3. Cheapest provider that meets quality for that country/industry.
4. Verify only emails we'll deliver.
5. Mobile and research only when justified.
6. Batch and cache LLM calls; smallest adequate model.
