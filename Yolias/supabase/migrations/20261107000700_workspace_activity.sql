-- Discovery analytics → user activity (owner request 2026-10-07, D-162):
-- actions that leave no other trace in the database, starting with exports
-- (format, how many rows, from where). Searches, enrichments, qualifications
-- and prepared messages are counted from their own tables.
create table public.workspace_activity (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('export')),
  format text check (format is null or format in ('csv')),
  source text check (source is null or length(source) <= 40),
  rows integer not null default 0 check (rows >= 0),
  created_at timestamptz not null default now()
);
create index workspace_activity_ws_idx on public.workspace_activity (workspace_id, kind, created_at desc);
alter table public.workspace_activity enable row level security;
create policy "members read activity" on public.workspace_activity for select using (public.is_workspace_member(workspace_id));
grant select on public.workspace_activity to authenticated;
-- Written by the server (service role) only.

-- Without a data provider (owner decision 2026-10-07, D-163): a company's or
-- local business's public email (info@, sales@ …) read from its own website.
alter table public.companies add column email text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
