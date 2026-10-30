-- Follow-ups on other channels (owner, 2026-10-30, D-268): a step can be an
-- email (sent from the mailbox), or a call, a WhatsApp message or a LinkedIn
-- message the member does themselves: Yolias writes the WhatsApp / LinkedIn
-- text and leaves a task on the conversation. The first step stays an email.
alter table public.outreach_steps
  add column if not exists kind text not null default 'email' check (kind in ('email', 'call', 'whatsapp', 'linkedin'));
