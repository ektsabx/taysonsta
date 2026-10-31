-- Campaign-centred Yolias (owner, 2026-10-31, D-270). Additive only: every
-- existing campaign, meeting and lead keeps its rows and meaning.
--  1. A campaign has a target, a schedule, a daily limit and a budget, and
--     three more states: scheduled (approved, waits for its start date),
--     completed (ended by the member or by its end date) and failed (a real
--     reason, kept in failure_reason).
--  2. A meeting belongs to the campaign that led to it, and after it the
--     member says whether it was qualified.
--  3. Shared learning: rates aggregated across workspaces, only for groups
--     with enough workspaces and contacts. No text, names or addresses.

alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_status_check;
alter table public.outreach_campaigns add constraint outreach_campaigns_status_check
  check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'failed', 'archived'));

alter table public.outreach_campaigns
  add column if not exists target_meetings int check (target_meetings is null or target_meetings between 1 and 1000),
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists daily_limit int check (daily_limit is null or daily_limit between 1 and 500),
  add column if not exists budget_prospects int check (budget_prospects is null or budget_prospects between 1 and 100000),
  add column if not exists ended_at timestamptz,
  add column if not exists failure_reason text check (failure_reason is null or length(failure_reason) <= 300);
alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_schedule_check;
alter table public.outreach_campaigns add constraint outreach_campaigns_schedule_check
  check (ends_at is null or starts_at is null or ends_at > starts_at);

create index if not exists outreach_campaigns_schedule_idx on public.outreach_campaigns (status, starts_at, ends_at)
  where status in ('scheduled', 'active');

alter table public.sales_meetings
  add column if not exists campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  add column if not exists qualified boolean;
create index if not exists sales_meetings_campaign_idx on public.sales_meetings (campaign_id) where campaign_id is not null;
grant update (qualified) on public.sales_meetings to authenticated;

-- Existing meetings: the campaign the lead was last enrolled in before the meeting was made.
update public.sales_meetings m set campaign_id = (
  select e.campaign_id from public.outreach_enrollments e
  where e.lead_id = m.lead_id and e.created_at <= m.created_at
  order by e.created_at desc limit 1
)
where m.campaign_id is null;

create table if not exists public.learning_rates (
  -- One group: an industry, a country and the campaign's aim ('*' = any).
  industry text not null,
  country text not null,
  aim text not null,
  workspaces int not null,
  contacted int not null,
  positive int not null,
  meetings int not null,
  qualified int not null,
  updated_at timestamptz not null default now(),
  primary key (industry, country, aim)
);
alter table public.learning_rates enable row level security;
-- Read by the server only (service role); members never read other workspaces' numbers directly.
revoke all on public.learning_rates from anon, authenticated;

-- Rebuilds learning_rates from the last 180 days. A group is kept only with at
-- least 5 workspaces and 200 contacted leads, so no single workspace shows through.
create or replace function public.refresh_learning_rates() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.learning_rates where true;
  with touched as (
    select distinct m.workspace_id, m.lead_id, m.outreach_campaign_id as campaign_id
    from public.outreach_messages m
    where m.direction = 'outbound' and m.status = 'sent' and m.sent_at >= now() - interval '180 days'
      and m.lead_id is not null and m.outreach_campaign_id is not null
  ), facts as (
    select t.workspace_id, t.lead_id,
      coalesce(lower(nullif(co.industry, '')), '*') as industry,
      coalesce(lower(nullif(co.country, '')), '*') as country,
      c.aim,
      exists (select 1 from public.outreach_messages r where r.lead_id = t.lead_id and r.direction = 'inbound'
              and (r.analysis->>'kind') in ('interested', 'meeting_request')) as positive,
      exists (select 1 from public.sales_meetings s where s.lead_id = t.lead_id) as met,
      exists (select 1 from public.sales_meetings s where s.lead_id = t.lead_id and s.qualified) as qualified
    from touched t
    join public.outreach_campaigns c on c.id = t.campaign_id
    join public.sales_leads l on l.id = t.lead_id
    left join public.companies co on co.id = l.company_id
  ), groups as (
    select industry, country, aim from facts
    union select '*', country, aim from facts
    union select industry, '*', aim from facts
    union select '*', '*', aim from facts
  )
  insert into public.learning_rates (industry, country, aim, workspaces, contacted, positive, meetings, qualified)
  select g.industry, g.country, g.aim,
    count(distinct f.workspace_id), count(*), count(*) filter (where f.positive), count(*) filter (where f.met), count(*) filter (where f.qualified)
  from groups g
  join facts f on f.aim = g.aim and (g.industry = '*' or f.industry = g.industry) and (g.country = '*' or f.country = g.country)
  group by g.industry, g.country, g.aim
  having count(distinct f.workspace_id) >= 5 and count(*) >= 200;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.refresh_learning_rates() from public, anon, authenticated;

-- What Yolias did in a campaign and why (D-270): started, paused for bounces,
-- ended on its date, changed the angle… Written by the server; members read it.
create table if not exists public.campaign_activity (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  kind text not null check (kind in ('started', 'scheduled', 'paused', 'resumed', 'completed', 'failed', 'guard', 'enrolled', 'angle', 'pace', 'note')),
  body text not null check (length(body) <= 600),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists campaign_activity_campaign_idx on public.campaign_activity (campaign_id, created_at desc);
create index if not exists campaign_activity_ws_idx on public.campaign_activity (workspace_id, created_at desc);
alter table public.campaign_activity enable row level security;
drop policy if exists "members read campaign activity" on public.campaign_activity;
create policy "members read campaign activity" on public.campaign_activity for select using (public.is_workspace_member(workspace_id));
grant select on public.campaign_activity to authenticated;
