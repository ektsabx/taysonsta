create type portfolio_relationship_type as enum ('owned', 'co_founded', 'equity', 'revenue_share', 'acquired');

create table portfolio_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  short_description text,
  description text,
  logo text,
  cover_image text,
  website_url text,
  relationship_type portfolio_relationship_type not null,
  industry text,
  founded_year integer,
  status text not null default 'active' check (status in ('active', 'inactive')),
  markets text[] not null default '{}',
  featured boolean not null default false,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_companies_published_idx on portfolio_companies (is_published, sort_order);
create index portfolio_companies_relationship_idx on portfolio_companies (relationship_type);

create table portfolio_company_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references portfolio_companies(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);

create table portfolio_company_built_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references portfolio_companies(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);

create table portfolio_company_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references portfolio_companies(id) on delete cascade,
  label text not null,
  value_display text not null,
  value_numeric numeric,
  sort_order integer not null default 0
);

create table portfolio_company_timeline (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references portfolio_companies(id) on delete cascade,
  year integer not null,
  label text not null,
  description text,
  sort_order integer not null default 0
);

create table case_studies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  client_name text,
  short_description text,
  description text,
  featured_image text,
  industry text,
  services text[] not null default '{}',
  challenge text,
  solution text,
  result text,
  testimonial_quote text,
  testimonial_author text,
  testimonial_role text,
  website_url text,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_studies_status_idx on case_studies (status, published_at desc);

create table case_study_metrics (
  id uuid primary key default gen_random_uuid(),
  case_study_id uuid not null references case_studies(id) on delete cascade,
  label text not null,
  value_display text not null,
  value_numeric numeric,
  sort_order integer not null default 0
);

create table case_study_media (
  id uuid primary key default gen_random_uuid(),
  case_study_id uuid not null references case_studies(id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order integer not null default 0
);

alter table portfolio_companies enable row level security;
alter table portfolio_company_roles enable row level security;
alter table portfolio_company_built_items enable row level security;
alter table portfolio_company_metrics enable row level security;
alter table portfolio_company_timeline enable row level security;
alter table case_studies enable row level security;
alter table case_study_metrics enable row level security;
alter table case_study_media enable row level security;

create policy "public read published companies" on portfolio_companies for select using (is_published = true);
create policy "public read roles of published companies" on portfolio_company_roles for select using (
  exists (select 1 from portfolio_companies pc where pc.id = company_id and pc.is_published = true)
);
create policy "public read built items of published companies" on portfolio_company_built_items for select using (
  exists (select 1 from portfolio_companies pc where pc.id = company_id and pc.is_published = true)
);
create policy "public read metrics of published companies" on portfolio_company_metrics for select using (
  exists (select 1 from portfolio_companies pc where pc.id = company_id and pc.is_published = true)
);
create policy "public read timeline of published companies" on portfolio_company_timeline for select using (
  exists (select 1 from portfolio_companies pc where pc.id = company_id and pc.is_published = true)
);
create policy "public read published case studies" on case_studies for select using (status = 'published');
create policy "public read metrics of published case studies" on case_study_metrics for select using (
  exists (select 1 from case_studies cs where cs.id = case_study_id and cs.status = 'published')
);
create policy "public read media of published case studies" on case_study_media for select using (
  exists (select 1 from case_studies cs where cs.id = case_study_id and cs.status = 'published')
);

grant select on public.portfolio_companies to anon, authenticated;
grant select on public.portfolio_company_roles to anon, authenticated;
grant select on public.portfolio_company_built_items to anon, authenticated;
grant select on public.portfolio_company_metrics to anon, authenticated;
grant select on public.portfolio_company_timeline to anon, authenticated;
grant select on public.case_studies to anon, authenticated;
grant select on public.case_study_metrics to anon, authenticated;
grant select on public.case_study_media to anon, authenticated;

grant all on public.portfolio_companies to service_role;
grant all on public.portfolio_company_roles to service_role;
grant all on public.portfolio_company_built_items to service_role;
grant all on public.portfolio_company_metrics to service_role;
grant all on public.portfolio_company_timeline to service_role;
grant all on public.case_studies to service_role;
grant all on public.case_study_metrics to service_role;
grant all on public.case_study_media to service_role;
