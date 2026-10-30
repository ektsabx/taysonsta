-- Email only (owner, 2026-10-30, D-269): sending and conversations go through
-- email. Campaign steps lose their channel (call / WhatsApp / LinkedIn), and
-- the drafts Yolias had prepared for other channels are removed. Sent
-- messages of the past stay as the record of what happened.
delete from public.lead_tasks where dedupe_key like 'step:%' and done_at is null;
delete from public.outreach_messages where channel <> 'email' and status in ('draft', 'approved');
alter table public.outreach_steps drop column if exists kind;
