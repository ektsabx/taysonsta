-- Contact messages and bug reports reach the team (2026-10-12).
-- Before this, Contact form messages were stored but nothing read them.
-- One table for both (kind = contact | bug_report), handled from Yolias Admin
-- → Support → Website messages (read and updated with the service role).
-- Additive only: existing messages become kind 'contact', status 'new'.

alter table public.contact_messages
  add column if not exists kind text not null default 'contact' check (kind in ('contact', 'bug_report')),
  add column if not exists status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  add column if not exists subject text,
  -- Bug reports (and feedback) from inside the app.
  add column if not exists category text check (category is null or category in ('bug', 'feedback', 'billing', 'data', 'account', 'other')),
  add column if not exists steps text,
  add column if not exists page_path text,
  add column if not exists app_release text,
  add column if not exists browser text,
  add column if not exists viewport text,
  add column if not exists screenshot_path text,
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null,
  -- Abuse protection: a salted hash, never the raw IP address.
  add column if not exists ip_hash text,
  -- Set only when the email provider accepted the notification to the team.
  add column if not exists notified_at timestamptz,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists contact_messages_inbox_idx on public.contact_messages (kind, status, created_at desc);
create index if not exists contact_messages_ip_idx on public.contact_messages (ip_hash, created_at desc) where ip_hash is not null;
create index if not exists contact_messages_email_idx on public.contact_messages (email, created_at desc);
create index if not exists contact_messages_user_idx on public.contact_messages (user_id, created_at desc) where user_id is not null;

drop trigger if exists contact_messages_updated_at on public.contact_messages;
create trigger contact_messages_updated_at before update on public.contact_messages
  for each row execute function public.set_updated_at();

-- Screenshots attached to bug reports: private bucket, images only, 4 MB.
-- Uploaded and read by server code only (service role); Admin opens them
-- with short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bug-screenshots', 'bug-screenshots', false, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
