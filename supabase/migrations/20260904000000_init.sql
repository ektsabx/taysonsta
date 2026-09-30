create extension if not exists "pgcrypto";

create table blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ar text not null,
  name_en text not null,
  created_at timestamptz not null default now()
);

create table authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  bio_ar text,
  bio_en text,
  created_at timestamptz not null default now()
);

create table blogs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_ar text not null,
  title_en text not null,
  excerpt_ar text,
  excerpt_en text,
  content_ar text not null,
  content_en text not null,
  featured_image text,
  category_id uuid references blog_categories(id) on delete set null,
  author_id uuid references authors(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  reading_time_minutes integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blogs_status_published_at_idx on blogs (status, published_at desc);

create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  project_name text not null,
  country_ar text not null,
  country_en text not null,
  image_path text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table faqs (
  id uuid primary key default gen_random_uuid(),
  question_ar text not null,
  question_en text not null,
  answer_ar text not null,
  answer_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30,
  timezone text not null default 'Africa/Cairo',
  is_active boolean not null default true
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  timezone text not null default 'Africa/Cairo',
  status text not null default 'pending' check (status in ('pending','confirmed','unqualified','cancelled')),
  created_at timestamptz not null default now()
);
create unique index bookings_confirmed_slot_idx on bookings (scheduled_start) where status = 'confirmed';

create table booking_answers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  gcc_resident text not null check (gcc_resident in ('yes','no')),
  need text not null,
  revenue_goal text not null,
  start_timing text not null,
  decision_maker text not null check (decision_maker in ('yes','partner','no')),
  investment_readiness text not null check (investment_readiness in ('ready','no_capital')),
  source text not null,
  created_at timestamptz not null default now()
);

alter table blog_categories enable row level security;
alter table authors enable row level security;
alter table blogs enable row level security;
alter table site_settings enable row level security;
alter table portfolio_projects enable row level security;
alter table faqs enable row level security;
alter table availability_rules enable row level security;
alter table bookings enable row level security;
alter table booking_answers enable row level security;

create policy "public read blog_categories" on blog_categories for select using (true);
create policy "public read authors" on authors for select using (true);
create policy "public read published blogs" on blogs for select using (status = 'published');
create policy "public read site_settings" on site_settings for select using (true);
create policy "public read active portfolio_projects" on portfolio_projects for select using (is_active = true);
create policy "public read active faqs" on faqs for select using (is_active = true);
create policy "public read active availability_rules" on availability_rules for select using (is_active = true);
create policy "public read confirmed bookings for slot check" on bookings for select using (status = 'confirmed');
create policy "public insert bookings" on bookings for insert with check (status = 'pending');
create policy "public insert booking_answers" on booking_answers for insert with check (true);
