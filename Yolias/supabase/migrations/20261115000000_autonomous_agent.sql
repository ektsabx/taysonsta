-- Autonomous AI Sales Agent (owner brief 2026-10-19, D-228..).
-- Extends what exists; no parallel tables:
--  * mailboxes (already there since D-155, unused): the member's own Gmail /
--    Outlook account, refresh token in Vault. Adds a "test" provider for
--    local/test runs only (the app refuses it in production), and what reply
--    sync needs (cursor, last sync, read access).
--  * outreach_campaigns: sending through the member's mailbox needs an
--    explicit approval (who, when), the mailbox to send from, optional
--    auto-replies, and the search it came from.
--  * outreach_messages: the provider's thread id (to match replies), delivery
--    status (bounces) and retry bookkeeping. Inbound replies are unique per
--    provider message id, so a sync that runs twice never duplicates them.

-- ── Mailboxes ────────────────────────────────────────────────────────────────
alter table public.mailboxes drop constraint if exists mailboxes_provider_check;
alter table public.mailboxes add constraint mailboxes_provider_check check (provider in ('gmail', 'outlook', 'test'));
alter table public.mailboxes
  add column if not exists display_name text check (display_name is null or length(display_name) <= 200),
  add column if not exists can_read boolean not null default false,
  add column if not exists sync_cursor text check (sync_cursor is null or length(sync_cursor) <= 500),
  add column if not exists last_synced_at timestamptz;

-- ── Outreach campaigns: approval and execution ──────────────────────────────
alter table public.outreach_campaigns
  add column if not exists send_mode text not null default 'manual' check (send_mode in ('manual', 'mailbox')),
  add column if not exists mailbox_id uuid references public.mailboxes(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists auto_reply boolean not null default false,
  add column if not exists source_campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists strategy_id uuid references public.strategies(id) on delete set null,
  add column if not exists started_at timestamptz;
create index if not exists outreach_campaigns_sending_idx on public.outreach_campaigns (status) where send_mode = 'mailbox';

-- Approval and the sending account are set by the server only (after checking
-- who approves and that the mailbox is theirs). Members keep editing the rest.
create or replace function public.outreach_campaign_guard() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    if new.send_mode <> 'manual' or new.mailbox_id is not null or new.approved_at is not null or new.approved_by is not null or new.auto_reply or new.started_at is not null then
      raise exception 'sending settings are set by Yolias';
    end if;
    return new;
  end if;
  if new.send_mode is distinct from old.send_mode or new.mailbox_id is distinct from old.mailbox_id
     or new.approved_at is distinct from old.approved_at or new.approved_by is distinct from old.approved_by
     or new.auto_reply is distinct from old.auto_reply or new.started_at is distinct from old.started_at then
    raise exception 'sending settings are set by Yolias';
  end if;
  return new;
end $$;
drop trigger if exists outreach_campaign_guard on public.outreach_campaigns;
create trigger outreach_campaign_guard before insert or update on public.outreach_campaigns
  for each row execute function public.outreach_campaign_guard();

-- ── Outreach messages: provider ids, delivery, retries ──────────────────────
alter table public.outreach_messages
  add column if not exists provider_thread_id text check (provider_thread_id is null or length(provider_thread_id) <= 300),
  add column if not exists delivery_status text check (delivery_status is null or delivery_status in ('sent', 'bounced')),
  add column if not exists attempts int not null default 0 check (attempts between 0 and 20),
  add column if not exists next_attempt_at timestamptz;
create unique index if not exists outreach_messages_inbound_provider_uq on public.outreach_messages (workspace_id, provider_message_id)
  where direction = 'inbound' and provider_message_id is not null;
create index if not exists outreach_messages_thread_idx on public.outreach_messages (workspace_id, provider_thread_id) where provider_thread_id is not null;
create index if not exists outreach_messages_sendable_idx on public.outreach_messages (outreach_campaign_id, status) where direction = 'outbound' and status in ('draft', 'approved', 'failed');

-- ── Yolias AI as the control center ─────────────────────────────────────────
-- A request that isn't a search (e.g. "show me new replies", "pause the
-- campaign") opens a conversation with the agent instead of a Campaign Setup.
alter table public.strategies drop constraint if exists strategies_status_check;
alter table public.strategies add constraint strategies_status_check check (status in ('understanding', 'setup', 'ready', 'failed', 'chat'));

-- ── Company Knowledge: fields the website analysis fills (D-232) ─────────────
alter table public.workspace_knowledge
  add column if not exists value_proposition text check (value_proposition is null or length(value_proposition) <= 4000),
  add column if not exists contact text check (contact is null or length(contact) <= 2000);
