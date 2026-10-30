-- A/B test of the first email (owner, 2026-10-30, D-268): a campaign can hold a
-- second angle for the first message; half the leads get it. Each first
-- message records which version it is, so the campaign shows the reply rate
-- of each.
alter table public.outreach_campaigns
  add column if not exists variant_b text check (variant_b is null or length(variant_b) <= 1000);
alter table public.outreach_messages
  add column if not exists variant text check (variant is null or variant in ('a', 'b'));
