# 16 — Test matrix (final spec §66)

Run on 2026-10-07 against the local stack (`npm run local`), every result
from a real run. Nothing here talks to a paid provider: payment, LLM, mail
and data providers are replaced by local stand-ins inside the test process.

## Yolias (`cd Yolias`)

| Suite | Command | Covers | Result |
| --- | --- | --- | --- |
| Types | `npm run typecheck` | whole app | ✅ 0 errors |
| Lint | `npm run lint` | whole app | ✅ 0 problems |
| Unit | `npm run test:unit` | match, ICP, identity, intel (fingerprints per search type), agent, geo / currency, Paymob signatures, mailers (RFC 2822 / UTF-8) | ✅ 36 / 36 |
| Build | `npm run build` | production build | ✅ 62 pages |
| Agent tools | `npm run test:agent` | authz, workspace scoping, RLS, "not connected", audit | ✅ |
| LLM fallback | `npm run test:llm` | Claude → OpenAI → Gemini, no switch after a side effect | ✅ |
| Emails + notifications | `npm run test:emails` | every email event, dedupe, preferences, in-app notifications, admin switches | ✅ |
| Payments (phase 3) | `npm run test:payments` | checkout, signature, amount check, idempotency, failure, pack, signed redirect, refund, live renewal, grace downgrade | ✅ |
| Search types (phases 4–5) | `npm run test:search-types` | people / companies / lookalikes / local businesses, intelligence fields, usage, jobs, no double delivery, decision-maker matching | ✅ |
| Campaigns (phase 6) | `npm run test:campaigns` | scheduled runs to a goal, next candidates, lineage, usage, scheduler, pause, deadline | ✅ |
| Yolias AI (phase 7) | `npm run test:ai` | private / shared conversations, feedback, reveal, campaign control, billing permission, research orchestrator, cost per tool call | ✅ |
| Outreach (phase 8) | `npm run test:outreach` | draft, human-only steps, approved send, idempotency, suppression, daily limit, revoked mailbox | ✅ |

## Yolias Admin (repo root)

| Suite | Command | Result |
| --- | --- | --- |
| Types + unit + database + integration | `npm test` | ✅ types 0 errors · unit 63 / 63 · DB 3 / 3 · integration 86 / 86 |
| Lint | `npm run lint` | ✅ 0 errors (2 old intentional warnings: a font link, an `<img>`) |
| Build | `npm run build` | ✅ 207 pages |

## Both apps in a browser

| Suite | Command | Result |
| --- | --- | --- |
| End to end | `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run e2e` | ✅ 13 steps: home → sign-up → magic link → checkout → onboarding → search → Yolias AI → prospects / campaigns / analytics → settings → Admin users, emails, platform pages |

Manual checks in Chrome (EN + AR / RTL), recorded in `14-final-spec-plan.md`
per phase: pricing per country, Google button, prospects tabs / selection /
export / reveal, detail pages, campaign dashboard and controls, chat with
streamed tool states and reply actions, outreach composer, every new Admin
page, docs screenshots with markers.

## Not covered (needs the owner's accounts)

Real charges (Paymob keys), real Google / Microsoft OAuth (client ids),
real LLM answers (keys), real data providers (D-003 / D-004), Resend
delivery, Microsoft Clarity (project id). Each one is wired and tested
against a stand-in of its official API; it shows "not connected" until set.

## Re-run after D-131 / D-132 / D-133 (2026-10-06)

| Check | Result |
| --- | --- |
| Yolias typecheck · lint · build | ✓ |
| Yolias unit (35) · test:agent · test:llm · test:emails · test:payments · test:search-types · test:campaigns · test:ai · test:outreach | ✓ all pass |
| Admin `npm test` (types, unit 63, DB, integration 86) · lint · build | ✓ |
| Browser: search page as one conversation (EN + AR), campaign "Open in Yolias AI", `/chat` gone (404) | ✓ |
| Hub → Yolias sync: Gemini key copied to Vault and used by Yolias AI (`gemini-3.8-flash`); Paymob moved into the hub | ✓ |

Test scripts never use the owner's real keys: each one injects its own (or none) with `setIntegrationsForTests`, and `test:payments` restores the real Paymob secrets it touches.

## Re-run after D-138 … D-141 (2026-10-06)

| Check | Result |
| --- | --- |
| Yolias typecheck · lint · build | ✓ |
| Yolias unit (40, incl. agent policy / guardrail / cache) · test:agent (incl. disabled tools, roles, approvals, memory) · test:agent-control (eval runner, cache) · test:llm · test:emails · test:payments · test:search-types · test:campaigns · test:ai · test:outreach | ✓ all pass |
| Admin `npm test` (types, unit 63, DB, integration 87 incl. policy draft → publish → rollback) · lint · build | ✓ |
| Browser: widget Intercom-style opened from "Contact Support" (AR + EN), message reaches the Admin inbox; control center tabs render | ✓ |

## Customer acquisition (D-193 … D-199, 2026-10-13, local only)

| Check | Result |
| --- | --- |
| Yolias typecheck · lint · unit (73, incl. 9 new: rules, automations, fit check, opt-out, signup source, video links) | ✓ |
| `npm run test:acquisition` (local DB, no AI keys): signup source once + DB checks, welcome video live, one lead per person / company, stage history + view, RLS isolation (6 tables), automations once / no chains / permissions, outreach enroll + confirm sent + gap rule + follow-up sweep, opt-out reply without AI, meetings → stages + automation once | ✓ |
| Existing: test:agent · test:agent-control · test:plans-trial · test:campaigns | ✓ |
| Migration `20261111000000` re-applied from the previous schema inside a rolled-back transaction | ✓ |
| Browser (headless Chrome, demo account, AR): all new pages 200 without console errors; profile → Prospects "Add to CRM" → stage change → Kanban → campaign + add leads → note + meeting (stage → Meeting Booked) → log reply (AI analysis, Gemini) → Inbox filters; phone width Inbox / Kanban / Rules | ✓ |
| Real AI draft for a campaign step (Gemini `gemini-3.8-flash`, local key from the hub) linked to lead, step and history | ✓ |
| Admin unit (incl. English coverage of the new page) · Admin typecheck: only the pre-existing `Yolias/lib/affiliates/program.ts` path error (also at HEAD) | ✓ |

## Round 2 (D-200 … D-207, 2026-10-13, local only)

| Check | Result |
| --- | --- |
| Yolias typecheck · lint · build · unit 75 (incl. Copy page Markdown, ICP without WhatsApp, LinkedIn company page from websites) | ✓ |
| `test:acquisition` (+ automations off, pack emails drawn after plan emails, unlimited contacts) · `test:plans-trial` (contacts unlimited) · `test:affiliates` (join approved at once, suspended gets no referral; `YOLIAS_TEST_APP_URL=http://localhost:3201`) · `test:search-types` · `test:agent` · `test:campaigns` · `test:status` | ✓ |
| Migration `20261112000000_round2.sql` re-applied from the previous schema in a rolled-back transaction | ✓ |
| Admin typecheck (0 errors) · unit 54 (nav test updated: widget under Support) · build · widget script syntax check | ✓ |
| Browser (AR, demo account): home header theme menu, docs Copy page + helpful vote, status, partners join / login / dashboard, Prospects + Search results + campaign summary, CRM, Inbox dropdowns + channel, AI Agent, redirects (/campaigns, /affiliate, /ai/rules, /ai/automations), checkout notes — no console errors | ✓ |
