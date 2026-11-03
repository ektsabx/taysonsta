-- D-276 (owner, 2026-11-03): every page view on yolias.com and in the app,
-- for Yolias Admin's numbers (visitors, visits, views, channels, countries,
-- devices, live users). Written by the server only (/api/v); never read by
-- members. The IP address is kept 30 days, then cleared (lib/visits.ts →
-- clearOldIps); the Privacy Policy says so.

create table if not exists public.site_visits (
  id bigserial primary key,
  -- A visitor: the yolias_vid cookie when analytics cookies are accepted,
  -- else a daily hash of the address and browser (no cookie).
  visitor text not null check (char_length(visitor) <= 64),
  -- A visit: page views of one visitor with less than 30 minutes between them.
  session uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  area text not null check (area in ('site', 'app')),
  path text not null check (char_length(path) <= 300),
  -- The visit's first page decides its channel (lib/attribution.ts classify).
  landing boolean not null default false,
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  channel text check (channel is null or char_length(channel) <= 32),
  engine text check (engine is null or char_length(engine) <= 32),
  utm_source text check (utm_source is null or char_length(utm_source) <= 100),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 100),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 100),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  region text check (region is null or char_length(region) <= 100),
  city text check (city is null or char_length(city) <= 100),
  ip inet,
  device text check (device is null or char_length(device) <= 20),
  os text check (os is null or char_length(os) <= 20),
  browser text check (browser is null or char_length(browser) <= 30),
  locale text check (locale is null or locale in ('en', 'ar')),
  created_at timestamptz not null default now()
);
create index if not exists site_visits_created_idx on public.site_visits (created_at);
create index if not exists site_visits_visitor_idx on public.site_visits (visitor, created_at desc);
create index if not exists site_visits_session_idx on public.site_visits (session);
create index if not exists site_visits_user_idx on public.site_visits (user_id, created_at desc) where user_id is not null;
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;

-- Signed-in sessions get where they come from too (Admin → live users).
alter table public.app_sessions
  add column if not exists ip inet,
  add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$'),
  add column if not exists city text check (city is null or char_length(city) <= 100);
