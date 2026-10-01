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
| D-109 | 2026-10 | Queue state lives in Postgres (pgmq + pg_cron). The worker runs on Cloudflare (see D-001): Cron Triggers and/or Cloudflare Queues consumers, no long-running Node server. Exact wiring in phase 8. |
| D-110 | 2026-10 | Provider prices, limits and licenses live in the registry as configuration. |
| D-001 | 2026-10-01 | **Hosting: Cloudflare** for the whole platform (both apps via OpenNext, the worker as Cloudflare Workers). Deploy only when the product is finished; until then everything runs locally. |
| D-010 | 2026-10-01 | Admin reads Yolias data through a server-only client (`lib/yolias/db.ts`, env `YOLIAS_SUPABASE_URL` / `YOLIAS_SUPABASE_SERVICE_ROLE_KEY`) behind `platform.*` permissions. Two Supabase projects, both in the Taysonsta Supabase account (table `invoices` would collide if merged; see `13-audit.md`). |
| D-011 | 2026-10-01 | Local dev: one command `npm run local` at the root. A host-based proxy on :3200 serves Yolias at `localhost:3200` and the Admin at `admin.localhost:3200` (apps on :3201 / :3202). |
| D-111 | 2026-10-01 | Yolias sends email through the **Taysonsta Resend account**. Sign-in emails: Supabase Auth SMTP → `smtp.resend.com`. Product emails: Resend API. The key is read from Yolias env, else from the Taysonsta root `.env.local`, else from the Taysonsta Integration Hub. |
| D-112 | 2026-10-01 | Yolias may use the Taysonsta Supabase account and keys where it needs them (owner's permission). |

## Open (owner decides)

| ID | Question | Options / recommendation |
| --- | --- | --- |
| D-002 | Supabase plan / region for the production Yolias project (in the Taysonsta account) | depends on target markets (GCC/Egypt) and budget; decide at deploy time |
| D-013 | Production domains | e.g. `yolias.com` + `admin.yolias.com` on Cloudflare; the Resend sending domain must be verified for Yolias email |
| D-003 | First production-grade provider | PDL vs Coresignal (+ Google Places for local SMBs). Needs contract terms, pricing, and a coverage benchmark on Arabic markets. |
| D-004 | Email finder & verifier providers | evaluate per `03` checklist |
| D-006 | New quota numbers per plan | after the cost model is measured on real searches |
| D-007 | Payment provider for live billing | billing is test mode only today |
| D-008 | LLM model mix per task | default: smallest model passing the bilingual eval; ICP on Opus-class today |
| D-009 | Whether phone/mobile is offered on all plans or higher plans only | affects cost per prospect |
| D-012 | Fix the "direct phone/WhatsApp" promise in plan/marketing copy to match D-105 | copy change only; needs owner OK on wording |
