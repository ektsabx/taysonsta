-- Careers on yolias.com (2026-10-12). Jobs stay managed in Team →
-- Recruitment → Jobs; a published job appears on yolias.com/careers only
-- when this is on, so jobs meant for the Taysonsta website don't show on
-- Yolias. Public readers still see published jobs only (existing policy).
-- Additive only.
alter table public.career_jobs add column if not exists on_yolias boolean not null default false;
create index if not exists idx_career_jobs_on_yolias on public.career_jobs (published_at desc) where is_published and on_yolias;
