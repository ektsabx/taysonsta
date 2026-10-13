# 11 — Current State

Snapshot of what exists in the code. Update with every change.
Last updated: 2026-10-13 (customer acquisition, D-193..D-199).

## Repository

```text
/                 Yolias Admin (former Taysonsta BOS + public website), Next.js 16
  app/admin/      admin modules; yolias.css = Yolias design layer
  lib/bos/        admin domain logic, nav, RBAC, settings
  supabase/       BOS database (local 5442x)
/Yolias           Yolias customer app, Next.js 16 (local :3200, Supabase 5463x)
/docs             this documentation
/scripts          dev-all.sh (npm run local), dev-proxy.mjs (:3200 by host),
                  taysonsta-resend.mjs (Resend key for Yolias)
```

Run everything: `npm run local` at the root → Yolias http://localhost:3200,
Admin http://admin.localhost:3200.

## Yolias (customer app)

| Area | Where | State |
| --- | --- | --- |
| Auth (magic link) | `app/(auth)`, `app/auth/confirm` | working |
| Checkout | `app/checkout/CheckoutForm.tsx`, `lib/payments` | Keyed buttons + text in elements (browser translation safe, YOLIAS-8/9); network failures shown with retry (`lib/action-client.ts`); checkout reused for repeat clicks; fulfilment retried exactly once (D-169) |
| Plans and trial | `lib/plans.ts`, `lib/trial.ts`, `lib/billing.ts`, `plan_quotas` | Pro / Growth / Scale with prospects, emails and uploaded contacts per month; 7-day trial (50/50/50), trial usage carried into the first paid month; ended plans and unpaid trials close access (D-183, D-184) |
| Polar | `lib/payments/polar.ts`, `app/checkout/polar`, `app/api/webhook/polar` | checkout + hosted portal ready; webhook verified and stored once, **not applied** until owner approval (D-185) |
| Prospects table | `services/prospects.ts`, view `prospect_items`, `components/app/ProspectTable.tsx`, `ImportCsvButton.tsx` | one table, type filters, search filters on real columns, CSV import under the contacts limit (D-187) |
| Campaigns list | `app/(app)/campaigns/page.tsx` | Name / Type / Status / Activity, status filters incl. drafts (D-188) |
| Daily limits | `lib/daily-limits.ts`, `daily_usage` | searches and Yolias AI messages per user per UTC day, atomic (D-170) |
| Sign-up protection | `lib/auth/captcha.ts`, `lib/auth/email-policy.ts`, `components/Turnstile.tsx` | Turnstile when configured; disposable domains refused by server and DB trigger (D-171) |
| Contact / bug reports | `app/(marketing)/contact`, `app/(app)/feedback-actions.ts`, `components/app/FeedbackModal.tsx`, `lib/support/messages.ts` | stored with status, limits, team email; handled in Admin → Support → Website messages (D-172) |
| Phone number | `user_phones`, Settings → Account | E.164, owner-only RLS |
| Community / Trustpilot | `lib/community.ts`, `components/app/ReviewPrompt.tsx`, `lib/review-prompt.ts` | Get Help link, one-time invite email, one-time review card (D-173) |
| Careers | `app/(marketing)/careers`, `lib/careers.ts` | published jobs marked for Yolias (D-175) |
| Solutions | `app/(marketing)/solutions`, `lib/content/solutions.ts` | 7 pages, header Solutions / Resources menus (D-177) |
| Social proof | `components/marketing/SocialProof.tsx`, `lib/content/social-proof.ts` | renders only from real approved data (empty now) |
| App shell (mobile) | `components/app/AppShell.tsx` | drawer below 900px, backdrop, Escape, closes on navigation |
| Outreach campaigns | `app/(app)/outreach`, `lib/outreach/sequence.ts`, `outreach_campaigns` / `outreach_steps` / `outreach_enrollments` | steps + follow-ups, enroll from Prospects / CRM, AI drafts, "I sent it" confirmation, real counts; no mailbox → nothing sent by Yolias (D-193) |
| Inbox | `app/(app)/inbox`, `services/inbox.ts`, `inbox_threads` | one conversation per lead, 7 filters from real rows, log reply, AI reply draft, done / others (D-194) |
| CRM | `app/(app)/crm`, `lib/crm`, `services/crm.ts`, `leads`, `lead_activities`, `lead_tasks`, `meetings`, view `crm_leads` | one lead per person / company, stages with history, table + Kanban, deal value, owner, reminders, meetings, notes, fit check (D-195) |
| AI Workspace | `app/(app)/ai/*`, `lib/ai-workspace`, `lib/agents`, `lib/automations` | Company Knowledge (moved from Settings) + offers + competitors, Customer Profiles (composer + leads), 6 agents, Rules & Permissions (server-enforced), Automations + run log (D-196..D-198) |
| Signup source, welcome video | `app/onboarding`, `lib/onboarding/source.ts`, `lib/welcome-video*.ts`, `components/app/WelcomeVideoModal.tsx`; Admin → Platform → Welcome & signup sources | optional question saved once; video from `site_settings`, once per user, reopen from menu (D-199) |
| Workspaces, members, invitations | `supabase/migrations/20261001000000_yolias_init.sql` | working, RLS |
| Search composer (text only; voice removed by the final spec, D-119) | `components/app/StrategyComposer.tsx` | working |
| ICP parsing | `lib/ai/strategy.ts`, `lib/discovery/icp.ts` | working; structured output through `lib/ai/llm` (Anthropic / OpenAI / Gemini with fallback, D-118) |
| Search pages | `app/(app)/search/[id]` (UI "Search", table `strategies`) | working |
| Intelligence Layer | `lib/intel/*` | capabilities, routing, registry, service, Vault credentials, cost logging. Tested with unit tests + a live integration run |
| Provider adapters | `lib/intel/adapters/index.ts` | **none yet**: campaigns stop at `awaiting_source` (phase 4, D-003) |
| ICP understanding | `lib/ai/strategy.ts` | cached by input hash (`intel.llm_cache`), every call/hit logged with cost (`intel.llm_calls`), fingerprint saved on the search |
| Pipeline | `lib/discovery/pipeline.ts` | background job via pgmq + worker; states, run log, retries, dead letters; reserve → consume → release |
| Match scoring | `lib/discovery/match.ts` | deterministic code (correct per rules) |
| Campaigns / Prospects / Analytics pages | `app/(app)/*` | UI working on real (empty) data |
| Plans & billing | `lib/plan-catalog.ts`, `lib/billing.ts` | quotas/prices from `plan_quotas` (admin-editable); payments in test mode only |
| Settings, usage, invoices | `components/app/SettingsModal.tsx`, `app/invoices` | working |
| Yolias AI agent (backend) | `lib/agent/*`, `app/api/agent` | 10 tools (zod-typed, authorized in code, workspace-scoped, RLS client, audited in `agent_tool_calls`); Claude tool runner with cost logging per call. `enrichProspect` / `researchCompany` answer "not connected" until providers exist. Conversation UI under each search result (`components/app/AgentThread.tsx`), saved in `agent_messages` (user turns via RLS, assistant turns server-only; D-115). Test: `npm run test:agent` |
| Email | `lib/email/*`, `supabase/config.toml` | full catalogue by category with per-category senders, logged and queued (`email_log`, worker), wired to auth, billing, usage ledger, campaign end and admin. See `05` "Emails". Payment-failure family waits on D-007 |
| Two-factor authentication | Settings → Account, `/two-factor` | TOTP via Supabase MFA; sign-in requires the code once enabled; Supabase emails the enabled/disabled notices |
| Email change | Settings → Account | Supabase double confirmation + notice to the old address |

