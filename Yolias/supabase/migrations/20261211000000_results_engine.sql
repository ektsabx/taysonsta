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
