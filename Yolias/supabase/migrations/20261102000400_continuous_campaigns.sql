-- Final spec phase 6: continuous campaigns.
-- A campaign has a goal (quota = how many results), an optional deadline and
-- a status. A continuous campaign keeps running on a schedule (daily or
-- weekly) until the goal is reached, the deadline passes, or a member pauses
-- or stops it. Every run is a campaign_runs row, and every result records
-- the run that delivered it (run lineage).

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check check (status in (
    'created', 'queued', 'awaiting_source', 'scheduled',
    'discovering_companies', 'matching_companies', 'discovering_people', 'enriching', 'verifying',
    'researching', 'scoring', 'delivering',
    'completed', 'partial', 'failed', 'paused'
  ));

alter table public.campaigns
  add column continuous boolean not null default false,
  add column run_every_hours int not null default 24 check (run_every_hours in (24, 168)),
  add column deadline timestamptz,
  add column next_run_at timestamptz,
  add column runs_count int not null default 0,
  add column stopped_at timestamptz;
create index campaigns_due_idx on public.campaigns (next_run_at) where status = 'scheduled';

-- Run lineage.
alter table public.prospects add column run_id bigint references public.campaign_runs(id) on delete set null;
alter table public.companies add column run_id bigint references public.campaign_runs(id) on delete set null;
alter table public.jobs add column run_id bigint references public.campaign_runs(id) on delete set null;
alter table public.campaign_runs add column delivered int not null default 0;

-- Prospects used per campaign this period and in total (customer-facing: prospects only, never money).
create or replace function public.campaign_usage(p_campaign uuid)
returns table (consumed int, reserved int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(prospects) filter (where kind = 'consume'), 0)::int,
    greatest(coalesce(sum(prospects) filter (where kind = 'reserve'), 0) - coalesce(sum(prospects) filter (where kind in ('consume', 'release')), 0), 0)::int
  from public.usage_ledger where campaign_id = p_campaign;
$$;
grant execute on function public.campaign_usage(uuid) to authenticated, service_role;
