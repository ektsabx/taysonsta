-- Support redesign (docs/bos/37 §3): spam folder for conversations. A flag,
-- not a status, so restoring returns the conversation to its real status.
alter table conversations
  add column if not exists spam_at timestamptz,
  add column if not exists spam_by uuid references auth.users(id) on delete set null,
  add column if not exists spam_reason text check (spam_reason is null or length(spam_reason) <= 500);
create index if not exists conversations_spam_idx on conversations (spam_at desc) where spam_at is not null;
