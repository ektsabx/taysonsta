-- Owner requests, 2026-10-07 (D-159 … D-161).
--
-- 1) Saved: a member saves (bookmarks) people, companies and local businesses;
--    they're listed under Prospects → Saved. Separate from saved_at, which
--    means "in Prospects" (Save to Prospects hands a search's results over).
alter table public.prospects add column bookmarked_at timestamptz;
alter table public.companies add column bookmarked_at timestamptz;
grant update (bookmarked_at) on public.companies to authenticated;
create index prospects_bookmarked_idx on public.prospects (workspace_id, bookmarked_at desc) where bookmarked_at is not null;
create index companies_bookmarked_idx on public.companies (workspace_id, bookmarked_at desc) where bookmarked_at is not null;

-- 2) Social profiles of companies, local businesses and people: Facebook,
--    Instagram and a WhatsApp number (digits, optional +). Filled by the data
--    sources and from the company's own website; never invented.
alter table public.companies
  add column facebook_url text check (facebook_url is null or (facebook_url ~ '^https://' and length(facebook_url) <= 1000)),
  add column instagram_url text check (instagram_url is null or (instagram_url ~ '^https://' and length(instagram_url) <= 1000)),
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{6,20}$');
alter table public.prospects
  add column facebook_url text check (facebook_url is null or (facebook_url ~ '^https://' and length(facebook_url) <= 1000)),
  add column instagram_url text check (instagram_url is null or (instagram_url ~ '^https://' and length(instagram_url) <= 1000)),
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{6,20}$');

-- 3) Prepared messages: WhatsApp, Facebook and Instagram besides email and
--    LinkedIn (the member still sends them from their own app); any language;
--    the email's objective, tone, call to action and the facts it used.
alter table public.outreach_messages drop constraint if exists outreach_messages_channel_check;
alter table public.outreach_messages add constraint outreach_messages_channel_check
  check (channel in ('email', 'linkedin', 'whatsapp', 'facebook', 'instagram'));
alter table public.outreach_messages drop constraint if exists outreach_messages_language_check;
alter table public.outreach_messages add constraint outreach_messages_language_check
  check (language ~ '^[a-z]{2,3}$');
alter table public.outreach_messages drop constraint if exists outreach_messages_opened_via_check;
alter table public.outreach_messages add constraint outreach_messages_opened_via_check
  check (opened_via is null or opened_via in ('gmail', 'outlook', 'mail_app', 'linkedin', 'whatsapp', 'facebook', 'instagram', 'copy'));
alter table public.outreach_messages
  add column objective text check (objective is null or objective in ('introduction', 'sales', 'meeting', 'follow_up', 'partnership', 'referral')),
  add column tone text check (tone is null or tone in ('conservative', 'direct', 'friendly')),
  add column cta text check (cta is null or length(cta) <= 300),
  add column personalization jsonb not null default '[]'::jsonb;

comment on column public.outreach_messages.personalization is 'The verified facts about the prospect the message used (never invented).';

-- 4) A message can go to a company or local business (its WhatsApp, Facebook
--    page or Instagram) as well as to a person.
alter table public.outreach_messages alter column prospect_id drop not null;
alter table public.outreach_messages add column company_id uuid references public.companies(id) on delete cascade;
alter table public.outreach_messages add constraint outreach_messages_target_check check (prospect_id is not null or company_id is not null);
create index outreach_messages_company_idx on public.outreach_messages (company_id, channel, created_at desc) where company_id is not null;
