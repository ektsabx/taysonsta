# 13 — Audit of both codebases (Phase 0)

Date: 2026-10-01. Scope: Yolias (`Yolias/`) and Yolias Admin (repo root,
former Taysonsta BOS). Goal: what to reuse, where the databases overlap, how
auth differs, and what the provider work can build on.

## 1. Shape

| | Yolias | Yolias Admin |
| --- | --- | --- |
| Framework | Next.js 16.3.4, React 19, Tailwind v4, zod v4 | same |
| Data | own Supabase project (12 tables, RLS by workspace) | own Supabase project (~250 tables, RBAC) |
| Auth | Supabase magic link, workspaces + members | Supabase email/password, roles × permissions × scopes |
| Language | dictionaries `en.ts` / `ar.ts` keyed by key | Arabic source text, `lib/bos/i18n/en.ts` keyed by the Arabic |
| Deploy | not configured yet | OpenNext → Cloudflare Workers (`wrangler.jsonc`, `taysonsta.net`) |
| Tests | `tsc`, lint, 5 unit tests | `tsc`, lint, 77 unit tests, DB + integration suites |

## 2. Reusable from the Admin (Taysonsta) for the Intelligence Layer

These already exist in the Admin and solve problems the specs ask for. Port
the **pattern** into `Yolias/lib/intel` (the apps don't share code); don't
re-invent it.

| Admin piece | Where | Reuse for |
| --- | --- | --- |
| Integration Hub: connections with AES-256-GCM encrypted credentials, default per provider, test button, 4-char hints | `services/bos/integrations.ts`, `lib/bos/secrets.ts`, `integration_connections` | provider credentials (until Vault), admin "Providers" page UX |
| `providerFetch`: timeout, retry with backoff on 429/5xx, `Retry-After`, redacted logging | `services/bos/integrations.ts` | the adapter HTTP layer (`03` failure rules) |
| `integration_logs`: every call with status, duration, attempts, error | migration `20261003000000` | basis of `intel.provider_calls` (add cost, workspace, campaign, records) |
| `ai_usage_log` + unified AI client with provider order, fallback, monthly budget, cost in micros | `services/bos/ai.ts` | LLM cost logging and budget guard (`06`, `07`) |
| Provider catalogue with declared `capabilities` and fields | `lib/bos/integrations/catalog.ts` | shape of the provider registry (`03`) |
| Audit log (immutable) | `lib/bos/audit.ts`, `audit_logs` | admin writes on Yolias data |
| RBAC: permission keys `<module>.<action>` with scopes, page restrictions | `lib/bos/permissions.ts`, `lib/bos/auth.ts` | the new `platform.*` permissions (added) |
| Import engine, exporters, automation runs | `services/bos/import-engine.ts`, `exporters.ts`, `automation.ts` | later: admin exports, scheduled jobs |
| Resend sending through the hub | `lib/bos/integrations/email.ts` | Yolias uses the same Resend account (D-111) |

## 3. Reusable inside Yolias

- `lib/discovery/types.ts` contracts and `match.ts` deterministic scoring: keep; they become capability adapters (phase 1).
- `lib/ai/strategy.ts` ICP parsing with structured output: keep; add fingerprint + cache + cost logging.
- `services/*.ts` read models for campaigns, prospects, analytics: keep.

## 4. Database overlap

The two Supabase projects are separate. If they were ever merged into one
project, these names collide:

| Table | Yolias meaning | Admin meaning |
| --- | --- | --- |
| `invoices` | Yolias subscription invoices | Taysonsta client invoices |

No other table names collide (`profiles`, `workspaces`, `strategies`,
`campaigns`, `companies`, `prospects` exist only in Yolias). Both use
`auth.users`, but they are different user populations (Taysonsta staff vs
Yolias customers), so one auth pool would mix them.

**Conclusion:** keep two projects (both in the Taysonsta Supabase account).
The Admin reads Yolias through a server-only client (D-010, done).

## 5. Auth

- Yolias customers never get Admin access; Admin users never sign in to Yolias with their staff account.
- Admin → Yolias data: service key on the server, behind `platform.read` / `platform.manage`, writes audited.
- Cookies are host-only, so `localhost:3200` (Yolias) and `admin.localhost:3200` (Admin) keep separate sessions locally, like separate domains in production.

## 6. Risks found

| Risk | Note |
| --- | --- |
| Plan copy promises "direct phone/WhatsApp" per prospect | conflicts with D-105; fix copy (D-012) |
| Quotas duplicated in `Yolias/lib/plans.ts` and `lib/yolias/plans.ts` | move to the DB in phase 9 |
| Admin i18n test fails on untranslated import-page strings | pre-existing |
| Admin lint errors in finance/vendors, products, team/devices | pre-existing |
| Yolias deploy target not configured | Cloudflare (D-001); add OpenNext config when deploying |

## 7. What changed in Phase 0b

- `npm run local` at the root runs everything: Yolias on http://localhost:3200, Admin on http://admin.localhost:3200 (`scripts/dev-all.sh`, `scripts/dev-proxy.mjs`).
- Admin → Yolias connection: `lib/yolias/db.ts`, `services/yolias/platform.ts`, pages under `/admin/platform` (overview, users, workspaces + detail, searches), permission module `platform`.
- Yolias email through the Taysonsta Resend account: sign-in emails via Resend SMTP (local Supabase config), receipts and plan-ending emails via the Resend API (`Yolias/lib/email/send.ts`).
