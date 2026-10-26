-- Email sending rules (D-256, after AgentSDR Settings → Email → Sending rules):
-- each mailbox sends on its own days and hours, in its time zone, with a
-- random gap between two emails; the workspace holds the defaults new
-- mailboxes start with. Additive only.

alter table public.mailboxes
  add column send_days smallint[] not null default '{1,2,3,4,5}' check (send_days <@ '{0,1,2,3,4,5,6}'::smallint[]), -- 0 = Sunday
  add column send_start text not null default '09:00' check (send_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column send_end text not null default '18:00' check (send_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column time_zone text,          -- null: the workspace's sending rules, then the member's own time zone
  add column next_send_at timestamptz; -- the random gap: no campaign email leaves this mailbox before it

-- {daily_per_mailbox, gap_min, gap_max, days, start, end, timezone}; missing keys use the defaults in lib/outreach/sending-rules.ts.
alter table public.workspaces add column sending_rules jsonb not null default '{}'::jsonb;

-- Fair turns for the sending worker: it takes the campaigns that waited
-- longest first, so more than one tick's worth of active campaigns all send.
alter table public.outreach_campaigns add column dispatched_at timestamptz;
create index outreach_campaigns_dispatch on public.outreach_campaigns (dispatched_at nulls first) where status = 'active' and send_mode = 'mailbox';
-- A worker turn isn't an edit: updated_at moves only when something else changed.
create or replace function public.outreach_campaigns_touch() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'dispatched_at' - 'updated_at') is distinct from (to_jsonb(old) - 'dispatched_at' - 'updated_at') then
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger outreach_campaigns_updated_at on public.outreach_campaigns;
create trigger outreach_campaigns_updated_at before update on public.outreach_campaigns
  for each row execute function public.outreach_campaigns_touch();
