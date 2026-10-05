# 11 — Current State

Snapshot of what exists in the code. Update with every change.
Last updated: 2026-10-01.

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
| Workspaces, members, invitations | `supabase/migrations/20261001000000_yolias_init.sql` | working, RLS |
| Search composer, text + voice | `components/app/StrategyComposer.tsx`, `useSpeechToText.ts`, `app/api/transcribe`, `lib/stt.ts` | working; server STT needs `STT_API_KEY` |
| ICP parsing | `lib/ai/strategy.ts`, `lib/discovery/icp.ts` | working (Anthropic SDK, structured output) |
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
| Email | `lib/email/send.ts`, `supabase/config.toml` `[auth.email.smtp]` | Taysonsta Resend account: sign-in via SMTP, receipts + plan-ending via API. Usage and discovery-ready emails wait for real usage/campaigns |

## Yolias Admin

All BOS modules listed in `09-yolias-admin.md` §A exist and work, with the
Yolias look. Platform modules (§B) started: Overview, Users, Workspaces,
Searches under `/admin/platform` (read-only), reading the Yolias database.
Runs at http://admin.localhost:3200.

## Known gaps vs the specs

| Gap | Spec | Where |
| --- | --- | --- |
| No provider live | `03` | phase 4 |
| No cost logging for STT calls (LLM is logged) | `06` | `lib/stt.ts` |
| Plan copy promises "direct phone/WhatsApp" per prospect; spec says mobile optional, no WhatsApp verification claims | `00` | `lib/plans.ts` comment, pricing/marketing copy |
| `PersonCandidate.whatsapp` field | `00` | `lib/discovery/types.ts` |
| Production worker trigger not configured (Cloudflare Cron → `/api/worker`) | `05` | at deploy |

## Pre-existing admin issues (not from Yolias work)

- Lint errors in `app/admin/finance/vendors`, `app/admin/products`, `app/admin/team/devices`.
- i18n unit test fails on untranslated import-page strings.

## Checks

- Yolias: `cd Yolias && npm run typecheck && npm run lint && npm run test:unit && npm run build`
- Agent tools against the local DB (no LLM key needed): `cd Yolias && npm run test:agent`
- Admin: `npm run lint`, `npm test` at the root.
