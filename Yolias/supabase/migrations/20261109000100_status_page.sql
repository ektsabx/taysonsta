-- Public status page (2026-10-12, D-181). Yolias measures its own services
-- (the worker runs light checks every few minutes) and the team publishes
-- incidents and maintenance from Yolias Admin. The page shows the measured
-- state, never a hard-coded "all green"; a service that can't be measured
-- says so. Raw checks are kept 14 days; a daily rollup keeps 90 days of
-- history for the bars. Server-only tables (the page reads them on the server).

create table if not exists public.status_components (
  id text primary key check (id ~ '^[a-z_]{2,30}$'),
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  sort int not null default 0,
  is_public boolean not null default true,
  -- What measures it: a built-in check, or only incidents (manual).
  check_kind text not null check (check_kind in ('website', 'database', 'auth', 'discovery', 'ai', 'payments', 'email', 'manual')),
  check_enabled boolean not null default true,
  last_status text check (last_status in ('operational', 'degraded', 'partial_outage', 'major_outage', 'no_data')),
  last_checked_at timestamptz,
  last_latency_ms int,
  -- Consecutive failed checks (a single failure is treated as transient).
  fail_streak int not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.status_components (id, name_en, name_ar, description_en, description_ar, sort, check_kind) values
  ('website', 'Website and app', 'الموقع والتطبيق', 'yolias.com and the Yolias app', 'موقع yolias.com وتطبيق يولـياس', 10, 'website'),
  ('auth', 'Sign-in', 'تسجيل الدخول', 'Sign-in links and accounts', 'روابط تسجيل الدخول والحسابات', 20, 'auth'),
  ('discovery', 'Customer discovery', 'اكتشاف العملاء', 'Searches and campaigns', 'عمليات البحث والحملات', 30, 'discovery'),
  ('ai', 'Yolias AI', 'Yolias AI', 'AI answers and search understanding', 'إجابات الذكاء الاصطناعي وفهم عمليات البحث', 40, 'ai'),
  ('database', 'Data storage', 'تخزين البيانات', 'Saving and loading your data', 'حفظ بياناتك وتحميلها', 50, 'database'),
  ('payments', 'Payments and subscriptions', 'الدفع والاشتراكات', 'Checkout and billing', 'الدفع والفواتير', 60, 'payments'),
  ('email', 'Email notifications', 'إشعارات البريد', 'Product and billing emails', 'رسائل المنتج والفواتير', 70, 'email')
on conflict (id) do nothing;

create table if not exists public.status_checks (
  id bigint generated always as identity primary key,
  component_id text not null references public.status_components(id) on delete cascade,
  status text not null check (status in ('operational', 'degraded', 'partial_outage', 'major_outage', 'no_data')),
  latency_ms int,
  -- A short code for the team (e.g. "timeout", "queue_age:1800"); never shown publicly.
  detail text check (detail is null or length(detail) <= 200),
  checked_at timestamptz not null default now()
);
create index if not exists status_checks_component_idx on public.status_checks (component_id, checked_at desc);

create table if not exists public.status_daily (
  component_id text not null references public.status_components(id) on delete cascade,
  day date not null,
  total int not null default 0,
  ok int not null default 0,
  degraded int not null default 0,
  outage int not null default 0,
  primary key (component_id, day)
);

create table if not exists public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 200),
  kind text not null default 'incident' check (kind in ('incident', 'maintenance')),
  impact text not null check (impact in ('degraded', 'partial_outage', 'major_outage', 'maintenance')),
  status text not null check (status in ('investigating', 'identified', 'monitoring', 'resolved', 'scheduled', 'in_progress', 'completed')),
  components text[] not null default '{}',
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  scheduled_for timestamptz,
  scheduled_until timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'incident' and status in ('investigating', 'identified', 'monitoring', 'resolved')) or (kind = 'maintenance' and status in ('scheduled', 'in_progress', 'completed')))
);
create index if not exists status_incidents_open_idx on public.status_incidents (status, started_at desc);
create trigger status_incidents_updated_at before update on public.status_incidents for each row execute function public.set_updated_at();

create table if not exists public.status_incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.status_incidents(id) on delete restrict,
  status text not null,
  body text not null check (length(trim(body)) between 3 and 4000),
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists status_incident_updates_idx on public.status_incident_updates (incident_id, created_at desc);

-- One check result: stored, rolled up per day, and the component's latest
-- state and failure streak updated in the same transaction.
create or replace function public.status_record(p_component text, p_status text, p_latency int, p_detail text)
returns int
language plpgsql security definer set search_path = public
as $$
declare v_streak int;
begin
  insert into public.status_checks (component_id, status, latency_ms, detail) values (p_component, p_status, p_latency, left(p_detail, 200));
  insert into public.status_daily (component_id, day, total, ok, degraded, outage)
  values (p_component, (now() at time zone 'utc')::date, 1,
    case when p_status = 'operational' then 1 else 0 end,
    case when p_status = 'degraded' then 1 else 0 end,
    case when p_status in ('partial_outage', 'major_outage') then 1 else 0 end)
  on conflict (component_id, day) do update set total = status_daily.total + 1, ok = status_daily.ok + excluded.ok,
    degraded = status_daily.degraded + excluded.degraded, outage = status_daily.outage + excluded.outage;
  update public.status_components set
    fail_streak = case when p_status in ('operational', 'no_data') then 0 else fail_streak + 1 end,
    last_status = p_status, last_checked_at = now(), last_latency_ms = p_latency, updated_at = now()
  where id = p_component
  returning fail_streak into v_streak;
  -- Raw checks older than 14 days are dropped (the daily rollup keeps the history).
  delete from public.status_checks where component_id = p_component and checked_at < now() - interval '14 days';
  return v_streak;
end $$;

alter table public.status_components enable row level security;
alter table public.status_checks enable row level security;
alter table public.status_daily enable row level security;
alter table public.status_incidents enable row level security;
alter table public.status_incident_updates enable row level security;
revoke execute on function public.status_record(text, text, int, text) from public, anon, authenticated;
grant execute on function public.status_record(text, text, int, text) to service_role;
grant all on public.status_components, public.status_checks, public.status_daily, public.status_incidents, public.status_incident_updates to service_role;
