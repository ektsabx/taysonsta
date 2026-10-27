-- SEO Control Center (owner brief 2026-10-26, D-257). Additive only: new
-- content kinds and SEO fields on content_entries, page revisions, and
-- service-role tables for competitors, keywords, redirects, Search Console /
-- GA4 numbers and where each sign-up came from. Nothing existing is dropped
-- or retyped; existing rows keep working as they are.

-- ── Website content: SEO page kinds, SEO fields, scheduling ────────────────
-- compare: "Yolias vs X" and "best X tools" (/compare/…); alternatives: "X
-- alternatives" (/alternatives/…); solution: one audience (/solutions/…, after
-- the pages shipped in code); template: a prospecting template (/templates/…).
alter table public.content_entries drop constraint content_entries_kind_check;
alter table public.content_entries add constraint content_entries_kind_check
  check (kind in ('help', 'docs', 'blog', 'legal', 'compare', 'alternatives', 'solution', 'template'));
alter table public.content_entries drop constraint content_entries_status_check;
alter table public.content_entries add constraint content_entries_status_check
  check (status in ('draft', 'scheduled', 'published', 'hidden'));
alter table public.content_entries
  -- {meta_title: {en, ar}, meta_description: {en, ar}, h1: {en, ar}, canonical, robots: index | noindex, schema: auto | none}
  add column seo jsonb not null default '{}'::jsonb,
  add column primary_keyword text check (primary_keyword is null or length(primary_keyword) between 2 and 120),
  add column secondary_keywords text[] not null default '{}',
  -- status 'scheduled': the site shows the page from this moment on.
  add column scheduled_at timestamptz,
  add constraint content_entries_scheduled_check check (status <> 'scheduled' or scheduled_at is not null);
-- One page per main keyword: two live pages never compete for the same search.
create unique index content_entries_primary_keyword on public.content_entries (lower(primary_keyword))
  where primary_keyword is not null and status <> 'hidden';

drop policy "anyone reads published content" on public.content_entries;
create policy "anyone reads published content" on public.content_entries for select
  using (status in ('published', 'hidden') or (status = 'scheduled' and scheduled_at <= now()));

-- Every save keeps a copy, so an edit can be undone.
create table public.content_revisions (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.content_entries(id) on delete cascade,
  slug text not null,
  status text not null,
  meta jsonb not null,
  doc jsonb not null,
  seo jsonb not null,
  primary_keyword text,
  secondary_keywords text[] not null default '{}',
  scheduled_at timestamptz,
  saved_by text,
  saved_at timestamptz not null default now()
);
create index content_revisions_entry on public.content_revisions (entry_id, saved_at desc);
alter table public.content_revisions enable row level security;

-- ── Competitors: reviewed facts with their source and date ─────────────────
-- Every fact and price carries {source_url, checked_at, verified}; the site
-- shows a price only once a person has marked it verified.
create table public.seo_competitors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  name text not null,
  website text not null check (website ~ '^https://'),
  pricing_url text check (pricing_url is null or pricing_url ~ '^https://'),
  -- {en, ar}
  summary jsonb not null default '{}'::jsonb,
  best_for jsonb not null default '{}'::jsonb,
  strengths jsonb not null default '{}'::jsonb,   -- {en: [], ar: []}
  limits jsonb not null default '{}'::jsonb,
  -- [{key, value: {en, ar}, source_url, checked_at, verified}]
  facts jsonb not null default '[]'::jsonb,
  -- [{plan, price, period, note, source_url, checked_at, verified}]
  pricing jsonb not null default '[]'::jsonb,
  publishes_prices boolean,
  last_reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger seo_competitors_updated_at before update on public.seo_competitors
  for each row execute function public.set_updated_at();
alter table public.seo_competitors enable row level security;

