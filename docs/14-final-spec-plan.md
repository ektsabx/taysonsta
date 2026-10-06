# 14 — Final Product Spec: execution plan (10 phases)

Source: the owner's "Yolias AI — Final Product & Development Specification"
(2026-10-05). Executed one phase at a time; a phase is done only when its
backend, database, API and UI work and are tested (spec §66). Anything the
spec removes is removed everywhere (DB, API, services, routes, types, UI,
settings, permissions, tests), never just hidden.

| # | Phase | Spec sections | Status |
| --- | --- | --- | --- |
| 1 | Removals & cleanup: voice/mic/STT; client portal; products & services; branches; cameras; social accounts; automation; projects; IT & external apps; multiple currencies; admin theme customization; header settings icon; WhatsApp/SMS/voice channels; their settings, permissions, routes, tables | 4, 34, 44–55 | done (D-119, D-120, D-121) |
| 2 | Platform basics: Microsoft Clarity, language by country, Google sign-in/up, currency rule (Egypt → EGP, else USD), same features on every plan, "No commitment · Cancel anytime" | 5, 8, 28, 29, 42, 54 | done (D-122, D-123) |
| 3 | Payments: provider-agnostic billing layer, Paymob adapter (server-side, keys in Vault), provider settings in Admin, Buy More Prospects | 1, 27, 62 | done (D-124); live keys pending |
| 4 | Entity layer + search types: Person, Company, Local Business, Job; People / Companies / Local Businesses / Company Lookalikes with their own output schemas; standard intelligence fields (source, provenance, last updated, confidence, match score, missing data) | 11–14, 37 | done (D-125); providers pending (D-003) |
| 5 | Prospects: tabs per entity, filter/search/sort, select / select all across pages, pagination, CSV export, detail, contact reveal, decision-maker matching | 9, 10, 15, 16, 25, 61 | done (D-126) |
| 6 | Campaigns: continuous discovery with goal + deadline + status, list, dashboard, internal navigation, campaign chat, run lineage, usage per campaign | 17–24, 26, 60, 61 | done (D-127) |
| 7 | Yolias AI: Claude-like chat thread, plan badge + Upgrade, message actions (copy, like, dislike, time), thinking states; conversations (user, workspace, campaign); orchestrator (Gemini research, Claude reasoning, small model for extraction); agent tools for every area; cost per call and per tool call | 6, 7, 35, 57–59, 63 | done (D-128); model ids pending (D-008) |
| 8 | Outreach: personalized message preparation + send architecture through connected integrations (no WhatsApp/SMS/voice) | 33, 34 | done (D-129); OAuth clients pending |
| 9 | Admin: Yolias design system only; content management (Help Center, Docs, Blog, website); notifications system; email templates/events management; LLM management; pricing & plans; ARPA; modules (risk, SEO, prospect intelligence, data operations, usage/credits, analytics) | 30, 31, 36, 38–41, 44, 62 | done (D-130); theme toggle = decision #9 |
| 10 | Screenshot documentation (real screenshots + annotations in Docs/Help Center); full test matrix (§66); final report | 32, 56, 66 | done |

## Decisions taken by the spec

| Decision | From the spec |
| --- | --- |
| D-007 payment provider | **Paymob** now, behind a provider-agnostic layer (Stripe later) |
| D-001 hosting | Cloudflare, keep the current deployment |
| D-111 email | Resend (needs the key — see below) |
| D-012 copy | WhatsApp / SMS / voice are not channels: remove those promises |
| D-009 mobile | Every plan has every feature; plans differ only in usage ⇒ phone/mobile (when available) on all plans |
| D-008 (partial) | Orchestrator: Gemini for research, Claude for reasoning, a smaller model for classification/extraction — exact model ids still needed |
| Currency | Egypt → EGP, every other country → USD; no other currencies |

## Still open (asked in chat)

