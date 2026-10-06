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
| D-011 | 2026-10-01 | Local dev: one command `npm run local` at the root. A host-based proxy on :3200 serves Yolias at `localhost:3200` and the Admin at `admin.localhost:3200` (apps on :3201 / :3202). Same command from `Yolias/`; ports are freed first and routing is self-tested on start. |
| D-111 | 2026-10-01 | Yolias sends email through the **Taysonsta Resend account**. Sign-in emails: Supabase Auth SMTP → `smtp.resend.com`. Product emails: Resend API. The key is read from Yolias env, else from the Taysonsta root `.env.local`, else from the Taysonsta Integration Hub. |
| D-113 | 2026-10-01 | Unknown license = most restrictive: routing skips a provider until the admin sets "storage allowed" for it. |
| D-114 | 2026-10-01 | LLM and provider prices live in `intel.settings` / `intel.providers.pricing`; a model or capability without a price is logged as "unpriced" (cost null), never as free. Since 2026-10-05 `cost_usd` is nullable in `llm_calls` / `provider_calls` (null = unpriced) and the admin shows an "Unpriced" count. |
| D-112 | 2026-10-01 | Yolias may use the Taysonsta Supabase account and keys where it needs them (owner's permission). |
| D-115 | 2026-10-05 | Yolias AI chat lives on the **existing search page** (`/search/[id]`): a conversation under the result card, no new page or layout. Conversations are **saved**, one per search (`public.agent_messages`). |
| D-118 | 2026-10-05 | Yolias AI runs on **Anthropic, OpenAI and Gemini** with automatic fallback in a configured order (`llm_routing`); Claude is first by default. Model ids and prices for each provider are configuration (owner picks them; part of the final decisions with D-008). |
| D-117 | 2026-10-05 | Emails by category with their own sender (account, subscription, billing, usage, updates, security), all logged and queued. Usage emails speak in **Prospects**, never credits (rule 26): "credits purchased" and "auto-reload" don't apply. No public API keys exist, so no API-key emails. Yolias has no passwords (magic link), so no "password changed". 2FA (TOTP) is now a real feature. |
| D-116 | 2026-10-05 | Agent tools run with the user's own Supabase client (RLS) plus an in-code role → permission table (`lib/agent/authz.ts`); today every member role has every agent permission, matching the app. The browser sends only text turns; tool calls/results are never accepted from the client. |
| D-119 | 2026-10-05 | Final spec phase 1 removals are **deleted, not hidden**: client portal, products & services, branches, cameras, social accounts (posting + post analytics), automation, projects (tasks, milestones, change requests, issues, time tracking, project documents, maintenance plans), IT & external apps, WhatsApp/SMS messaging, the Yolias voice/STT feature, and admin colour/font/theme customization. Tables, columns, functions, policies, enum values, permissions, settings, routes, services, UI and tests go together (migrations `20261101000000`, `20261101000100`). |
| D-120 | 2026-10-05 | Currency: only **EGP** (Egypt) and **USD** (every other country). No exchange rates and no conversion anywhere. Reports and pipeline metrics sum **one currency at a time** (filter, USD by default); records in the other currency are counted separately, never mixed. A payment must be in its invoice/deal currency. New records default to the company country's currency (`lib/bos/company-currency.ts`). Approval amount thresholds are set per currency and only match payloads in that currency. |
| D-121 | 2026-10-05 | Kept on purpose (not part of the removed modules): proposal case studies (`proposal_projects` links proposals to portfolio case studies), the support inbox channels Messenger / Instagram / Telegram / email / website widget, company social profile links, company logo/icon, and HR onboarding/offboarding (without IT access items). Deal **Won** now creates account activation, payment schedule, first invoice, commission and client onboarding — no project. Upsell deals link to the previous won deal. |

| D-122 | 2026-10-06 | Yolias currency: Egypt → **EGP**, every other country → **USD**, never converted. The visitor's country comes from the edge (`cf-ipcountry`), else the browser language region. A workspace's currency is fixed when it first picks a plan. EGP prices are per plan in `plan_quotas.price_egp` (Admin → Plans); while any paid plan has no EGP price, Egypt is shown and charged USD rather than an invented EGP amount. |
| D-123 | 2026-10-06 | First interface language follows the visitor's country (Arab League → Arabic, else English) when there is no explicit choice or saved profile language. Microsoft Clarity loads only with `NEXT_PUBLIC_CLARITY_PROJECT_ID`. Google sign-in shows only when the Supabase project has Google enabled. D-012 is closed: the final spec removed the "direct phone/WhatsApp" promise. |

| D-124 | 2026-10-06 | Payments: provider-agnostic `lib/payments` with **Paymob** first (D-007 closed by the spec). Hosted Unified Checkout; the signed callback (or signed redirect) is the only proof of payment; prices always computed on the server; secrets in Vault. Live plans renew by paying the opened renewal invoice (no stored cards): 7-day grace, then Free. Buy More Prospects packs grant prospects for the current month only. Invoices, events and revenue are kept per currency. |

| D-125 | 2026-10-06 | Entity layer: Person, Company, Local Business, Job with one output schema each and standard intelligence fields on every row. Four search types (people, companies, local businesses, company lookalikes), each routed by its own capability. Usage: one delivered result of the search's entity = one prospect (provisional until the credits/prospects definition); job postings and the companies behind a people search aren't billed. WhatsApp is not stored on prospects. |

| D-126 | 2026-10-06 | Prospects workspace: one tab per entity (people, companies, local businesses, jobs). Contacts are masked until revealed; revealing is recorded and free (the prospect was counted on delivery); export counts as a reveal. "Find decision makers" is a background job billed one prospect per person found. |

| D-127 | 2026-10-06 | Campaigns are continuous when asked: they run on a schedule (daily or weekly) until the goal or deadline, can be paused, resumed, run now or stopped, and keep a lineage of runs. Customers see prospects used per campaign, never cost. Without a provider, a continuous campaign waits in "awaiting data source". |

| D-128 | 2026-10-06 | Yolias AI: conversations are private, shared with the workspace, or tied to a search/campaign. Replies stream their progress. Work is orchestrated per task (reasoning / research / extraction) by configurable model routes. Tools cover every area; contacts only through a recorded reveal; billing only for owners/admins. Unpriced model calls are reported as unknown cost. |

| D-129 | 2026-10-07 | The final spec adds outreach, superseding the "no outreach" part of D-104: Yolias prepares personal emails; a person approves each one; it's sent from that person's own connected Gmail / Outlook. No automatic sequences, no WhatsApp / SMS / voice. Suppression is checked at draft and send time; each mailbox has a daily limit. |

| D-130 | 2026-10-07 | Yolias website content is edited in the Admin (DB over the shipped content, both languages). In-app notifications follow the email events; each event's email / notice can be switched off in the Admin. LLM routes and prices are edited as structured lists. Admin modules (risk, SEO, data quality, usage) show real data only. ARPA is per currency. |

## Open (owner decides)

**Owner instruction (2026-10-05): every open decision below is deferred to
the end.** Work continues on everything that doesn't need them; at the end
we take all of them together in one pass. Until then: no provider is wired
(D-003/D-004 gate phases 4, 7, 12), copy stays as is (D-012), no deploy
(D-001/D-002/D-013).

| ID | Question | Options / recommendation |
| --- | --- | --- |
| D-002 | Supabase plan / region for the production Yolias project (in the Taysonsta account) | depends on target markets (GCC/Egypt) and budget; decide at deploy time |
| D-013 | Production domains | e.g. `yolias.com` + `admin.yolias.com` on Cloudflare; the Resend sending domain must be verified for Yolias email |
| D-003 | First production-grade provider | PDL vs Coresignal (+ Google Places for local SMBs). Needs contract terms, pricing, and a coverage benchmark on Arabic markets. |
| D-004 | Email finder & verifier providers | evaluate per `03` checklist |
| D-006 | New quota numbers per plan | after the cost model is measured on real searches |
| D-008 | LLM model mix per task | default: smallest model passing the bilingual eval; ICP on Opus-class today |
| D-009 | Whether phone/mobile is offered on all plans or higher plans only | affects cost per prospect |

## D-131 — One USD price for every country (2026-10-06)
Owner decision: prices are a single unified USD price, Egypt included (replaces the Egypt → EGP part of D-120/D-122). `currencyForCountry` always returns USD; the `price_egp` columns and Paymob EGP integration ids stay in place but unused. Microsoft Clarity project id set (`NEXT_PUBLIC_CLARITY_PROJECT_ID`). The Admin light/dark toggle stays.

## D-132 — One place for every integration key (2026-10-06)
Owner decision: every key is entered only in Yolias Admin → Settings → Integrations (the Integration Hub). For providers Yolias uses (Anthropic, OpenAI, Gemini, Google OAuth for Gmail sending, Paymob), the hub copies the provider's default active account into the Yolias database on every save, enable/disable, default change or delete: LLM/OAuth keys into `public.integration_keys` (one Vault secret per provider, service role only, read through `integration_values()`), Paymob into `payment_providers` + `payment_provider_secrets`. Yolias reads these keys only from there (`lib/integrations.ts`, 30 s cache) — never from environment variables; local test scripts inject keys with `setIntegrationsForTests`. The Platform → Payments page shows Paymob read-only. Sign in with Google stays a Supabase Auth setting. Deferred by the owner: Microsoft (Outlook), Resend and data providers (they will move into the hub the same way).

## D-133 — Yolias AI is one conversation per search (2026-10-06)
Owner decision: a search is the conversation — the request, Yolias's search card as the reply, then every follow-up in the same thread with one composer at the bottom. The separate Chats section (private / shared chats) and the campaign dashboard's chat tab are removed; conversations are the sidebar's Recent searches, and a campaign links to its search ("Open in Yolias AI"). `/api/agent` takes a `strategyId` only. The conversation tables keep their scopes, unused by the app.
