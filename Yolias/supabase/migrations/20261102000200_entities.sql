-- Final spec phase 4: entity layer and search types.
-- Entities: Person (prospects), Company and Local Business (companies.kind),
-- Job (jobs). Every result carries the standard intelligence fields:
-- source, provenance (per field: source, time, confidence), last updated,
-- confidence, match score + reasons, and the fields still missing.
-- Search types: people · companies · local_businesses · company_lookalikes.

alter table public.campaigns
  add column search_type text not null default 'people'
    check (search_type in ('people', 'companies', 'local_businesses', 'company_lookalikes'));

-- ── Companies & local businesses ──
alter table public.companies
  add column kind text not null default 'company' check (kind in ('company', 'local_business')),
  add column category text,                         -- local business category (e.g. "Dental clinic")
  add column address text,
  add column phone text,
  add column website text,
  add column rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  add column reviews_count int check (reviews_count is null or reviews_count >= 0),
  add column place_ref text,                        -- maps place id
  add column maps_url text,
  add column match_score int check (match_score is null or match_score between 0 and 100),
  add column match_reasons jsonb not null default '[]'::jsonb,
  add column confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column provenance jsonb not null default '[]'::jsonb,
  add column missing_fields text[] not null default '{}',
  add column last_updated timestamptz not null default now(),
  add column saved_at timestamptz,
  -- Set when the company/local business is the search's result (billed as a
  -- prospect); null for companies kept as context of a people search.
  add column delivered_at timestamptz;
create index companies_kind_idx on public.companies(workspace_id, kind, created_at desc);

-- ── People ──
-- WhatsApp is not a Yolias channel (final spec); a phone stays a phone.
alter table public.prospects drop column if exists whatsapp;
alter table public.prospects
  add column confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  add column provenance jsonb not null default '[]'::jsonb,
  add column missing_fields text[] not null default '{}',
  add column last_updated timestamptz not null default now();

-- ── Jobs (hiring signals) ──
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  department text,
  seniority text,
  city text,
  country text,
  url text,
  posted_at timestamptz,
  source text not null,
  source_ref text,
  match_score int check (match_score is null or match_score between 0 and 100),
  match_reasons jsonb not null default '[]'::jsonb,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  provenance jsonb not null default '[]'::jsonb,
  missing_fields text[] not null default '{}',
  last_updated timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now()
);
create index jobs_campaign_idx on public.jobs(campaign_id, created_at desc);
create index jobs_company_idx on public.jobs(company_id);
create unique index jobs_campaign_url_uq on public.jobs(campaign_id, url);  -- null urls never collide
alter table public.jobs enable row level security;
create policy "members read jobs" on public.jobs for select using (public.is_workspace_member(workspace_id));
