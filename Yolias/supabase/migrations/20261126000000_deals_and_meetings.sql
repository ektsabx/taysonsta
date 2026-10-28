-- Deals and meetings (owner, 2026-10-29). Additive only.
--  1. Two deal stages between the meeting and the outcome: proposal and
--     negotiation. "closed" stays the won stage (shown as Won).
--  2. A deal's expected close date, why it was lost, and when it closed.
--  3. Meeting reminders: an hour before, and "what happened?" after it.
--  4. Each member's booking link, sent when a lead asks for a meeting.

alter table public.sales_leads drop constraint if exists sales_leads_stage_check;
alter table public.sales_leads add constraint sales_leads_stage_check
  check (stage in ('new', 'interested', 'meeting_booked', 'meeting_completed', 'proposal', 'negotiation', 'closed', 'lost'));

alter table public.sales_leads
  add column if not exists expected_close_at date,
  add column if not exists lost_reason text check (lost_reason is null or length(lost_reason) <= 300),
  add column if not exists closed_at timestamptz;

grant update (expected_close_at, lost_reason) on public.sales_leads to authenticated;

-- closed_at follows the stage: set when a deal is won or lost, cleared when it is reopened.
create or replace function public.leads_closed_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    if new.stage in ('closed', 'lost') then new.closed_at := now();
    else new.closed_at := null; new.lost_reason := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists leads_closed_at on public.sales_leads;
create trigger leads_closed_at before update of stage on public.sales_leads
  for each row execute function public.leads_closed_at();

alter table public.sales_meetings
  add column if not exists reminded_at timestamptz,
  add column if not exists outcome_asked_at timestamptz;

create index if not exists sales_meetings_due_idx on public.sales_meetings (starts_at) where status = 'scheduled';

alter table public.profiles
  add column if not exists booking_url text check (booking_url is null or (booking_url ~ '^https://' and length(booking_url) <= 500));
