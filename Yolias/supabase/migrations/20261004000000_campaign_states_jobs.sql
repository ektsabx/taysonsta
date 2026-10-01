-- Discovery runs in the background (docs/05-pipeline-and-workers.md):
-- campaign stages as states, a run log per job execution, and a Postgres job
-- queue (pgmq) that a worker drains. On Cloudflare the worker is a Cron
-- Trigger calling /api/worker (D-001, D-109); locally scripts/dev-worker.mjs.

-- ───────────────────────── Campaign states ─────────────────────────

alter table public.campaigns drop constraint if exists campaigns_status_check;
update public.campaigns set status = 'discovering_companies' where status = 'running';
alter table public.campaigns
  add constraint campaigns_status_check check (status in (
    'created', 'queued', 'awaiting_source',
    'discovering_companies', 'matching_companies', 'discovering_people', 'enriching', 'verifying',
    'researching', 'scoring', 'delivering',
    'completed', 'partial', 'failed', 'paused'
  ));
-- Why a campaign delivered fewer than asked (shown to the user).
alter table public.campaigns add column partial_reason text;

-- ───────────────────────── Run log ─────────────────────────

create table public.campaign_runs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  job text not null,
  attempt int not null default 1,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  meta jsonb not null default '{}'
);
create index campaign_runs_campaign_idx on public.campaign_runs (campaign_id, started_at desc);
create index campaign_runs_time_idx on public.campaign_runs (started_at desc);

alter table public.campaign_runs enable row level security;
create policy "members read runs" on public.campaign_runs for select using (public.is_workspace_member(workspace_id));
grant select on public.campaign_runs to authenticated;

-- ───────────────────────── Job queue (pgmq) ─────────────────────────

create extension if not exists pgmq;
select pgmq.create('yolias_jobs');

-- Jobs that failed every attempt (dead-letter queue), for the admin.
create table public.job_failures (
  id bigint generated always as identity primary key,
  msg_id bigint not null,
  kind text not null,
  payload jsonb not null,
  attempts int not null,
  error text,
  created_at timestamptz not null default now(),
  retried_at timestamptz
);
alter table public.job_failures enable row level security;  -- no policies: service role only

create or replace function public.jobs_enqueue(p_kind text, p_payload jsonb, p_delay int default 0)
returns bigint
language sql
security definer
set search_path = public, pgmq
as $$
  select * from pgmq.send('yolias_jobs', jsonb_build_object('kind', p_kind, 'payload', p_payload), greatest(p_delay, 0));
$$;

-- Takes up to p_n jobs; they stay invisible for p_vt seconds, then come back
-- unless acknowledged (that's the retry).
create or replace function public.jobs_read(p_n int, p_vt int)
returns table (msg_id bigint, read_ct int, enqueued_at timestamptz, kind text, payload jsonb)
language sql
security definer
set search_path = public, pgmq
as $$
  select r.msg_id, r.read_ct, r.enqueued_at, r.message->>'kind', r.message->'payload'
  from pgmq.read('yolias_jobs', p_vt, p_n) r;
$$;

create or replace function public.jobs_ack(p_msg_id bigint)
returns boolean
language sql
security definer
set search_path = public, pgmq
as $$
  select pgmq.delete('yolias_jobs', p_msg_id);
$$;

-- Exponential backoff: come back after p_delay seconds.
create or replace function public.jobs_retry_later(p_msg_id bigint, p_delay int)
returns void
language sql
security definer
set search_path = public, pgmq
as $$
  select null from pgmq.set_vt('yolias_jobs', p_msg_id, greatest(p_delay, 1));
$$;

create or replace function public.jobs_dead(p_msg_id bigint, p_kind text, p_payload jsonb, p_attempts int, p_error text)
returns void
language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  insert into public.job_failures (msg_id, kind, payload, attempts, error) values (p_msg_id, p_kind, p_payload, p_attempts, left(p_error, 2000));
  perform pgmq.archive('yolias_jobs', p_msg_id);
end $$;

create or replace function public.jobs_metrics()
returns table (queue_length bigint, oldest_age_sec int, total_messages bigint, dead int)
language sql
security definer
set search_path = public, pgmq
as $$
  select m.queue_length, m.oldest_msg_age_sec, m.total_messages,
         (select count(*) from public.job_failures where retried_at is null)::int
  from pgmq.metrics('yolias_jobs') m;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.jobs_enqueue(text, jsonb, int)', 'public.jobs_read(int, int)', 'public.jobs_ack(bigint)',
    'public.jobs_retry_later(bigint, int)', 'public.jobs_dead(bigint, text, jsonb, int, text)', 'public.jobs_metrics()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
