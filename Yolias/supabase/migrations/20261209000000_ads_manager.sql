-- Campaigns as an ads manager (owner, 2026-10-31, D-272). Additive only;
-- every existing campaign keeps its leads, messages and results.
--   Campaign → Audience groups → Sequence (steps) → Messages (variants).
--  1. A campaign gets an objective, an owner, a budget in money (total, daily
--     or monthly), a time zone, running days, contact hours and its channels
--     (from the channel registry; email only is available).
--  2. Audience groups: each with its own targeting (lib/campaigns/targeting.ts),
--     source, search and first-email angles. Every existing campaign gets one
--     group ("Main audience") holding all its leads.
--  3. Steps may belong to one group (null = the campaign's own sequence).
--  4. Audiences the member saves or builds (saved targeting, a custom list of
--     people, a lookalike of a seed), and saved table views.

alter table public.outreach_campaigns
  add column if not exists objective text not null default 'meetings'
    check (objective in ('leads', 'meetings', 'opportunities', 'new_customers', 'reactivate', 'promote', 'custom')),
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists budget_type text check (budget_type is null or budget_type in ('total', 'daily', 'monthly')),
  add column if not exists budget_usd numeric(12,2) check (budget_usd is null or budget_usd >= 0),
  add column if not exists timezone text check (timezone is null or length(timezone) <= 64),
  add column if not exists run_days text[] not null default '{sun,mon,tue,wed,thu,fri,sat}',
  add column if not exists contact_from time,
  add column if not exists contact_to time,
  add column if not exists channels text[] not null default '{email}',
  add column if not exists wizard jsonb;
update public.outreach_campaigns set owner_id = coalesce(owner_id, created_by);
update public.outreach_campaigns set objective = case when aim = 'sell' then 'promote' else 'meetings' end where objective = 'meetings' and aim = 'sell';

create table if not exists public.audience_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  source text not null default 'find_new' check (source in ('find_new', 'saved', 'lookalike', 'custom', 'imported', 'previous_campaign', 'customers')),
  targeting jsonb not null default '{}'::jsonb,
  audience_id uuid,
  strategy_id uuid references public.strategies(id) on delete set null,
  search_campaign_id uuid references public.campaigns(id) on delete set null,
  angle_a text check (angle_a is null or length(angle_a) <= 1000),
  angle_b text check (angle_b is null or length(angle_b) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audience_groups_campaign_idx on public.audience_groups (campaign_id);
create index if not exists audience_groups_search_idx on public.audience_groups (search_campaign_id) where search_campaign_id is not null;
alter table public.audience_groups enable row level security;
drop policy if exists "members read audience groups" on public.audience_groups;
create policy "members read audience groups" on public.audience_groups for select using (public.is_workspace_member(workspace_id));
drop policy if exists "members write audience groups" on public.audience_groups;
create policy "members write audience groups" on public.audience_groups for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
grant select, insert, update, delete on public.audience_groups to authenticated;

alter table public.outreach_enrollments add column if not exists audience_group_id uuid references public.audience_groups(id) on delete set null;
create index if not exists outreach_enrollments_group_idx on public.outreach_enrollments (audience_group_id) where audience_group_id is not null;
alter table public.outreach_steps add column if not exists audience_group_id uuid references public.audience_groups(id) on delete cascade;

-- Every existing campaign: one group with all its leads (its search, angles and targeting as they were).
insert into public.audience_groups (workspace_id, campaign_id, name, source, strategy_id, search_campaign_id, angle_a, angle_b, created_by, created_at)
select c.workspace_id, c.id, 'Main audience', case when c.source_campaign_id is null then 'imported' else 'find_new' end,
  c.strategy_id, c.source_campaign_id, left(c.goal, 1000), c.variant_b, c.created_by, c.created_at
from public.outreach_campaigns c
where not exists (select 1 from public.audience_groups g where g.campaign_id = c.id);
update public.outreach_enrollments e set audience_group_id = g.id
from public.audience_groups g where g.campaign_id = e.campaign_id and e.audience_group_id is null;

create table if not exists public.audiences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('saved', 'custom', 'lookalike')),
  name text not null check (length(trim(name)) between 1 and 120),
  targeting jsonb not null default '{}'::jsonb,
  -- custom: where the people came from; lookalike: the seed and what was learned from it.
  origin jsonb not null default '{}'::jsonb,
  members int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.audience_members (
  audience_id uuid not null references public.audiences(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (audience_id, lead_id)
);
alter table public.audiences enable row level security;
alter table public.audience_members enable row level security;
drop policy if exists "members use audiences" on public.audiences;
create policy "members use audiences" on public.audiences for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members use audience members" on public.audience_members;
create policy "members use audience members" on public.audience_members for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
grant select, insert, update, delete on public.audiences, public.audience_members to authenticated;
alter table public.audience_groups drop constraint if exists audience_groups_audience_fk;
alter table public.audience_groups add constraint audience_groups_audience_fk foreign key (audience_id) references public.audiences(id) on delete set null;

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null default 'campaigns' check (scope in ('campaigns')),
  name text not null check (length(trim(name)) between 1 and 80),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists saved_views_user_idx on public.saved_views (user_id, scope);
alter table public.saved_views enable row level security;
drop policy if exists "own saved views" on public.saved_views;
create policy "own saved views" on public.saved_views for all using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
grant select, insert, update, delete on public.saved_views to authenticated;

-- Running days restrict sending only when the member sets them: every existing campaign runs every day, as before.
alter table public.outreach_campaigns alter column run_days set default '{sun,mon,tue,wed,thu,fri,sat}';
update public.outreach_campaigns set run_days = '{sun,mon,tue,wed,thu,fri,sat}' where wizard is null and contact_from is null and contact_to is null;