- Resend API key + verified sending domain.
- Paymob credentials (API key, integration ids, iframe id, HMAC secret) and EGP prices per plan.
- "Credits" vs "Prospects": the spec shows credits used per campaign; rule 26 said customers see prospects only. Unit definition needed.
- Prospects/credits per plan (D-006) and Buy More packs (sizes, prices).
- Google OAuth client (id + secret) for the Yolias Supabase project.
- Data providers (D-003/D-004): company/person provider, email finder/verifier, Google Maps Places key.
- Model ids per task (D-008) and their prices.
- Production Supabase plan/region and domains (D-002/D-013).

## Delivered

### Phase 2 — platform basics (2026-10-06)

- **Microsoft Clarity**: `Yolias/components/Clarity.tsx` in the root layout, official snippet, loads only when `NEXT_PUBLIC_CLARITY_PROJECT_ID` is set.
- **Language by country**: `lib/i18n/server.ts` resolves cookie → profile → country (`cf-ipcountry`; Arab League countries → Arabic, others → English) → browser → English. Onboarding stores the detected country as the profile's home market.
- **Google sign-in/up**: `signInWithGoogle` (Supabase OAuth, PKCE, back through `/auth/confirm`), button on login and signup, keeps a plan picked on /pricing. The button shows only when the Supabase project has Google enabled (`lib/auth/providers.ts` reads `/auth/v1/settings`). Locally `npm run local` enables it when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are in `Yolias/.env.local` (`[auth.external.google]` in `config.toml`). Verified with a dummy client: the button appears and Supabase redirects to Google.
- **Currency rule**: `lib/geo.ts` (Egypt → EGP, else USD), `plan_quotas.price_egp`, `workspaces.billing_currency` / `billing_country` (fixed when the workspace first picks a plan). Pricing, signup, checkout and Settings → Billing show the plan price in that currency (`formatMoney`). Admin → Platform → Plans edits USD and EGP prices (audited). Until every paid plan has an EGP price, Egypt sees USD (D-122).
- **Same features on every plan**: comparison table lists Continuous campaigns instead of the removed Automations; prospect definition no longer promises "direct phone/WhatsApp" (D-012 closed by the spec).
- **"No commitment · Cancel anytime"** on pricing and checkout.
- Tests: `tests/unit/geo.test.ts`.

### Phase 3 — payments (2026-10-06)

