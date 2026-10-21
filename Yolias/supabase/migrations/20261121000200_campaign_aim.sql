-- What an outreach campaign is for (owner 2026-10-21, D-253): book meetings,
-- introduce the company, or sell directly (a sign-up / purchase link, no
-- meeting). The agent writes the emails and answers replies for that aim, and
-- offers cta_url (a booking page for meetings, a sign-up / purchase page for
-- sales). Additive: existing campaigns keep working as "meeting" without a link.
alter table public.outreach_campaigns
  add column if not exists aim text not null default 'meeting' check (aim in ('meeting', 'introduce', 'sell')),
  add column if not exists cta_url text check (cta_url is null or (length(cta_url) <= 500 and cta_url ~* '^https?://'));
