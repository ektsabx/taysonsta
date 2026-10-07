-- MVP prospect actions (owner decision, 2026-10-07): no Outreach module yet.
-- Yolias writes the message (email or LinkedIn) and the member opens it in
-- their own Gmail / Outlook / mail app or on LinkedIn; Yolias sends nothing.
-- outreach_messages keeps every prepared message (channel, text, who opened it,
-- where and when), so a later Outreach module (sending, sequences, replies) can
-- build on the same prospects and messages. Mailboxes and the sending columns
-- stay unused until then.
alter table public.outreach_messages drop constraint if exists outreach_messages_channel_check;
alter table public.outreach_messages add constraint outreach_messages_channel_check check (channel in ('email', 'linkedin'));
alter table public.outreach_messages
  add column opened_at timestamptz,
  add column opened_via text check (opened_via is null or opened_via in ('gmail', 'outlook', 'mail_app', 'linkedin', 'copy'));

comment on column public.outreach_messages.opened_at is 'When the member last opened the message in their own email app or LinkedIn (Yolias does not send in the MVP).';
create index if not exists outreach_messages_prospect_idx on public.outreach_messages (prospect_id, channel, created_at desc);
