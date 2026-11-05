-- Conversations and mailboxes (owner, 2026-11-05).

-- Tags on a conversation, to filter by them.
create table if not exists public.lead_tags (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 40),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag)
);
create index if not exists lead_tags_ws_idx on public.lead_tags (workspace_id, tag);
alter table public.lead_tags enable row level security;
drop policy if exists lead_tags_read on public.lead_tags;
create policy lead_tags_read on public.lead_tags for select using (public.is_workspace_member(workspace_id));

-- A member can connect several mailboxes of one kind: one row per address.
alter table public.mailboxes drop constraint if exists mailboxes_workspace_id_user_id_provider_key;
create unique index if not exists mailboxes_member_address_key on public.mailboxes (workspace_id, user_id, provider, email);

-- Files sent with a reply, and bounces a provider refused as spam.
alter table public.outreach_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.outreach_messages add column if not exists spam_blocked boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit)
values ('inbox-files', 'inbox-files', false, 10485760)
on conflict (id) do nothing;
