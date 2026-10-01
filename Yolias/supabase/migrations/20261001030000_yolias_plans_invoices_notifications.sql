-- Plans are now Free / Pro / Growth (Scale removed), billed on prospects only.
-- Adds invoices, cancel-at-period-end and notification preferences.

update public.workspaces set plan = 'growth' where plan = 'scale';
alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces
  add constraint workspaces_plan_check check (plan in ('free', 'pro', 'growth'));

update public.subscription_events set plan = 'growth' where plan = 'scale';
alter table public.subscription_events drop constraint if exists subscription_events_plan_check;
alter table public.subscription_events
  add constraint subscription_events_plan_check check (plan in ('free', 'pro', 'growth'));
alter table public.subscription_events drop constraint if exists subscription_events_status_check;
alter table public.subscription_events
  add constraint subscription_events_status_check check (status in ('activated', 'changed', 'canceled', 'resumed', 'ended'));

-- Canceling keeps the plan until the end of the paid period, then the
-- workspace moves to Free.
alter table public.workspaces add column cancel_at_period_end boolean not null default false;

-- Invoices: one per paid charge (test-mode charges are marked mode = 'test').
create sequence public.invoice_number_seq start 1001;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number text not null unique default ('YL-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  plan text not null check (plan in ('pro', 'growth')),
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  amount_usd numeric not null,
  status text not null default 'paid' check (status in ('paid', 'open', 'void')),
  mode text not null check (mode in ('test', 'live')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  bill_to_name text,
  bill_to_email text not null,
  bill_to_company text,
  created_at timestamptz not null default now()
);
create index invoices_workspace_idx on public.invoices(workspace_id, created_at desc);

alter table public.invoices enable row level security;
-- Billing is visible to the workspace owner and admins.
create policy "admins read invoices" on public.invoices for select using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = invoices.workspace_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  )
);

-- Email notification preferences (Settings → Notifications).
alter table public.profiles
  add column notify_usage boolean not null default true,
  add column notify_billing boolean not null default true,
  add column notify_product boolean not null default false;
