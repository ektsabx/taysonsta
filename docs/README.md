# Yolias Docs

This folder is the **source of truth** for Yolias: the vision, the rules, the
architecture, and the build plan. Read it before writing code. When code and
docs disagree, fix one of them in the same change.

The content comes from two master specifications agreed with the owner:
**Yolias Intelligence Platform (Master Prompt)** and **Master Product,
Architecture & Admin Specification**. These files are those specs, organised
for implementation.

## Two products, one platform

| Product | What it is | Code | Local URL |
| --- | --- | --- | --- |
| **Yolias** | Customer app. A Prospect Intelligence & Discovery Platform. | `Yolias/` | http://localhost:3200 |
| **Yolias Admin** | Company Control Center + Platform Control Center + Intelligence Operations Center. Built on the former Taysonsta BOS / Taysonsta Pages. | repo root (`app/admin`, `lib/bos`) | http://admin.localhost:3200 |

Run both: `npm run local` at the repo root.

## Files

| # | File | Read it when |
| --- | --- | --- |
| 00 | [00-vision.md](00-vision.md) | Always first: what Yolias is and is not |
| 01 | [01-rules.md](01-rules.md) | **Before any change.** Non-negotiable rules |
| 02 | [02-architecture.md](02-architecture.md) | Touching how the apps, layers or databases fit together |
| 03 | [03-intelligence-layer.md](03-intelligence-layer.md) | Providers, registry, routing, licensing, provider economics |
| 04 | [04-data-model.md](04-data-model.md) | Any migration: `intel` schema, provenance, TTLs, dedup, public tables |
| 05 | [05-pipeline-and-workers.md](05-pipeline-and-workers.md) | Discovery stages, campaign states, queue, jobs, failures |
| 06 | [06-usage-pricing-cost.md](06-usage-pricing-cost.md) | Plans, Prospect quotas, usage ledger, cost engine |
| 07 | [07-llm-and-agent.md](07-llm-and-agent.md) | Anything that calls an LLM, or the Yolias AI agent and its tools |
| 08 | [08-security.md](08-security.md) | Auth, RLS, credentials, permissions, BYOK |
| 09 | [09-yolias-admin.md](09-yolias-admin.md) | Anything in the admin |
| 10 | [10-roadmap.md](10-roadmap.md) | Choosing what to build next; phase status |
| 11 | [11-current-state.md](11-current-state.md) | What exists in the code today, known gaps |
| 12 | [12-decisions.md](12-decisions.md) | Decisions taken and decisions still open |
| 13 | [13-audit.md](13-audit.md) | Phase 0 audit: what to reuse from the Admin, DB overlap, auth |

## How to work with these docs

1. Read `00`, `01`, then the file(s) for the area you touch.
2. Read the existing code before changing it (`11-current-state.md` says where).
3. Do not invent requirements. If the docs don't answer it, it is an **open
   decision**: add it to `12-decisions.md` and ask the owner.
4. After a change: update `11-current-state.md`, tick the phase in
   `10-roadmap.md`, and log any new decision in `12-decisions.md`.
5. For Next.js code, follow `AGENTS.md`: this Next.js version differs from
   training data, so check `node_modules/next/dist/docs/` first.

## Glossary

| Term | Meaning |
| --- | --- |
| **Search** (UI) / **Strategy** (data) | What the user asks for in plain language. The UI says "New Search" and "Recent Searches"; the table stays `strategies`. |
| **ICP** | Ideal Customer Profile: the structured criteria parsed from a search. |
| **Fingerprint** | Hash of the normalised ICP. Equal fingerprints reuse work and cache. |
| **Campaign** | One **discovery job** for a search. Not outreach. |
| **Prospect** | A delivered decision maker that matches the ICP (definition in `00`). The only unit the customer pays for. |
| **Provider** | An external data source (PDL, Coresignal, Brave, Exa, Google Places, a verifier, ...). Always behind an adapter. |
| **Intelligence Layer** | The service between Yolias and providers: registry, routing, caching, provenance, cost. |
| **Shared intelligence** | Cross-workspace company/person data in the `intel` schema, reusable within license limits. |
| **Workspace data** | A customer's own campaigns, prospects, notes and exports. Never shared. |
