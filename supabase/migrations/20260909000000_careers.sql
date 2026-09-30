create table career_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  team text not null,
  location text not null,
  employment_type text not null,
  summary text not null,
  role_description text not null,
  ideal_candidate text not null,
  requirements text not null,
  responsibilities text not null,
  disqualifiers text not null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_career_jobs_published on career_jobs (published_at desc) where is_published;

alter table career_jobs enable row level security;
create policy "career_jobs_read_published" on career_jobs for select using (is_published = true);

grant select on public.career_jobs to anon, authenticated;
grant all on public.career_jobs to service_role;

create table career_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references career_jobs(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  instagram_handle text not null,
  other_socials text,
  country text not null,
  age int not null check (age between 14 and 100),
  education_status text not null,
  courses_completed text,
  years_experience numeric not null default 0,
  bio text not null,
  why_fit text not null,
  expected_salary text not null,
  portfolio_path text,
  status text not null default 'new' check (status in ('new', 'in_review', 'contacted', 'interview', 'accepted', 'rejected')),
  internal_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_career_applications_job on career_applications (job_id);
create index idx_career_applications_status on career_applications (status);
create index idx_career_applications_created on career_applications (created_at desc);

alter table career_applications enable row level security;

grant all on public.career_applications to service_role;

create table career_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references career_applications(id) on delete cascade,
  scheduled_at timestamptz not null,
  interviewer_name text,
  round int not null default 1 check (round > 0),
  format text not null default 'call' check (format in ('call', 'video', 'onsite')),
  feedback text,
  outcome text not null default 'pending' check (outcome in ('pending', 'passed', 'failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_career_interviews_application on career_interviews (application_id);

alter table career_interviews enable row level security;

grant all on public.career_interviews to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('career-applications', 'career-applications', false, 10485760)
on conflict (id) do nothing;

create policy "service role manage career applications bucket" on storage.objects
  for all using (bucket_id = 'career-applications' and auth.role() = 'service_role');
