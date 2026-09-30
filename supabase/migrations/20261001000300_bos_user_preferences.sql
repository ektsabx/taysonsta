-- Master upgrade Phase 2 (docs/bos/30 §4–5, §6.1): per-user interface
-- preferences. null = follow the company default (Settings → Company).
-- Phase 3 adds timezone/format editing on the same row.
create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text check (language in ('ar','en')),
  theme text check (theme in ('dark','light','system')),
  timezone text,
  date_format text,
  updated_at timestamptz not null default now()
);
create trigger user_preferences_touch before update on user_preferences for each row execute function bos_touch_updated_at();
alter table user_preferences enable row level security;
grant all on user_preferences to service_role;
