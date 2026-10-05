# 09 — Yolias Admin

Yolias Admin = **Company Control Center** + **Platform Control Center** +
**Intelligence Operations Center**.

It is the former **Taysonsta BOS / Taysonsta Pages**, already restyled with
the Yolias design system and renamed (`app/admin/yolias.css`,
`app/admin/layout.tsx`, `components/admin/AdminSidebar.tsx`). That codebase
is the **foundation**: keep every module, add the platform modules beside them.

## Design

Same design language as Yolias (tokens, fonts DM Sans / Source Serif 4 /
Noto Kufi Arabic, light/dark, AR/EN RTL). Admin-specific information
architecture: dense tables, filters, detail pages. Not a copy of the customer UI.

## A. Company modules (existing; keep all)

From `lib/bos/nav.ts`:

Dashboard · AI Assistant · Sales (leads, deals, activities, proposals,
contracts, pipeline, deal radar) · Clients (accounts, contacts,
communications log, onboarding, upsell) · Finance (invoices, payments,
revenue, expenses, commissions, vendors, payroll) · Team / HR (employees,
attendance, schedules, leave, payroll, recruitment, performance, requests,
documents, devices & assets, locations) · Communication (inbox, chat,
meetings, notifications, calendar) · Marketing (content studio, ads) ·
Knowledge · Support (inbox, tickets, AI agents) · Reports · Files &
Documents (templates, e-signatures) · Careers & Booking (website admin) ·
Imports · Settings (company, users, roles, permissions, pipeline, HR,
notifications, dashboards, integrations hub, security, audit logs).

Removed by the final product spec (D-119), not to be re-added: Products &
Services, Projects (tasks, time, milestones, change requests, issues),
WhatsApp & SMS, social accounts, automation, branches, IT & external apps,
cameras, client portal, multiple currencies (D-120), colour/font/theme
customization.

Don't remove or break any of these while adding platform modules.

## B. Platform modules (new)

New sidebar group(s), e.g. **"Yolias Platform"** and **"Intelligence"**,
gated by new permission keys (`platform.*`, `intel.*`).

| Group | Module | Shows / does |
| --- | --- | --- |
| Customers | Users | Yolias users, sign-ups, last active, suspend, impersonation (audited, later) |
| | Workspaces | plan, members, usage, campaigns, invoices, status |
| | Plans | plan definitions, prices |
| | Prospect Quotas | configurable quotas per plan and per-workspace overrides/grants |
| Data | Prospects · Companies · People | shared intel + workspace prospects, with provenance |
| | Campaigns · Searches | all discovery jobs, state, stage timings, cost, partial reasons |
| Intelligence | Intelligence Layer | routing ladder config, capability map |
| | Providers | enable/disable, priority, fallback, credentials (Vault), limits, budgets, license fields |
| | Provider usage · costs · performance | calls, cost, success, latency, coverage, errors |
| | Enrichment · Verification | rates, outcomes, cost |
| | LLM usage & costs | per task/model: tokens, cache hits, cost |
| | Data sources · Provenance · Freshness | source mix, stale data, TTL refresh |
| | Licensing controls | per provider and per field scope |
| Operations | Queue / Workers · Jobs · Failed jobs · Retries | pgmq depth, worker health, DLQ, retry |
| | Usage ledger | reservations, consumption, adjustments |
| | Platform health | DB, queue, providers, error rates |
| Business | Analytics | metrics below |
| | Revenue · Platform costs · Cost per prospect | margins per plan/workspace |
| Control | Permissions · Audit logs · System settings | reuse BOS RBAC and audit |

## Admin analytics (real data only)

Total users, active users, workspaces, paying workspaces, MRR/ARR, plan mix,
churn, searches, campaigns (by state), prospects delivered, quota
utilisation, provider calls, provider cost, LLM cost, cost per prospect,
gross margin, cache hit rate, shared-intel reuse rate, verification rate,
average match score, campaign success / partial / failure rate, queue
latency, provider success/latency, provider coverage.

Any metric without a data source is hidden or labelled "not connected".

## Access to Yolias data

The admin and Yolias use different Supabase projects. Admin server code
reads the Yolias database through `lib/yolias/db.ts` (server-only), guarded
by the `platform.*` permissions (D-010). Read models live in
`services/yolias/platform.ts`; aggregates come from the Yolias SQL function
`admin_workspace_stats` (service role only). Writes (later phases) must be
audited.

## Built so far

| Page | Path | Shows |
| --- | --- | --- |
| Overview | `/admin/platform` | last-30-day metrics from SQL (`admin_platform_metrics`: active users/workspaces, campaign success, verified rate, avg match, data reuse, ICP cache rate, provider errors/latency, cancellations), users, workspaces, paid plans live vs test, MRR live vs test, searches, prospects, plan mix, campaigns by status, newest users |
| Users | `/admin/platform/users` | every Yolias user, workspace, role, plan, language/country, sign-up, last sign-in |
| Workspaces | `/admin/platform/workspaces` | plan, members, searches, this month's prospect usage vs quota |
| Workspace | `/admin/platform/workspaces/[id]` | usage (quota, grants, used, reserved, available), ledger, grant/adjust form, details, members, invitations, searches, campaigns, invoices & subscription events |
| Searches | `/admin/platform/searches` | every search, its understanding status and its campaign |
| Providers | `/admin/platform/providers` | provider registry (status, capabilities, priority, credential hint, health), capability map, Intelligence Layer settings (routing ladder, TTLs, circuit breaker, LLM prices) |
| Provider | `/admin/platform/providers/[id]` | edit enable/priority/limits/budgets/fallback/pricing/license, set or delete the Vault credential, latest calls |
| Plans & quotas | `/admin/platform/plans` | prospects per plan (edit, audited); prices shown |
| Jobs & queue | `/admin/platform/jobs` | queue length, oldest job, failed jobs (retry), latest runs |
| Yolias AI | `/admin/platform/agent` | last 30 days: conversations, messages, tool calls by tool and outcome (denied, not connected…), agent LLM cost, audit log of the latest 50 tool calls. Counts only, no conversation text |
| Users (suspend) | `/admin/platform/users` | status column; suspend (with a reason) / restore — Supabase Auth ban, audited, the user gets a security email |
| Companies & people | `/admin/platform/data/companies` (+`[id]`) | shared companies with freshness against the TTL and license; per company every field's source, license, confidence, fetch and expiry time; people with contacts and verification |
| Emails | `/admin/platform/emails` | send log by category and status; product update announcements (draft → send) |
| Profitability | `/admin/platform/profitability` | this month: live revenue vs platform cost per plan and workspace, cost per delivered prospect; test revenue shown apart |
| Platform health | `/admin/platform/health` | database latency, worker heartbeat, queue, failed jobs/runs, LLM error rate and emails in 24 h, configured services (yes/no from the worker), provider circuit breakers |
| Costs | `/admin/platform/costs` | LLM and provider cost this month, cost per prospect, by task/provider, latest LLM calls |

Permissions: `platform.*` (super admin and admin: all; executive: read).

## Local URL

`http://admin.localhost:3200` (`npm run local`, D-011).
