-- Website settings written by Yolias Admin (service role only). First use:
-- "support_widget" = { key, origin } — the support chat widget shown on every
-- page, served from Yolias's own domain through /support-widget (D-134).
create table public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;  -- service role only
