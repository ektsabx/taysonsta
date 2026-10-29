-- Meetings inside Yolias (owner, 2026-10-30, D-267). Additive only.
--  1. booking_pages: each member's public booking page (yolias.com/meet/<slug>):
--     title, place, a line for visitors, length, time zone, break, notice,
--     how far ahead, and weekly hours. Read and written by the server only.
--  2. calendar_connections: an optional Google Calendar link. Yolias creates
--     one calendar of its own and only ever touches that one; the refresh
--     token is kept in Vault.
--  3. sales_meetings: where a meeting came from, the guest, the host, the
--     Google event, and a token for the guest's cancel link. A host can't be
--     booked twice at the same start time.

create table public.booking_pages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  enabled boolean not null default true,
  title text not null default 'Meeting' check (length(trim(title)) between 1 and 120),
  location text check (location is null or length(location) <= 300),
  description text check (description is null or length(description) <= 500),
  duration_min int not null default 30 check (duration_min between 10 and 240),
  timezone text not null default 'Africa/Cairo' check (length(timezone) <= 64),
  buffer_min int not null default 10 check (buffer_min between 0 and 120),
  min_notice_hours int not null default 12 check (min_notice_hours between 0 and 336),
  window_days int not null default 21 check (window_days between 1 and 90),
  -- {"sun":[["10:00","17:00"]], …, "fri":[], "sat":[]}
  hours jsonb not null default '{"sun":[["10:00","17:00"]],"mon":[["10:00","17:00"]],"tue":[["10:00","17:00"]],"wed":[["10:00","17:00"]],"thu":[["10:00","17:00"]],"fri":[],"sat":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger booking_pages_updated before update on public.booking_pages
  for each row execute function public.set_updated_at();
alter table public.booking_pages enable row level security;
create policy "members read their booking page" on public.booking_pages for select using (user_id = auth.uid());
grant select on public.booking_pages to authenticated;

create table public.calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  email text,
  calendar_id text,
  token_secret_id uuid,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  error text check (error is null or length(error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger calendar_connections_updated before update on public.calendar_connections
  for each row execute function public.set_updated_at();
alter table public.calendar_connections enable row level security;
create policy "members read their calendar" on public.calendar_connections for select using (user_id = auth.uid());
grant select (user_id, workspace_id, provider, email, calendar_id, status, error, created_at, updated_at) on public.calendar_connections to authenticated;

create or replace function public.set_calendar_token(p_user uuid, p_token text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_token)), 0) = 0 then raise exception 'empty token'; end if;
  select token_secret_id into v_id from public.calendar_connections where user_id = p_user for update;
  if not found then raise exception 'unknown calendar'; end if;
  if v_id is null then
    v_id := vault.create_secret(p_token, 'calendar_' || p_user, 'Yolias calendar refresh token');
    update public.calendar_connections set token_secret_id = v_id where user_id = p_user;
  else
    perform vault.update_secret(v_id, p_token);
  end if;
end $$;

create or replace function public.calendar_token(p_user uuid) returns text
language sql stable security definer set search_path = public, vault as $$
  select s.decrypted_secret from public.calendar_connections c join vault.decrypted_secrets s on s.id = c.token_secret_id where c.user_id = p_user;
$$;

create or replace function public.clear_calendar_token(p_user uuid) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  select token_secret_id into v_id from public.calendar_connections where user_id = p_user for update;
  delete from public.calendar_connections where user_id = p_user;
  if v_id is not null then delete from vault.secrets where id = v_id; end if;
end $$;

revoke execute on function public.set_calendar_token(uuid, text) from public, anon, authenticated;
revoke execute on function public.calendar_token(uuid) from public, anon, authenticated;
revoke execute on function public.clear_calendar_token(uuid) from public, anon, authenticated;
grant execute on function public.set_calendar_token(uuid, text) to service_role;
grant execute on function public.calendar_token(uuid) to service_role;
grant execute on function public.clear_calendar_token(uuid) to service_role;

alter table public.sales_meetings
  add column if not exists source text not null default 'manual' check (source in ('manual', 'booking', 'agent')),
  add column if not exists host_id uuid references auth.users(id) on delete set null,
  add column if not exists guest_name text check (guest_name is null or length(guest_name) <= 120),
  add column if not exists guest_email text check (guest_email is null or length(guest_email) <= 254),
  add column if not exists guest_note text check (guest_note is null or length(guest_note) <= 1000),
  add column if not exists location text check (location is null or length(location) <= 300),
  add column if not exists google_event_id text,
  add column if not exists cancel_token uuid not null default gen_random_uuid();

create unique index if not exists sales_meetings_host_slot on public.sales_meetings (host_id, starts_at) where status = 'scheduled' and host_id is not null;
create index if not exists sales_meetings_host_upcoming on public.sales_meetings (host_id, starts_at) where status = 'scheduled';
create unique index if not exists sales_meetings_cancel_token on public.sales_meetings (cancel_token);
