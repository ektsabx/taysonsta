# 04 — Data Model

Two worlds, strictly separated:

- **Workspace data** (`public.*`, RLS by `is_workspace_member`): strategies,
  campaigns, prospects, notes, exports, billing. Never visible to another workspace.
- **Shared intelligence** (`intel.*`): companies, people and contact facts
  reusable across workspaces **within license limits**. No direct customer
  access: only the Intelligence Layer (service role) reads and writes it.

## `intel` schema

| Table | Purpose |
| --- | --- |
| `intel.companies` | canonical company: domain (eTLD+1), name, industry, size, location, socials |
| `intel.company_identifiers` | domain, Google Place ID, LinkedIn URL, provider ids → company |
| `intel.people` | canonical person: name, LinkedIn, current title/company |
| `intel.person_identifiers` | LinkedIn, provider ids, verified email → person |
| `intel.employments` | person ↔ company, title, seniority, start/end, current |
| `intel.contacts` | emails/phones with type, verification status, verified_at |
| `intel.field_values` | provenance: entity, field, value, source, fetched_at, confidence, license_scope |
| `intel.providers` | registry (see `03`) |
| `intel.provider_calls` | every external call: cost, latency, success, records (cost engine) |
| `intel.provider_coverage` | measured coverage per provider × country × industry |
| `intel.search_cache` | ICP fingerprint → result set ids, created_at, expires_at |
| `intel.llm_cache` | input hash + model + task → output, tokens, cost |
| `intel.suppression_list` | people/emails/domains that must never be delivered |
| `intel.llm_calls` | every LLM call (and cache hit): task, model, tokens, cost |
| `intel.settings` | routing ladder, TTLs, circuit breaker, LLM prices (edited in the admin) |
| `intel.possible_duplicates` | uncertain matches waiting for review |

Built in `Yolias/supabase/migrations/20261002000000_intel_schema.sql`.
Credentials: `intel.set_provider_credential` / `clear_provider_credential` /
`provider_credential` (Vault, service role only). Aggregates:
`intel.cost_summary`, `intel.provider_spend`. Hosted Supabase: add `intel`
to the API's exposed schemas (locally it is in `config.toml`).

## Identity resolution

- **Company:** eTLD+1 of the website domain, then Google Place ID, then LinkedIn company URL.
- **Person:** LinkedIn URL, then (company + normalised full name), then verified email.
- Exact natural-key match: merge. Fuzzy match: record a `possible_duplicate` link for review. **Never auto-merge uncertain matches.**

## Provenance

Every enrichable field stores where it came from, when, with what confidence,
and under which license. The UI shows sources; the router reads freshness;
licensing reads scope.

## Freshness (TTL)

| Data | TTL |
| --- | --- |
| Company firmographics | 90 days |
| Hiring / job signals | 7 days |
| Person employment & title | 30–60 days |
| Email verification | 30 days |
| Phone | 90 days |
| Search cache (fingerprint) | 7 days |
| LLM cache (ICP parse) | until model/prompt version changes |
| Provider coverage stats | 30 days |

Values in config. Expired = refresh when needed, or show with its date. Never present as fresh.

## Public schema changes (workspace side)

- `strategies`: ✅ `icp_fingerprint`, `icp_model`, `icp_prompt_version`, `interpretation_cost_usd`, `icp_cached`. Later: `constraints jsonb`, `metadata jsonb`.
- `campaigns`: new states (see `05`), `fingerprint`, `target_count`, `delivered_count`, `estimated_cost_usd`, `actual_cost_usd`, `budget_usd`, `partial_reason`.
- `campaign_companies`: campaign ↔ `intel.companies`, qualification result and reasons.
- `prospects`: link to `intel.people`, **unique `(workspace_id, person_id)`** (no paying twice for the same person), match score + reasons, provenance snapshot, `possible_duplicate`.
- `usage_ledger`: reservations and consumption (see `06`).
- `campaign_runs`: one row per job execution: stage, attempt, status, timings, cost, error.
- Provider credentials: Supabase **Vault** only.

Existing tables to evolve, not replace: `strategies`, `campaigns`,
`campaign_events`, `companies`, `prospects` (`Yolias/supabase/migrations`).

## Migrations

- One migration per change, additive first. Backfill, then tighten constraints.
- RLS on every `public` table. `intel` has no grants for `anon`/`authenticated`.
