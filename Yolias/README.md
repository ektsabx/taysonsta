# Yolias

**Tell Yolias who you want to sell to.** Autonomous customer discovery: the user describes their ideal company size, market or industry, and Yolias finds verified decision makers.

Yolias is a standalone SaaS app. It lives in this repository next to Taysonsta BOS but shares no code, routes, database or deployment with it.

## Stack

Same stack and conventions as Taysonsta BOS: Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript (strict), Tailwind CSS v4, Supabase (`@supabase/ssr`), zod, and server actions. Yolias AI uses the Anthropic SDK.

## Run locally

```bash
cd Yolias
npm install
npm run local                   # starts Yolias's local Supabase, writes .env.local, runs the app on :3200
```

`npm run local` (scripts/dev-local.sh) uses Yolias's own local Supabase on ports 5463x (BOS uses 5442x). On Colima it restarts Colima with the ssh port forwarder if the database port isn't exposed in time. Magic-link emails are captured by Inbucket at http://127.0.0.1:54634.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yolias's own Supabase project (never the BOS one) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: team invitations, workspace writes, account deletion |
| `NEXT_PUBLIC_SITE_URL` | Public URL used in magic-link redirects |
| `ANTHROPIC_API_KEY` | Yolias AI (strategy understanding) |

Checks: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`.

## Authentication

Supabase Auth with a **magic link only**: no passwords and no numeric codes.

- `/login`: sends a link to existing accounts only.
- `/signup`: creates the account and sends the link.
- `/recover`: sends a fresh link when the old one expired or was already used.
- `/auth/confirm`: verifies the link. It accepts both `token_hash` (Yolias email templates in `supabase/templates`, works across devices) and the PKCE `code` format.

For a hosted Supabase project, set the **Site URL**, add `<site>/auth/confirm` to the redirect URLs, and paste the templates from `supabase/templates/` into Auth → Email Templates.

After the first sign-in, `/onboarding` collects the user's name, company name, website and what they sell. These become permanent context for Yolias AI. The ICP is not asked here; it is defined per strategy.

## Product structure

| Area | Route | Notes |
| --- | --- | --- |
| Yolias AI | `/`, `/strategies/[id]` | Prompt with voice, screenshot and file input. Creates a strategy, then a campaign. |
| Analytics | `/analytics` | Discovery metrics for the last 7, 30 or 90 days |
| Campaigns | `/campaigns` | Search / discovery missions (not outreach) |
| Prospects | `/prospects` | Saved discoveries, with filters and CSV export |
| Recent Strategy | sidebar | History of strategies |
| Pricing | `/pricing` (public) | Plans Pro $20 / Growth $50 / Scale $100, EN + AR. Picking a plan → signup → onboarding → checkout |
| Checkout | `/checkout?plan=…` | No payment provider yet: plans activate only with `BILLING_TEST_MODE=true` (local), recorded as test subscriptions |
| Settings | user menu → modal | General, Account, Usage, Team (working). Billing and Integration are marked "Coming soon". |

Out of scope by design (for now): CRM, inbox, meetings, contacts, deals, pipeline, sequences, outreach, support and marketing automation.

## Discovery architecture

```
User request ─▶ Yolias AI (lib/ai/strategy.ts) ─▶ ICP (lib/discovery/icp.ts)
            ─▶ Campaign ─▶ pipeline (lib/discovery/pipeline.ts)
                 companies ▸ decision makers ▸ enrich ▸ verify ▸ qualify (match.ts) ▸ prospects
```

- **Provider contracts** live in `lib/discovery/types.ts`: `CompanySource`, `PeopleSource`, `Enricher` and `EmailVerifier`.
- **Registry**: `lib/discovery/registry.ts` is intentionally empty in this phase. Campaigns stop at `awaiting_source` after the AI has understood the strategy.
- **Adding a data provider later**:
  1. Implement the interface in `lib/discovery/providers/<name>.ts`.
  2. Register it in `registry.ts`.

  No schema or UI changes are needed. Every company and prospect row records `source` and `source_ref`.
- **Activity**: every pipeline step is written to `campaign_events`, which feeds the AI activity / progress shown in the UI.

## Database

`supabase/migrations/` contains the full schema:

- workspaces and members/invitations
- profiles
- strategies, campaigns and campaign events
- companies and prospects
- the `avatars` storage bucket

Every table uses row-level security scoped to workspace membership. A trigger creates each new user's profile and workspace, or adds them to the inviting workspace.
