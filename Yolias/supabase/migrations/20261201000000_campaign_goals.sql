-- Two campaign goals (owner, 2026-10-30, D-268): book a meeting, or buy on
-- the website. "Introduce the company" campaigns become meeting campaigns.
update public.outreach_campaigns set aim = 'meeting' where aim = 'introduce';
alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_aim_check;
alter table public.outreach_campaigns add constraint outreach_campaigns_aim_check check (aim in ('meeting', 'sell'));
