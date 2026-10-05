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

## Emails

Every product email is a logged, idempotent job (rule 18):
`notify()` (`Yolias/lib/email/notify.ts`) writes one `public.email_log` row
per recipient — deduplicated by a key such as `usage_low:<ws>:<month>:<email>`
— and queues `email.send`; the worker renders and sends it through Resend and
records `sent | skipped | failed`. Without a Resend key emails are `skipped`,
never faked. Auth emails (sign-in link, confirmation, invite, email change and
the email-changed / 2FA notices) are sent by Supabase Auth over Resend SMTP.

Senders (`EMAIL_DOMAIN`, else the `RESEND_FROM` address with the same names):

| Category | From | Turned off by |
| --- | --- | --- |
| Account | `Yolias <no-reply@…>` | always sent |
| Subscription | `Yolias <billing@…>` | "Billing" setting |
| Payments & billing | `Yolias Billing <billing@…>` | "Billing" (failed/overdue/payment method: always) |
| Usage | `Yolias <usage@…>` | "Usage" / "Discovery completed" |
| Product updates | `Yolias <updates@…>` | "Product updates" (off by default) |
| Security | `Yolias Security <security@…>` | always sent |

| Email | Trigger |
| --- | --- |
| Secure sign-in link, Verify email, Invite | Supabase Auth |
| Email change confirmation + "email changed" notice | Settings → Account → Change (Supabase, both addresses) |
| 2FA enabled / disabled | Settings → Account → Two-factor (Supabase MFA notices) |
| Welcome to Yolias | onboarding finished |
| New sign-in detected | sign-in from a device not seen before (`known_devices`) |
| Suspicious sign-in attempts | ≥ 5 sign-in links requested for one account in an hour |
| Security alert | signed out of all devices; email changed; account suspended / restored (admin) |
| Account deleted | Settings → Delete account |
| Welcome to the {plan} plan | first paid plan |
| Subscription activated | paid again after Free, or resumed after canceling |
| Plan upgraded / downgraded | plan change; canceled plan ending ⇒ downgraded to Free |
| Subscription canceled | cancel in Settings → Billing |
| Renews soon / is ending | billing sweep: 7 days before renewal / 3 days before a canceled plan ends |
| Subscription renewed + Payment successful (receipt) | billing sweep renews a test-mode plan; receipt on every paid start |
| Prospects added | admin grant on a workspace |
| Running low / limit reached | usage ledger ≥ 80 % / 100 % of the month (once a month each) |
| Discovery ready | campaign completed or partial (also "no matches") |
| Product update announcements | written and sent in Yolias Admin → Emails |
| Payment failed, payment method needs attention, invoice ready (unpaid), refund processed / issued, payment overdue, subscription paused, access restored | templates ready; triggered by the payment provider's webhooks (D-007) |

The billing sweep is a job (`billing.sweep`) the worker queues at most once
an hour. Preview every template at `/dev/emails` (development only). Test:
`cd Yolias && npm run test:emails` (local capture server, nothing sent).
