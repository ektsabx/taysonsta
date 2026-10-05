-- Email system (docs/05, rule 18): every product email is a logged, idempotent
-- job. A row is written once per dedupe key (e.g. "usage_low:<ws>:<month>:<user>"),
-- then the worker sends it through Resend and records the outcome.
-- Service role only.

create table public.email_log (
  id bigint generated always as identity primary key,
  kind text not null,
  category text not null check (category in ('account', 'subscription', 'billing', 'usage', 'updates', 'security')),
  to_email text not null,
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  data jsonb not null default '{}',
  dedupe_key text unique,
  status text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  provider_id text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_log_time_idx on public.email_log (created_at desc);
create index email_log_ws_idx on public.email_log (workspace_id, created_at desc);
alter table public.email_log enable row level security;  -- no policies: service role only

-- Devices a user signed in from (for "New sign-in detected"). Only a hash of
-- the user agent is kept, plus a short readable label.
create table public.known_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  label text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_hash)
);
alter table public.known_devices enable row level security;
create policy "users read their devices" on public.known_devices for select using (user_id = auth.uid());
grant select on public.known_devices to authenticated;

-- Sign-in link requests per email (for "Suspicious sign-in attempts").
create table public.sign_in_requests (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now()
);
create index sign_in_requests_email_idx on public.sign_in_requests (email, created_at desc);
alter table public.sign_in_requests enable row level security;  -- service role only

-- Product update announcements written in Yolias Admin and sent to users who
-- turned "Product updates" on.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('new_feature', 'feature_available', 'feature_updated', 'important_changes', 'plan_changes', 'pricing_change', 'service_update')),
  title_en text not null,
  body_en text not null,
  title_ar text not null,
  body_ar text not null,
  cta_label_en text,
  cta_label_ar text,
  cta_url text,
  -- 'opted_in' = users with notify_product; 'all' = every user (service/plan/pricing notices only).
  audience text not null default 'opted_in' check (audience in ('opted_in', 'all')),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  recipients int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.announcements enable row level security;  -- service role only

-- Daily billing sweep bookkeeping (renewal reminders, test-mode renewals).
create table public.worker_state (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.worker_state enable row level security;  -- service role only

-- Test-mode renewals are recorded like the other subscription events.
alter table public.subscription_events drop constraint if exists subscription_events_status_check;
alter table public.subscription_events
  add constraint subscription_events_status_check check (status in ('activated', 'changed', 'canceled', 'resumed', 'ended', 'renewed'));
