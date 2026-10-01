-- Pricing plans (Pro / Growth / Scale) and subscription state.
-- Payments are not connected yet: a subscription can only be activated in
-- billing test mode (BILLING_TEST_MODE=true), recorded with mode = 'test'.

alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces
  add constraint workspaces_plan_check check (plan in ('free', 'pro', 'growth', 'scale'));

alter table public.workspaces
  add column subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'test', 'canceled', 'past_due')),
  add column current_period_end timestamptz;

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan text not null check (plan in ('pro', 'growth', 'scale')),
  status text not null check (status in ('activated', 'changed', 'canceled')),
  amount_usd numeric not null,
  mode text not null check (mode in ('test', 'live')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index subscription_events_workspace_idx on public.subscription_events(workspace_id, created_at desc);

alter table public.subscription_events enable row level security;
create policy "members read subscription events" on public.subscription_events
  for select using (public.is_workspace_member(workspace_id));
