-- Sales emails (owner, 2026-10-29). Additive only.
-- One switch for the morning summary (Today by email) and meeting reminders
-- by email; on by default, turned off in Settings → Notifications.
alter table public.profiles
  add column if not exists notify_sales boolean not null default true;