- **Provider-agnostic layer** `Yolias/lib/payments`: `types.ts` (contracts), `paymob.ts` (pure adapter: Intention API body, Unified Checkout URL, HMAC-SHA512 over Paymob's 20 fields for the POST callback and the GET redirect, outcome mapping — verified against developers.paymob.com), `index.ts` (server: config + Vault secrets, `startCheckout`, `settlePayment`, fulfilment).
- **Flow**: server-priced `pending` payment → Paymob hosted checkout → signed callback `POST /api/payments/paymob` (or the signed redirect `GET /api/payments/paymob/return`) → amount + currency checked → status moves once (idempotent) → plan started / renewal invoice paid / pack granted, with a paid invoice in the payment's currency → `/billing/result`. Failed → `payment_failed` email; refunded → invoice void + `refund_processed`.
- **Database** (`20261102000100_payments.sql`): `payment_providers` (non-secret config), `payment_provider_secrets` + `set_payment_secret` / `clear_payment_secret` / `payment_secret` (Vault, service role only), `payments`, `prospect_packs`; invoices and subscription events now carry `amount` + `currency` (renamed from `amount_usd`), invoices have `kind` (subscription / prospect_pack); `admin_profitability` returns revenue per currency.
- **Renewals**: Paymob hosted checkout stores no card, so a live plan is never charged automatically: at period end the renewal invoice opens, the workspace is `past_due` (keeps access, banner + "invoice ready" email with a pay link), paying it renews; unpaid after 7 days → Free and the invoice is voided. Test-mode plans renew with test invoices as before.
- **Buy More Prospects**: packs (prospects + USD price + optional EGP price) in Admin; customers buy them in Settings → Usage; a paid pack is a `grant` in the usage ledger for the current month.
- **Admin → Platform → Payments**: Paymob settings (enable, test/live, region URL, public key, integration ids per currency), secret key + HMAC secret into Vault (masked hints only), callback URLs to paste in Paymob, packs, latest payments, 30-day totals per currency. Profitability shows revenue per currency; margins only for USD (costs are USD, nothing converted).
- **Fallback**: with no provider for the workspace currency, `BILLING_TEST_MODE=true` (local) activates plans/packs as test charges; otherwise checkout says payments aren't connected.
- Tests: `tests/unit/paymob.test.ts`; `npm run test:payments` (end to end with a local Paymob stand-in: signature, amount check, replay, failure, pack, redirect, refund, live renewal, grace downgrade); `npm run test:emails` updated.
- **Needs the owner**: Paymob account keys (public key, secret key, HMAC secret, integration ids), EGP prices per plan, pack sizes/prices.

### Phase 4 — entity layer + search types (2026-10-06)

- **Entities** (`Yolias/lib/entities`): Person, Company, Local Business, Job — zod output schemas (the single contract for UI, CSV, agent tools, API) + the standard intelligence block: `source`, `provenance` (per field: source, time, confidence), `last_updated`, `confidence`, `match_score` + `match_reasons`, `missing`. `missingFields` reports expected fields that weren't found; nothing is invented.
- **Search types**: `people` (default), `companies`, `local_businesses`, `company_lookalikes`. The ICP now has `search_type` + `lookalike_seeds` (prompt `icp-2026-10-06`); old searches read as people searches. Each type declares its source capability and optional ones (`searchTypeSpecs`). The search cache fingerprint includes the type (people keeps its old fingerprint).
- **Capabilities** added: `company.lookalikes`, `place.search`, `job.search` (Admin labels too).
- **Database** (`20261102000200_entities.sql`): `campaigns.search_type`; `companies.kind` (company / local_business) + local fields (category, address, phone, website, rating, reviews, place id, maps url) + intelligence columns + `saved_at` + `delivered_at`; `prospects` intelligence columns; new `jobs` table (hiring signals, RLS read for members); `prospects.whatsapp` dropped (not a channel).
- **Pipeline**: waits for a source of the type's capability (`awaiting_source` with its own message); people → companies (context, not billed) → people (billed); companies / lookalikes / local businesses → the companies are the results (one delivered result = one prospect of usage); job postings attached when the search asks for hiring companies and a provider offers job search (not billed); suppressed domains skipped; a workspace never pays twice for the same company/place. Shared intel stores maps place ids as identifiers and local fields with provenance.
- WhatsApp removed from Yolias UI/CSV/copy; a phone badge replaces it.
- Tests: `tests/unit/intel.test.ts` (fingerprint per type); `npm run test:search-types` (end to end with a stand-in adapter registered only in the test process: all four types, intelligence fields, usage, jobs, no double delivery). Local Yolias DB rebuilt from all migrations; `test:payments`, `test:agent` pass on it.
- **Provisional (decision #3)**: one delivered result of the search's entity = one prospect. Change in one place if the owner defines credits differently.

### Phase 5 — Prospects (2026-10-06)

- **Tabs per entity**: People, Companies, Local Businesses, Jobs with counts (`services/prospects.ts`, `app/(app)/prospects/page.tsx`). Search, campaign, market, minimum match, verified-only (people), city (local) and sort (best match / newest / name) live in the URL.
- **Selection**: row checkboxes, select all on the page, then "select all N matching" across pages; bulk bar with Export selected, Reveal contacts (people), Find decision makers (companies / local), Remove from Prospects. Bulk actions send ids or the filters; the server resolves them with the member's RLS client.
- **Pagination**: 50 per page with totals.
- **CSV export**: GET = all rows matching the filters; POST = the selection. Own columns per entity + match, confidence, last updated, missing data, source. Formula-injection safe. Exporting people records a reveal.
- **Detail pages**: `/prospects/person/[id]`, `/prospects/company/[id]` (companies and local businesses): overview, company / decision makers / open roles, and the data intelligence panel (match + reasons, confidence, last updated, source, missing data, per-field provenance).
- **Contact reveal**: emails and phones reach the browser masked until a member reveals them (single or bulk); the first reveal is recorded (`prospects.revealed_at` / `revealed_by`). No extra prospect is used — the person was counted when delivered. The search page card follows the same rule.
- **Decision-maker matching**: "Find decision makers" on saved companies / local businesses queues job `company.people` → `findDecisionMakers` (pipeline): `person.search` with the search's titles, same delivery rules as a people search (suppression, never paying twice, verification, scoring), people saved straight to Prospects, one prospect each, reserved/released per company; status on the company (queued, searching, N found, no source, prospects used up, failed).
- **Save to Prospects** also saves the companies / local businesses a company search delivered; members can update only `saved_at` / `people_requested_at` on companies (column privilege + RLS).
- The search page card shows the top results of company / lookalike / local searches.
- Local demo data for checks and screenshots: `npm run seed:demo-results` (labelled `demo_seed`, local database only).
- Verified in Chrome (EN + AR/RTL): tabs, filters, selection, export (10 rows), single + bulk reveal, find decision makers (shows "no people source connected yet" — no provider), detail pages. `npm run test:search-types` covers decision-maker matching.

### Phase 6 — campaigns (2026-10-06)

- **Continuous discovery** (`20261102000400_continuous_campaigns.sql`, pipeline): a campaign has a goal (`quota`), an optional deadline, `continuous` + `run_every_hours` (daily / weekly), `next_run_at`, `runs_count`. Each run reserves only what's left of the goal; totals are cumulative; later runs skip the first-page cache and ask the source for the next candidates (`offset`). After a run: goal reached → completed; continuous with time left → `scheduled` (new state); else completed / partial (reason `deadline` / `fewer_matches` / `no_matches` / `stopped`). A pause or stop made during a run is noticed between results and never overwritten. "Results ready" is emailed once, when the campaign ends.
- **Scheduler**: every worker tick `scheduleCampaigns()` queues due scheduled campaigns (claimed once) and closes the ones past their deadline.
- **Run lineage**: `campaign_runs.delivered`; `run_id` on prospects, companies and jobs. **Usage per campaign**: `campaign_usage()` (prospects used / still reserved — never money).
- **Campaign list** (`/campaigns`): type, one-off / continuous + frequency, goal progress bar, status + reason, next run, deadline.
- **Campaign dashboard** (`/campaigns/[id]`) with internal navigation: Overview (goal progress, prospects used, saved, runs, deadline + days left, next run, delivered-per-day chart), Results (per entity, links into Prospects filtered by the campaign), Runs (lineage table), Activity (events), Chat (the search's Yolias AI conversation). Controls: Run now, Pause, Resume, Stop (confirm), Settings (goal, deadline, continuous, daily / weekly); a finished campaign given a higher goal or made continuous starts again.
- Tests: `npm run test:campaigns` (three scheduled runs to a goal of 5 with offsets 0/2/4, lineage, usage, scheduler, pause respected, deadline closing). Verified in Chrome (EN + AR): list, dashboard views, settings save, pause, resume.

### Phase 7 — Yolias AI (2026-10-06)

- **Conversations** (`20261102000500_conversations.sql`): `conversations` with scope `user` (private), `workspace` (shared) or `campaign` (a search's conversation, created by the server; existing messages migrated). RLS: private chats only for their creator; members can't create campaign conversations or forge assistant turns. `/chat` lists them, `/chat/[id]` opens one; "Chats" in the sidebar; a search / campaign keeps its conversation on the search page and the campaign's Chat tab.
- **Claude-style thread** (`components/app/AgentThread.tsx`): user turns as bubbles, assistant replies with paragraphs and lists, greeting + suggestions for new chats, composer with the **plan badge + Upgrade** (owners/admins below Growth), privacy hint. **Thinking states** stream from `/api/agent` as NDJSON (thinking → "Checking your usage…" per tool → done / error). **Message actions**: copy, like, dislike (`agent_feedback`, own rows, replies only), time.
- **Orchestrator** (`lib/ai/orchestrator.ts`, D-008): per-task routes in `llm_routing` — `agent` reasoning (Claude), `research` web summaries (Gemini first, Claude fallback), `extract` classification / extraction (Claude Haiku 4.5, Gemini Flash fallback). Defaults are configuration; model ids still need the owner's confirmation.
- **Tools for every area** (`lib/agent/tools.ts`, 19 tools): people (search, filter, get, revealContact — recorded, saveResults, enrichProspect via email.find → email.verify / phone.find), companies & local businesses (listCompanies, getCompany), jobs (listJobs), findDecisionMakers, researchCompany (web.search → web.extract → research summary → extracted facts), searches & campaigns (getCampaign with runs and usage, updateCampaign: pause / resume / run now / stop / goal / deadline / schedule, getStrategy, createCampaign), getAnalytics, getUsage, getBilling (owners/admins). Permissions in code (`authz.ts`); contact details never leave without a recorded reveal. Campaign rules shared with the app (`lib/discovery/campaign-control.ts`).
- **Cost per call and per tool call**: every LLM call logged with its conversation (`llm_calls.conversation_id`); every tool call records what its provider/LLM calls cost (`agent_tool_calls.cost_usd`, `unpriced_calls`); unpriced models are counted as unknown, never as $0. Admin → Yolias AI shows conversations by kind, reply ratings, tool cost, cost per orchestrator task and cost per tool / per call.
- Tests: `npm run test:ai` (privacy, feedback, reveal, campaign control, billing permission, research orchestrator with Gemini + Claude stand-ins, metered cost: $0.0145 + 1 unpriced); `test:agent`, `test:llm` updated and passing. Verified in Chrome (EN + AR) with a local Claude stand-in: streamed statuses "Thinking → Checking your usage → Thinking", reply, copy, like kept after reload.

### Phase 8 — outreach (2026-10-07)

- **Database** (`20261102000700_outreach.sql`): `mailboxes` (a member's own Gmail / Outlook, refresh token in Vault via `set_mailbox_token` / `mailbox_token` / `clear_mailbox_token`, daily limit, sent-today counter) and `outreach_messages` (draft → approved → sending → sent / failed / canceled). Members read their workspace's messages, edit drafts, approve, cancel or send back to draft; a trigger allows only those human steps (a member can't mark anything sent or edit an approved message). Drafts and sending are server work.
- **Preparation** (`lib/outreach/index.ts` → `draftOutreach`): Yolias AI writes a short personal email (route `write`, falls back to the default/Claude) from Yolias data only — prospect, company, the sender's business, an optional instruction — in English or Arabic; never for suppressed people or people without a usable email; model and cost recorded.
- **Send architecture** (`lib/outreach/mailers.ts`, verified against the official docs): Gmail `users.messages.send` (base64url RFC 2822, UTF-8 / RFC 2047 for Arabic, scope `gmail.send`) and Microsoft Graph `POST /me/sendMail` (`Mail.Send`, 202). OAuth connect / callback routes (`/api/integrations/[provider]/connect|callback`) with a one-time httpOnly state; only the refresh token is kept (Vault). Job `outreach.send`: claims an approved message once, re-checks suppression, uses the **approver's own** mailbox, counts a per-mailbox daily limit atomically, refreshes the token, sends, records the provider id; auth errors mark the mailbox "needs reconnecting"; outages retry with backoff. No automatic sequences; every message is approved by a person. Email only — no WhatsApp, SMS or voice.
- **UI**: "Outreach" in the sidebar (`/outreach`: mailboxes with connect / daily limit / disconnect, messages by status); the composer on each person's page (prepare, edit, save, approve & send from a chosen mailbox, copy, open in the email app, back to draft, cancel); "Prepare messages" for a selection in Prospects (job `outreach.prepare`); Settings → Integrations shows Gmail / Outlook for real. Yolias AI tool `prepareOutreach` writes a draft only.
- **Needs the owner**: Google OAuth client with the Gmail send scope (`GOOGLE_CLIENT_ID/SECRET`, redirect `<site>/api/integrations/gmail/callback`) and a Microsoft app (`MICROSOFT_CLIENT_ID/SECRET`, redirect `<site>/api/integrations/outlook/callback`). Until then the connect buttons say the provider isn't available.
- Tests: `tests/unit/mailers.test.ts`; `npm run test:outreach` (Claude + Google stand-ins: draft, human-only steps, approved UTF-8 send, idempotency, suppression, daily limit, revoked mailbox).

### Phase 9 — Yolias Admin (2026-10-07)

- **Design system**: the Admin renders with the Yolias layer (`app/admin/yolias.css` over the BOS base); colour / font / theme customization was removed in phase 1. The light/dark toggle stays until the owner's decision #9.
- **Content management** (`20261102000800_content.sql`, Admin → Platform → Website content): Help Center, Docs, Blog and legal pages in one table with both languages; edited as simple Markdown (`lib/yolias/content.ts`, round-trip tested) with status draft / published / hidden. The site reads published rows over the content shipped in code (`Yolias/lib/content/store.ts`); `npm run content:seed` copies the shipped content in (run by `npm run local`). Sitemap (`/sitemap.xml`, includes CMS pages) and `robots.txt` added.
- **Notifications system** (`20261102000900_notifications.sql`): in-app notifications created by the same events as the emails (subject in the user's language, link to the invoice / search / page, deduplicated); bell with unread count in the Yolias sidebar (mark one / all read). Product announcements from the Admin appear in-app too.
- **Email templates / events management**: Admin → Emails lists every event (category, 30-day sent / failed / skipped) with switches for the email and the in-app notice (`email_settings`, applied within 30 s, audited).
- **LLM management** (Admin → Platform → LLMs): which provider keys are set, the route per task (default, agent, research, extract, write, icp.parse) as an ordered list with fallbacks, model prices (USD per million tokens, cache multipliers), unpriced models in routes flagged, usage per task and model for 30 days. Saved through the validated, audited `llm_routing` / `llm_prices` settings.
- **Pricing & plans**: USD + EGP prices and quotas (phase 2), packs (phase 3). **ARPA** per currency on Profitability (real revenue ÷ paying workspaces, never mixed).
- **Modules**: Risk (past-due, failed payments, refunds, denied assistant requests, failed / suppressed outreach, failed campaigns, suspicious sign-ins, unresolved jobs; scored per workspace), SEO (live check of every public page in both languages: title / description length and duplicates, one H1, page language, robots, sitemap), Data quality (prospect intelligence: email / verified / invalid / phone / LinkedIn rates, stale data, missing fields, by source), Usage (this month by plan and workspace, packs sold). Data operations (shared data, jobs) and analytics (platform overview) already existed.
- SEO fixes found by the new check: page-specific descriptions (product, pricing, about, contact, help) and a shorter product title.
- Tests: `tests/unit/content-markdown.test.ts`; `npm run test:emails` now covers in-app notifications and the admin switches. All new Admin pages load (Chrome, signed in as the local admin).

### Phase 10 — screenshots, test matrix, report (2026-10-07)

- **Annotated screenshots**: a `figure` content block (image, caption, numbered markers placed by percentage, legend) in the site renderer and the Admin's Markdown (`![alt](src "caption")` + `@ x% y% label` lines). 12 real screenshots (6 screens × EN / AR) in `Yolias/public/docs/shots/`, taken from the local app with example data. New Docs page "A tour of Yolias" (`/docs/tour`) and Help article "Working with Prospects" (`/help-center/prospects-workspace`), both languages, editable in the Admin.
- **Test matrix**: `16-test-matrix.md` — every suite green (Yolias 11 suites + build, Admin types / unit / DB / integration / lint / build, browser e2e).
- **Final report**: below and in `15-handoff-ar.md`.

## Final report (phases 2–10)

Done and tested: platform basics, payments (Paymob behind a provider-agnostic layer), entity layer and four search types, the Prospects workspace, continuous campaigns, Yolias AI (conversations, streamed states, orchestrator, tools for every area, cost per call), outreach through the member's own mailbox, the Admin (content, notifications, email events, LLM management, ARPA, risk, SEO, data quality, usage) and annotated docs.

Waiting on the owner (everything is wired; each shows "not connected" until set): Paymob keys + EGP prices + packs; Google OAuth client (sign-in + Gmail send) and a Microsoft app (Outlook); LLM keys and final model ids per task (D-008); data providers (D-003 / D-004: company, people, maps, jobs, lookalikes, email find / verify, web search); Resend key + domain; Clarity project id; credits vs prospects definition (#3); quotas per plan (#4); production Supabase + domains; the Admin light / dark toggle (#9).
