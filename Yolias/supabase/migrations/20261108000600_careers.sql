-- yolias.com/careers (2026-10-12). Jobs are managed in Yolias Admin → Team →
-- Recruitment → Jobs, in public.career_jobs. In production Yolias and the
-- Admin share one Supabase project (D-150), so this table already exists and
-- this migration changes nothing but the on_yolias column (also added by the
-- Admin's migration; both are "if not exists"). On a separate Yolias
-- database (local development) it creates the same table with the public
-- read policy: published jobs only.
do $$
begin
  if to_regclass('public.career_jobs') is null then
    create table public.career_jobs (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      slug text not null unique,
      team text not null default '',
      location text not null default '',
      employment_type text not null default '',
      summary text not null default '',
      role_description text not null default '',
      ideal_candidate text not null default '',
      requirements text not null default '',
      responsibilities text not null default '',
      disqualifiers text not null default '',
      is_published boolean not null default false,
      published_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    alter table public.career_jobs enable row level security;
    create policy "career_jobs_read_published" on public.career_jobs for select using (is_published = true);
    grant select on public.career_jobs to anon, authenticated;
    grant all on public.career_jobs to service_role;
  end if;
end $$;

alter table public.career_jobs add column if not exists on_yolias boolean not null default false;
