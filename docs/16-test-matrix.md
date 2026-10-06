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
