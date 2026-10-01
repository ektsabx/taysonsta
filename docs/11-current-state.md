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
```

## Yolias (customer app)

| Area | Where | State |
| --- | --- | --- |
| Auth (magic link) | `app/(auth)`, `app/auth/confirm` | working |
| Workspaces, members, invitations | `supabase/migrations/20261001000000_yolias_init.sql` | working, RLS |
| Search composer, text + voice | `components/app/StrategyComposer.tsx`, `useSpeechToText.ts`, `app/api/transcribe`, `lib/stt.ts` | working; server STT needs `STT_API_KEY` |
| ICP parsing | `lib/ai/strategy.ts`, `lib/discovery/icp.ts` | working (Anthropic SDK, structured output) |
| Search pages | `app/(app)/search/[id]` (UI "Search", table `strategies`) | working |
| Discovery contracts | `lib/discovery/types.ts` | defined |
| Provider registry | `lib/discovery/registry.ts` | **empty**: campaigns stop at `awaiting_source` |
| Pipeline | `lib/discovery/pipeline.ts` | runs inline; no queue yet |
| Match scoring | `lib/discovery/match.ts` | deterministic code (correct per rules) |
| Campaigns / Prospects / Analytics pages | `app/(app)/*` | UI working on real (empty) data |
| Plans & billing | `lib/plans.ts`, `lib/billing.ts` | quotas are **constants**; payments in test mode only |
| Settings, usage, invoices, emails | `components/app/SettingsModal.tsx`, `app/invoices` | working |

## Yolias Admin

All BOS modules listed in `09-yolias-admin.md` §A exist and work, now with
the Yolias look. No platform modules (§B) yet. Runs on :3000.

## Known gaps vs the specs

| Gap | Spec | Where |
| --- | --- | --- |
| No `intel` schema, no shared intelligence | `04` | — |
| No provider live; registry is code, not config | `03` | `lib/discovery/registry.ts` |
| Quotas hardcoded | `06` D-005 | `lib/plans.ts` |
| No `usage_ledger`, no atomic reservation | `06` | — |
| No cost logging for LLM/STT calls | `06` | `lib/ai/strategy.ts`, `lib/stt.ts` |
| No queue/worker; pipeline inline | `05` | `lib/discovery/pipeline.ts` |
| Campaign states are the old set | `05` | init migration |
| `prospects` has no unique `(workspace_id, person_id)` | `04` | init migration |
| Plan copy promises "direct phone/WhatsApp" per prospect; spec says mobile optional, no WhatsApp verification claims | `00` | `lib/plans.ts` comment, pricing/marketing copy |
| `PersonCandidate.whatsapp` field | `00` | `lib/discovery/types.ts` |
| Admin cannot see Yolias data | `09` D-010 | — |
| Admin not on `admin.localhost:3200` | `02` D-011 | — |

## Pre-existing admin issues (not from Yolias work)

- Lint errors in `app/admin/finance/vendors`, `app/admin/products`, `app/admin/team/devices`.
- i18n unit test fails on untranslated import-page strings.

## Checks

- Yolias: `cd Yolias && npm run typecheck && npm run lint && npm run test:unit && npm run build`
- Admin: `npm run lint`, `npm test` at the root.
