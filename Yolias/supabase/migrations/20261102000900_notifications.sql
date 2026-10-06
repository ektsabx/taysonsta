-- Final spec phase 9: notifications system.
--  * notifications: in-app notices for a user (bell in Yolias), created with
--    the same events as the emails, in the user's language, deduplicated.
--  * email_settings: per email event, whether the email and the in-app
--    notice are sent (Yolias Admin → Emails). No row = both on.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind text not null,
  title text not null check (length(title) <= 300),
  body text check (body is null or length(body) <= 1000),
  link text check (link is null or link ~ '^/'),
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create table public.email_settings (
  kind text primary key,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.email_settings enable row level security;  -- service role only
