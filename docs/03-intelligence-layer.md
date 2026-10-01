# 03 — Intelligence Layer & Providers

The Intelligence Layer is the only way product code gets external data. It
decides **which** provider to call, **whether** to call at all, records
**what** came back, **from where**, **at what cost**, and **under which license**.

## In the code (built in phases 1–3)

| Piece | File |
| --- | --- |
| Capabilities and their input/output types | `Yolias/lib/intel/capabilities.ts` |
| Adapter contract (`ProviderAdapter`, handlers return data + billable units) | `Yolias/lib/intel/adapter.ts` |
| Adapters list (empty until phase 4) | `Yolias/lib/intel/adapters/index.ts` |
| Routing (pure, unit-tested) + circuit breaker | `Yolias/lib/intel/routing.ts` |
| Registry: syncs a disabled row per adapter, loads config, health, spend | `Yolias/lib/intel/registry.ts` |
| Service: `runCapability()` → route, Vault credential, call, price, log, health, fallback | `Yolias/lib/intel/service.ts` |
| HTTP: timeout, retry/backoff on 429/5xx, Retry-After | `Yolias/lib/intel/http.ts` |
| ICP fingerprint, cache keys | `Yolias/lib/intel/fingerprint.ts` |
| Prices → cost (LLM and per-unit) | `Yolias/lib/intel/pricing.ts` |
| LLM cache + `llm_calls` logging | `Yolias/lib/intel/llm.ts` |
| Admin: registry, credentials, settings, costs | `/admin/platform/providers`, `/admin/platform/costs` |

A provider is used only when: an adapter exists in code, its row is enabled,
it has a credential (if it needs one), its license allows storage, its
circuit is closed and it is under its daily/monthly budget. Each skip has a
reason (`SkipReason`), shown in the admin capability map.

## Capabilities

Providers declare capabilities. Code asks for a capability, never for a provider.

| Capability | Input → Output |
| --- | --- |
| `company.search` | ICP filters → company candidates |
| `company.enrich` | domain / place id / LinkedIn → company fields |
| `company.lookup_local` | name + city → place (address, phone, website), official Maps APIs only |
| `person.search` | company + titles/seniorities → people |
| `person.enrich` | LinkedIn / name + company → person fields |
| `email.find` | person + domain → email candidate |
| `email.verify` | email → `valid` / `invalid` / `catch_all` / `unknown` |
| `phone.find` | qualified person → phone/mobile (optional, last) |
| `web.search` | query → pages (Brave, Exa) |
| `web.extract` | URL → structured page content (Firecrawl; team pages, about pages) |
| `tech.detect` | domain → technologies |
| `signals.hiring` | company → open roles |

## Provider registry

One record per provider (table `intel.providers`, editable from the admin):

| Field | Meaning |
| --- | --- |
| `id`, `name`, `enabled`, `priority` | identity and on/off |
| `capabilities[]` | what it can do, with per-capability input requirements |
| `pricing` | per capability: unit, unit cost, currency, minimums, plan tier. **Config, not code** |
| `rate_limit`, `burst`, `concurrency` | throttling |
| `daily_budget`, `monthly_budget` | spend caps (budget guard) |
| `coverage` | per country / industry, measured (see evaluation) |
| `health` | rolling success rate, latency p50/p95, last error, circuit state |
| `credential_ref` | Vault secret id. Never the key itself |
| License fields | see below |
| `fallback_to[]` | allowed fallbacks per capability |

## Licensing

Every provider and every stored value carries its license terms:

| Field | Question it answers |
| --- | --- |
| `license_scope` | Under which agreement was this obtained? |
| `storage_allowed` | May we persist it? For how long (`retention_limit`)? |
| `display_allowed` | May we show it in the UI? |
| `customer_facing_allowed` | May a customer see or export it? |
| `redistribution_allowed` | May it reach another workspace (shared intel)? |
| `derived_data_allowed` | May we compute scores or aggregates from it? |
| `attribution_required` | Must we show "Source: X"? |

The router never sends a request whose result we couldn't use, and shared
reuse checks `redistribution_allowed`. Fill these from the provider's
contract or terms, never from guesses. Unknown = most restrictive.

## Routing

For each capability request the router:

1. **Shared DB:** fresh enough data in `intel.*` that the license lets this workspace use? Use it.
2. **Code:** can it be derived (domain normalisation, title → seniority, eTLD+1)? Do it.
3. **Public sources** via official APIs (company site, Maps, web search).
4. **Paid providers**, ranked by: capability fit, coverage for this country/industry, freshness, unit cost, success rate, rate-limit headroom, license, expected confidence, health (circuit closed), budget left.
5. **LLM** only for the allowed tasks (`07-llm-and-agent.md`).

The ladder order is configuration. On failure: retry with backoff, then
fall back to the next provider **only if** it has the capability and the
license fits. Every decision is logged (why this provider, why skipped).

## Provider economics (from the master spec; verify before use)

| Source | Use | Price noted in spec |
| --- | --- | --- |
| People Data Labs | company & person search/enrich | per record; plan-dependent |
| Coresignal | company, employee and jobs data | plan-dependent |
| Brave Search API | `web.search` | ~$5 / 1k requests |
| Exa | `web.search` (semantic) | ~$7 / 1k requests |
| Google Maps Platform (Places) | `company.lookup_local` | e.g. a Starter plan ~$100/month for ~50k calls |
| Firecrawl | `web.extract` | per page credits |
| Email finder / verifier | `email.find`, `email.verify` | per lookup |

These figures are planning inputs, not facts. Confirm current pricing,
limits and terms on the official pages, then put them in the registry.

Email strategy: **reuse** (shared intel) → **find** → **verify**. Mobile is
looked up last, only for qualified prospects, and only if the plan or the
search asks for it.

## Evaluating a provider (before it goes live)

Run a fixed benchmark set (Arabic markets and English markets, several
industries and sizes) and record in `intel.provider_coverage`:

coverage · field quality · match rate · freshness · reliability · latency ·
effective cost per useful record · rate limits · licensing fit.

## Adding a provider (checklist)

1. Read the official docs and terms. Note endpoints, auth, limits, pricing, license.
2. Write `lib/intel/providers/<id>.ts` implementing only the capabilities it really has.
3. Map its fields to our normalised types; keep `raw` for audit if storage is allowed.
4. Add the registry row (disabled), the Vault secret and the license fields.
5. Run the benchmark and record coverage.
6. Enable in the admin. Watch health and cost.
7. Update `11-current-state.md`.
