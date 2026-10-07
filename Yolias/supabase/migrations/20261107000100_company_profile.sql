-- Company profile (owner request, 2026-10-07): besides name, website and
-- products and services (offering), onboarding and Settings → Organization
-- collect the industry, the ideal customer profile and the target markets, so
-- Yolias AI knows the business better when it understands searches, chats
-- and writes outreach. Written by the server only (no client write policy).
alter table public.workspaces
  add column industry text check (industry is null or char_length(industry) <= 120),
  add column ideal_customer text check (ideal_customer is null or char_length(ideal_customer) <= 2000),
  add column target_markets text check (target_markets is null or char_length(target_markets) <= 300);

comment on column public.workspaces.offering is 'Products and services: what the company sells.';
comment on column public.workspaces.ideal_customer is 'Who usually buys from the company (default ICP when a search does not say).';
comment on column public.workspaces.target_markets is 'Countries or regions the company sells to, comma separated.';