-- ── Keywords and opportunities ─────────────────────────────────────────────
-- volume / difficulty are filled only with their source: 'manual_estimate'
-- for a person's guess, a provider's name for its data, null for unknown.
create table public.seo_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null check (length(keyword) between 2 and 120),
  locale text not null default 'en' check (locale in ('en', 'ar')),
  intent text not null default 'commercial' check (intent in ('informational', 'commercial', 'comparison', 'transactional', 'navigational')),
  cluster text,
  page_type text check (page_type is null or page_type in ('compare', 'alternatives', 'solution', 'template', 'use_case', 'blog', 'help', 'core')),
  priority smallint not null default 2 check (priority between 1 and 3),
  stage text not null default 'idea' check (stage in ('idea', 'researching', 'planned', 'writing', 'review', 'published', 'monitoring', 'dropped')),
  target_path text check (target_path is null or target_path ~ '^/'),
  volume int check (volume is null or volume >= 0),
  volume_source text,
  difficulty smallint check (difficulty is null or difficulty between 0 and 100),
  difficulty_source text,
  metrics_checked_at timestamptz,
  notes text,
  related text[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_keywords_volume_source check (volume is null or volume_source is not null),
  constraint seo_keywords_difficulty_source check (difficulty is null or difficulty_source is not null)
);
create unique index seo_keywords_unique on public.seo_keywords (lower(keyword), locale);
create index seo_keywords_target on public.seo_keywords (target_path);
create trigger seo_keywords_updated_at before update on public.seo_keywords
  for each row execute function public.set_updated_at();
alter table public.seo_keywords enable row level security;

-- ── Redirects: merged or moved pages ───────────────────────────────────────
create table public.seo_redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique check (from_path ~ '^/[^?#]*$' and from_path <> '/'),
  to_path text not null check (to_path ~ '^/[^#]*$'),
  status_code smallint not null default 308 check (status_code in (301, 302, 307, 308)),
  active boolean not null default true,
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_redirects_not_self check (from_path <> to_path)
);
create trigger seo_redirects_updated_at before update on public.seo_redirects
  for each row execute function public.set_updated_at();
alter table public.seo_redirects enable row level security;
-- The site's front door (anon key) reads the active ones.
create policy "anyone reads active redirects" on public.seo_redirects for select using (active);
grant select on public.seo_redirects to anon, authenticated;

-- ── Search Console and GA4 numbers (synced by Yolias Admin) ─────────────────
create table public.seo_page_daily (
  day date not null,
  page text not null,
  clicks int not null default 0,
  impressions int not null default 0,
  position numeric(6, 2),
  primary key (day, page)
);
create index seo_page_daily_page on public.seo_page_daily (page, day);
alter table public.seo_page_daily enable row level security;

create table public.seo_query_daily (
  day date not null,
  page text not null,
  query text not null,
  clicks int not null default 0,
  impressions int not null default 0,
  position numeric(6, 2),
  primary key (day, page, query)
);
create index seo_query_daily_query on public.seo_query_daily (query, day);
alter table public.seo_query_daily enable row level security;

-- GA4 sessions whose channel is Organic Search, by landing page.
create table public.seo_ga_daily (
  day date not null,
  landing_page text not null,
  sessions int not null default 0,
  engaged_sessions int not null default 0,
  key_events numeric(12, 2) not null default 0,
  primary key (day, landing_page)
);
alter table public.seo_ga_daily enable row level security;

-- Search Console URL Inspection: whether Google has the page indexed.
create table public.seo_url_inspections (
  url text primary key,
  verdict text,
  coverage_state text,
  indexing_state text,
  robots_state text,
  google_canonical text,
  user_canonical text,
  last_crawl_at timestamptz,
  checked_at timestamptz not null default now()
);
alter table public.seo_url_inspections enable row level security;

-- One row per sync or check, with its error when it failed.
create table public.seo_sync_runs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('gsc', 'ga4', 'inspection', 'crawl')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  rows int,
  error text,
  result jsonb,
  started_by text
);
create index seo_sync_runs_source on public.seo_sync_runs (source, started_at desc);
alter table public.seo_sync_runs enable row level security;

-- ── Where each sign-up came from (first visit, no identifier) ──────────────
-- From the yolias_ft cookie: the first public page of the visit that led to
-- the account, the referring site's host and UTM tags. No IP, no full referrer.
create table public.signup_attribution (
  user_id uuid primary key references auth.users(id) on delete cascade,
  landing_path text,
  referrer_host text,
  channel text not null default 'unknown' check (channel in ('organic_search', 'paid_search', 'social', 'ai_assistant', 'referral', 'email', 'affiliate', 'direct', 'unknown')),
  search_engine text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  first_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index signup_attribution_landing on public.signup_attribution (landing_path, created_at);
create index signup_attribution_channel on public.signup_attribution (channel, created_at);
alter table public.signup_attribution enable row level security;
