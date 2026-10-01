-- Pinned strategies (sidebar), billing period (monthly / annual) and
-- messages from the public Contact page.

alter table public.strategies add column pinned_at timestamptz;
create index strategies_pinned_idx on public.strategies(workspace_id, pinned_at desc) where pinned_at is not null;

alter table public.workspaces
  add column billing_period text not null default 'monthly' check (billing_period in ('monthly', 'annual'));
alter table public.subscription_events
  add column billing_period text not null default 'monthly' check (billing_period in ('monthly', 'annual'));

-- Written only by the server (service role) from the Contact form.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  topic text not null check (topic in ('sales', 'support', 'partnerships', 'press', 'other')),
  message text not null,
  locale text not null default 'en',
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
