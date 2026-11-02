-- Results engine (owner, 2026-11-02, D-274): Yolias optimizes for meetings
-- that took place, like an ads platform optimizes for its result.
--   * Guest reminders (a day and an hour before) and a prepared brief.
--   * Each audience gets a share of the campaign's budget from its results
--     (the optimizer), with a learning flag; a campaign may set a cost cap
--     per meeting.
--   * Recipient opens (a tracking image, when the campaign allows it), apart
--     from opened_at / opened_via, which record the MEMBER opening an email in
--     their own app (D-260).
--   * Booking link visits: who opened the link, who started the form and
--     didn't book (like an abandoned checkout), who booked.

-- Meetings: guest reminders and the brief.
alter table public.sales_meetings
  add column if not exists guest_reminded_day_at timestamptz,
  add column if not exists guest_reminded_hour_at timestamptz,
  add column if not exists brief text,
  add column if not exists brief_at timestamptz;

-- Audiences of a campaign: the optimizer's budget share and state.
alter table public.audience_groups
  add column if not exists budget_share numeric check (budget_share is null or (budget_share >= 0 and budget_share <= 1)),
  add column if not exists learning boolean not null default true,
  add column if not exists opt_state jsonb not null default '{}'::jsonb;

-- Campaigns: cost cap per meeting (USD) and recipient open tracking.
alter table public.outreach_campaigns
  add column if not exists cost_cap_usd numeric check (cost_cap_usd is null or cost_cap_usd > 0),
  add column if not exists track_opens boolean not null default true;

-- Messages: the recipient opened it (first time) and how many times.
alter table public.outreach_messages
  add column if not exists recipient_opened_at timestamptz,
  add column if not exists open_count integer not null default 0;

-- The optimizer writes its moves to the campaign's log.
alter table public.campaign_activity drop constraint if exists campaign_activity_kind_check;
alter table public.campaign_activity add constraint campaign_activity_kind_check check (kind in ('started', 'scheduled', 'paused', 'resumed', 'completed', 'failed', 'guard', 'enrolled', 'angle', 'pace', 'note', 'found', 'replied', 'meeting', 'handoff', 'learned', 'optimized'));

-- Booking link visits. Written by the server only (service role); members read their workspace's.
create table if not exists public.booking_visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  visitor text not null check (char_length(visitor) between 8 and 64),
  lead_id uuid references public.sales_leads(id) on delete set null,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  started_at timestamptz,
  name text check (name is null or char_length(name) <= 120),
  email text check (email is null or char_length(email) <= 254),
  meeting_id uuid references public.sales_meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_visits_ws_idx on public.booking_visits (workspace_id, created_at desc);
create index if not exists booking_visits_visitor_idx on public.booking_visits (slug, visitor, created_at desc);
create index if not exists booking_visits_campaign_idx on public.booking_visits (campaign_id) where campaign_id is not null;
alter table public.booking_visits enable row level security;
drop policy if exists booking_visits_read on public.booking_visits;
create policy booking_visits_read on public.booking_visits for select using (public.is_workspace_member(workspace_id));

-- Account spending limit (owner, 2026-11-02, D-274), like an ads account's:
-- the most the account spends from a start date (set or reset by an owner or
-- admin); searches stop when it's reached. Server-written.
alter table public.workspaces
  add column if not exists spending_limit_usd numeric check (spending_limit_usd is null or spending_limit_usd > 0),
  add column if not exists spending_limit_since timestamptz;

-- Campaign: who it contacts (companies, people or both), the objective's
-- second option (qualified leads) and the message level's own name.
alter table public.outreach_campaigns
  add column if not exists contact_target text not null default 'people' check (contact_target in ('people', 'companies', 'both')),
  add column if not exists message_name text check (message_name is null or char_length(message_name) <= 160);
alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_objective_check;
-- Objectives like an ads platform's (owner, 2026-11-02): meetings, website
-- purchases, website form leads (both measured by the Yolias pixel), and
-- qualified leads (found and saved in Leads, not contacted).
alter table public.outreach_campaigns add constraint outreach_campaigns_objective_check check (objective in ('leads', 'qualified_leads', 'meetings', 'purchases', 'form_leads', 'opportunities', 'new_customers', 'reactivate', 'promote', 'custom'));
alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_aim_check;
alter table public.outreach_campaigns add constraint outreach_campaigns_aim_check check (aim in ('meeting', 'sell', 'form'));

-- The Yolias pixel and Events Manager (owner, 2026-11-02, D-274), like
-- Facebook's: pixels (several per workspace) installed on the member's websites;
-- events (PageView, InitiateCheckout, Purchase, Lead and custom ones) come in
-- through /api/px and are credited to a campaign when the visitor came from a
-- Yolias link (?yc=<lead>). Written by the server only; members read theirs.
create table if not exists public.pixels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  public_id text not null unique check (public_id ~ '^[0-9a-f]{16}$'),
  name text not null default 'Yolias pixel' check (char_length(name) between 1 and 80),
  allowed_domains text[] not null default '{}',
  blocked_domains text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  last_event_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.pixels enable row level security;
drop policy if exists pixels_read on public.pixels;
create policy pixels_read on public.pixels for select using (public.is_workspace_member(workspace_id));

create table if not exists public.pixel_events (
  id bigserial primary key,
  pixel_id uuid not null references public.pixels(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event text not null check (event ~ '^[A-Za-z][A-Za-z0-9_]{0,39}$'),
  value numeric check (value is null or (value >= 0 and value <= 1000000000)),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  url text check (url is null or char_length(url) <= 1000),
  referrer text check (referrer is null or char_length(referrer) <= 1000),
  visitor text check (visitor is null or char_length(visitor) <= 64),
  event_id text check (event_id is null or char_length(event_id) <= 100),
  lead_id uuid references public.sales_leads(id) on delete set null,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  group_id uuid references public.audience_groups(id) on delete set null,
  -- How it was credited: after a click on a Yolias link, or after an email (matched by the hashed email, like advanced matching).
  attribution text check (attribution is null or attribution in ('click', 'view')),
  -- Events sent while testing (Test events) carry the test code and are kept out of results.
  test_code text check (test_code is null or test_code ~ '^[A-Z0-9]{4,12}$'),
  created_at timestamptz not null default now()
);
create index if not exists pixels_ws_idx on public.pixels (workspace_id);
create unique index if not exists pixel_events_dedupe on public.pixel_events (pixel_id, event_id) where event_id is not null;
create index if not exists pixel_events_ws_idx on public.pixel_events (workspace_id, created_at desc);
create index if not exists pixel_events_campaign_idx on public.pixel_events (campaign_id, created_at desc) where campaign_id is not null;
alter table public.pixel_events enable row level security;
drop policy if exists pixel_events_read on public.pixel_events;
create policy pixel_events_read on public.pixel_events for select using (public.is_workspace_member(workspace_id));

-- Custom metrics (like an ads manager's): a name and a formula of two metrics.
create table if not exists public.custom_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  a text not null check (char_length(a) <= 40),
  op text not null check (op in ('+', '-', '*', '/')),
  b text not null check (char_length(b) <= 40),
  format text not null default 'count' check (format in ('count', 'pct', 'usd', 'ratio')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists custom_metrics_ws_idx on public.custom_metrics (workspace_id);
alter table public.custom_metrics enable row level security;
drop policy if exists custom_metrics_read on public.custom_metrics;
create policy custom_metrics_read on public.custom_metrics for select using (public.is_workspace_member(workspace_id));

-- A website objective's pixel, its conversion event and its attribution window (days after the click or the email), like an ads platform's.
alter table public.outreach_campaigns
  add column if not exists pixel_id uuid references public.pixels(id) on delete set null,
  add column if not exists conversion_event text check (conversion_event is null or conversion_event ~ '^[A-Za-z][A-Za-z0-9_]{0,39}$'),
  add column if not exists attribution_days integer not null default 7 check (attribution_days in (1, 7, 28));