## Yolias Admin

The BOS modules kept by the final spec (`14-final-spec-plan.md`, D-119)
exist and work, with the Yolias look. Removed entirely: client portal,
products & services, branches, cameras, social accounts, automation,
projects / tasks / time tracking, IT & external apps, WhatsApp/SMS
messaging, colour/font/theme customization. Money is EGP or USD only, never
converted (D-120). Platform modules (§B) started: Overview, Users, Workspaces,
Searches under `/admin/platform` (read-only), reading the Yolias database.
Runs at http://admin.localhost:3200.
The demo seed (`npm run seed:bos`) follows the new schema: USD/EGP only,
no projects, products, portal users or IT access records.

2026-10-12: also removed from the UI and code (tables kept): Marketing
(content studio, ads), Deal Radar, e-signature requests (DocuSign) and assets /
devices (D-174). Added: Support → Website messages (contact form + bug
reports, D-172), Careers "also on yolias.com" (D-175), platform alerts and
thresholds on Platform → Health, provider numbers and on/off on Platform →
Providers, recent Yolias AI tasks on Platform → LLM (D-176), Cloudflare
Turnstile in the Integration Hub (D-171).

## Known gaps vs the specs

| Gap | Spec | Where |
| --- | --- | --- |
| No provider live | `03` | phase 4 |
| Plan copy promises "direct phone/WhatsApp" per prospect; spec says mobile optional, no WhatsApp verification claims | `00` | `lib/plans.ts` comment, pricing/marketing copy |
| `PersonCandidate.whatsapp` field | `00` | `lib/discovery/types.ts` |
| Production worker trigger not configured (Cloudflare Cron → `/api/worker`) | `05` | at deploy |
| No real LLM / Resend calls verified from this environment (no keys here); adapters tested against local stand-ins of each API | `07` | first run with real keys: `npm run eval:icp`, send a test email |
| Payment-failure / refund / pause emails have templates but no trigger until a payment provider exists | `05` | D-007 |

## Pre-existing admin issues (not from Yolias work)

Fixed on 2026-10-05: the CSV export links (`ExportLink`), unused code, the
untranslated import-page strings, and the integration tests that relied on
fixed database ids. `npm test` at the root is fully green (types, 77 unit,
DB, 110 integration); after the final-spec removals (Phase 1): types 0 errors, 62 unit, 3 DB, 86 integration; lint has 0 errors (4 intentional warnings: external
images and a font).

## Checks

- Yolias: `cd Yolias && npm run typecheck && npm run lint && npm run test:unit && npm run build`
- Agent tools against the local DB (no LLM key needed): `cd Yolias && npm run test:agent`
- Emails / LLM fallback (local stand-ins, nothing sent): `cd Yolias && npm run test:emails`, `npm run test:llm`
- Search-understanding eval, Arabic dialects + English (needs a provider key): `cd Yolias && npm run eval:icp`
- End-to-end in a browser, both apps (with `npm run local` running): `npm run e2e` at the root (first time: `npx playwright install chromium`)
- Admin: `npm run lint`, `npm test` at the root.
