# 12 — Decisions

Log every product/architecture decision. Never re-decide silently: change
the status and add a dated note.

## Taken

| ID | Date | Decision |
| --- | --- | --- |
| D-101 | 2026-09 | Yolias is provider-agnostic and multi-source from day one; PDL/Coresignal are providers only. |
| D-102 | 2026-09 | Customers are billed on **Prospects only**; no credits in the UI. Plans Free 50 / Pro 1,000 / Growth 3,000; unlimited users; same features. |
| D-005 | 2026-10 | To protect margins, **reduce Prospects per plan instead of raising price**. Quotas must be configurable. |
| D-103 | 2026-10 | UI term is **Search** ("New Search", "Recent Searches"); data model keeps `strategies`. Old `/strategies/*` URLs redirect to `/search/*`. |
| D-104 | 2026-10 | Campaign = discovery job, not outreach. No outreach/sequences/WhatsApp messaging/scraping. |
| D-105 | 2026-10 | Mobile is optional for a prospect; no "verified WhatsApp" claims. |
| D-106 | 2026-10 | LLM only for ICP, unknown classification, team-page extraction, research summary, explanations. Scoring/dedup/matching etc. are code. |
| D-107 | 2026-10 | Taysonsta BOS becomes **Yolias Admin** with the Yolias design system; all its modules stay, platform modules are added. |
| D-108 | 2026-10 | Voice uses the same pipeline: browser Web Speech, fallback to server STT (OpenAI-compatible endpoint, configurable). |
| D-109 | 2026-10 | Queue design: pgmq + pg_cron + a Node worker. Hosting of the worker still open (D-001). |
| D-110 | 2026-10 | Provider prices, limits and licenses live in the registry as configuration. |

## Open (owner decides)

| ID | Question | Options / recommendation |
| --- | --- | --- |
| D-001 | Infrastructure: where the worker runs, production hosting for both apps | Fly / Railway / Render for the worker; Supabase hosted. Waiting on owner ("لحد ما اخد قرار في البنيه التحتيه"). |
| D-002 | Supabase plan / region for production | depends on target markets (GCC/Egypt) and budget |
| D-003 | First production-grade provider | PDL vs Coresignal (+ Google Places for local SMBs). Needs contract terms, pricing, and a coverage benchmark on Arabic markets. |
| D-004 | Email finder & verifier providers | evaluate per `03` checklist |
| D-006 | New quota numbers per plan | after the cost model is measured on real searches |
| D-007 | Payment provider for live billing | billing is test mode only today |
| D-008 | LLM model mix per task | default: smallest model passing the bilingual eval; ICP on Opus-class today |
| D-009 | Whether phone/mobile is offered on all plans or higher plans only | affects cost per prospect |
| D-010 | How Yolias Admin accesses Yolias data | **Recommended:** keep separate Supabase projects; admin server uses a server-only Yolias client (dedicated env vars) behind `platform.*` RBAC + audit. Alternative: one project, separate schemas. |
| D-011 | Serving admin at `admin.localhost:3200` | **Recommended:** a small local dev proxy on :3200 routing by `Host` (`admin.localhost` → admin app, otherwise → Yolias), each app on its own internal port. Alternative: merge the apps (large change, not recommended). |
| D-012 | Fix the "direct phone/WhatsApp" promise in plan/marketing copy to match D-105 | copy change only; needs owner OK on wording |
