-- Website settings written by Yolias Admin (service role only). First use:
-- "support_widget" = { key, origin } — the support chat widget shown on every
-- page, served from Yolias's own domain through /support-widget (D-134).
-- Production shares the Supabase project with the Taysonsta website, which
-- already has a site_settings table of the same shape (key, value,
-- updated_at): Yolias keeps its own keys in it ("support_widget",
-- "yolias_*"), so the table is created only when missing (D-148).
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
