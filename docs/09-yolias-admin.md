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

Dashboard · AI Assistant · Products & Services · Sales (leads, deals,
activities, proposals, contracts, pipeline, deal radar) · Clients (accounts,
contacts, communications log) · Projects (tasks, time, milestones, files,
change requests, issues, approvals) · Finance (invoices, payments, revenue,
expenses, commissions, vendors, payroll) · Team / HR (employees, attendance,
schedules, leave, payroll, recruitment, performance, requests, documents,
devices & access, locations) · Communication (inbox, chat, WhatsApp & SMS,
meetings, notifications, calendar) · Marketing (social, content studio, ads)
· Knowledge · Support (inbox, tickets, AI agents) · Reports · Automation ·
Files & Documents (templates, e-signatures) · Careers & Booking (website
admin) · Imports · Settings (company, branches, users, roles, permissions,
pipeline, HR, notifications, dashboards, integrations hub, security, apps,
cameras, audit logs).

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
| Overview | `/admin/platform` | users, workspaces, paid plans live vs test, MRR live vs test, searches, prospects, plan mix, campaigns by status, newest users |
| Users | `/admin/platform/users` | every Yolias user, workspace, role, plan, language/country, sign-up, last sign-in |
| Workspaces | `/admin/platform/workspaces` | plan, members, searches, this month's prospect usage vs quota |
| Workspace | `/admin/platform/workspaces/[id]` | details, members, invitations, searches, campaigns, invoices & subscription events |
| Searches | `/admin/platform/searches` | every search, its understanding status and its campaign |

Permissions: `platform.*` (super admin and admin: all; executive: read).

## Local URL

`http://admin.localhost:3200` (`npm run local`, D-011).
