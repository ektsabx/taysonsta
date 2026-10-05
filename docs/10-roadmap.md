# 10 — Roadmap

Status: ✅ done · 🟡 in progress · ⬜ not started. Update on every change.

## Done so far

| | Item |
| --- | --- |
| ✅ | Yolias customer app: marketing site, auth (magic link), onboarding, checkout (test mode), settings, invoices, emails, AR/EN RTL, light/dark |
| ✅ | Search composer (text + voice → STT), ICP parsing with structured output |
| ✅ | Discovery contracts (`lib/discovery/types.ts`), deterministic match scoring, empty provider registry |
| ✅ | Plans Free / Pro / Growth, prospects-only quota UI |
| ✅ | Taysonsta BOS restyled and renamed **Yolias Admin** |
| ✅ | Research & Architecture report; this docs set |

## Phases (order from the master specs)

| # | Phase | Status | Exit criteria |
| --- | --- | --- | --- |
| 0 | Audit both codebases: reusable parts, DB overlap, auth, provider interfaces | ✅ | `13-audit.md` |
| 0b | Admin integration: `admin.localhost:3200`, admin ↔ Yolias data access | ✅ | `npm run local`; `/admin/platform` pages; Resend for Yolias |
| 1 | Provider abstraction + Intelligence Layer skeleton (`lib/intel`) | ✅ | capabilities, router, adapters contract; discovery uses it |
| 2 | `intel` schema | ✅ | migrations + RLS/grants |
| 3 | Provider registry (DB + admin page) | ✅ | providers editable in admin, prices/limits/licenses as config |
| 4 | First production-grade provider | ⬜ | evaluated, licensed, live behind the router (D-003) |
| 5 | Pipeline stages + new campaign states | ✅ | search → prospects end to end |
| 6 | Dedup, provenance, freshness | ✅ | identity resolution, `field_values`, TTL refresh |
| 7 | Email find + verification | ⬜ | reuse → find → verify |
| 8 | Queue + worker (pgmq + `/api/worker`, Cloudflare Cron in prod) | ✅ | idempotent jobs, retries, DLQ, budget guard |
| 9 | Cost engine + usage ledger | ✅ | atomic reserve/consume, `provider_calls`, configurable quotas |
| 10 | Agent tools | ✅ | typed, authorized, audited tools in Yolias AI; saved conversation on the search page (D-115) |
| 11 | Analytics (customer + admin) | ✅ | SQL aggregates, real metrics only |
| 12 | More providers | ⬜ | routing + fallback across ≥2 per key capability |

Admin platform modules (`09`) are built alongside the phase that creates
their data (e.g. Providers with phase 3, Jobs with phase 8, Usage ledger with 9).

Phases 4, 7 and 12 and the deploy are **deferred to the end** with all open
decisions (owner, 2026-10-05; see `12-decisions.md`).

Don't start a phase without the owner's go-ahead. Hosting is decided
(Cloudflare, D-001); the first provider (D-003) gates phase 4.
