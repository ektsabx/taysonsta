-- Final spec phase 8: outreach (supersedes "no outreach" in D-104, see D-129).
-- Yolias prepares a personalised email per prospect; a member reviews it and
-- approves it; it is sent from the member's own connected mailbox (Gmail /
-- Outlook). Email only — no WhatsApp, SMS or voice. No automatic sequences:
-- every message is approved by a person. The suppression list is honoured.

-- ── Connected mailboxes (one per member and provider) ──
create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  email text not null,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  token_secret_id uuid,                            -- refresh token in Vault
  daily_limit int not null default 50 check (daily_limit between 1 and 500),
  sent_day date,
  sent_today int not null default 0,
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);
create trigger mailboxes_updated_at before update on public.mailboxes
  for each row execute function public.set_updated_at();
alter table public.mailboxes enable row level security;
create policy "members read their own mailboxes" on public.mailboxes for select using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
grant select on public.mailboxes to authenticated;
-- The member may change only the daily limit of their mailbox.
create policy "members set their mailbox limit" on public.mailboxes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant update (daily_limit) on public.mailboxes to authenticated;

create or replace function public.set_mailbox_token(p_mailbox uuid, p_token text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_token)), 0) = 0 then raise exception 'empty token'; end if;
  select token_secret_id into v_id from public.mailboxes where id = p_mailbox for update;
  if not found then raise exception 'unknown mailbox'; end if;
  if v_id is null then
    v_id := vault.create_secret(p_token, 'mailbox_' || p_mailbox, 'Yolias mailbox refresh token');
    update public.mailboxes set token_secret_id = v_id where id = p_mailbox;
  else
    perform vault.update_secret(v_id, p_token);
  end if;
end $$;

create or replace function public.mailbox_token(p_mailbox uuid) returns text
language sql stable security definer set search_path = public, vault as $$
  select s.decrypted_secret from public.mailboxes m join vault.decrypted_secrets s on s.id = m.token_secret_id where m.id = p_mailbox;
$$;

create or replace function public.clear_mailbox_token(p_mailbox uuid) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  select token_secret_id into v_id from public.mailboxes where id = p_mailbox for update;
  update public.mailboxes set token_secret_id = null, status = 'disconnected' where id = p_mailbox;
  if v_id is not null then delete from vault.secrets where id = v_id; end if;
end $$;

revoke execute on function public.set_mailbox_token(uuid, text) from public, anon, authenticated;
revoke execute on function public.mailbox_token(uuid) from public, anon, authenticated;
revoke execute on function public.clear_mailbox_token(uuid) from public, anon, authenticated;
grant execute on function public.set_mailbox_token(uuid, text) to service_role;
grant execute on function public.mailbox_token(uuid) to service_role;
grant execute on function public.clear_mailbox_token(uuid) to service_role;

-- ── Messages ──
create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  channel text not null default 'email' check (channel = 'email'),
  to_email text,
  subject text not null default '' check (length(subject) <= 300),
  body text not null default '' check (length(body) <= 10000),
  language text not null default 'en' check (language in ('en', 'ar')),
  instruction text check (instruction is null or length(instruction) <= 1000),
  status text not null default 'draft' check (status in ('draft', 'approved', 'sending', 'sent', 'failed', 'canceled')),
  mailbox_id uuid references public.mailboxes(id) on delete set null,
  provider_message_id text,
  error text,
  model text,
  cost_usd numeric(12, 6),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outreach_ws_idx on public.outreach_messages (workspace_id, status, created_at desc);
create index outreach_prospect_idx on public.outreach_messages (prospect_id);
create trigger outreach_updated_at before update on public.outreach_messages
  for each row execute function public.set_updated_at();

alter table public.outreach_messages enable row level security;
create policy "members read outreach" on public.outreach_messages for select using (public.is_workspace_member(workspace_id));
create policy "members edit outreach" on public.outreach_messages for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
grant select on public.outreach_messages to authenticated;
grant update (subject, body, to_email, status, approved_by, approved_at, mailbox_id) on public.outreach_messages to authenticated;

-- Members move a message only along the human steps: edit a draft, approve
-- it, cancel it, or send a failed one back to draft. Sending is server work.
create or replace function public.outreach_member_transition() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'authenticated' then return new; end if;
  if old.status not in ('draft', 'approved', 'failed') then
    raise exception 'message can no longer be changed';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status in ('approved', 'canceled'))
    or (old.status = 'approved' and new.status in ('draft', 'canceled'))
    or (old.status = 'failed' and new.status in ('draft', 'canceled'))
  ) then
    raise exception 'not allowed: % -> %', old.status, new.status;
  end if;
  if new.status = 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  if (new.subject is distinct from old.subject or new.body is distinct from old.body or new.to_email is distinct from old.to_email) and new.status <> 'draft' then
    raise exception 'edit the message as a draft';
  end if;
  return new;
end $$;
create trigger outreach_member_transition before update on public.outreach_messages
  for each row execute function public.outreach_member_transition();
