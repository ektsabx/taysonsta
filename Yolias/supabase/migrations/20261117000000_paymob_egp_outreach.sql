-- Owner brief 2026-10-19 (round after Kashier, D-236..): Paymob stays the
-- live gateway next to Kashier, Egypt sees EGP prices, Outreach and Inbox are
-- separated, custom IMAP/SMTP mailboxes, richer prospect data.

-- ── Egypt prices in EGP (D-237): the monthly EGP price of each plan; annual
-- is 20% less, rounded down to the pound (lib/pricing-math.ts). Null = Egypt
-- pays the USD price at the day's rate.
alter table public.plan_quotas add column if not exists price_egp numeric(12, 2) check (price_egp is null or price_egp > 0);
update public.plan_quotas set price_egp = 2499 where plan = 'pro' and price_egp is null;
update public.plan_quotas set price_egp = 4999 where plan = 'growth' and price_egp is null;
update public.plan_quotas set price_egp = 9999 where plan = 'scale' and price_egp is null;

-- ── Mailboxes: any IMAP/SMTP account (D-238). Its server settings and
-- password are the mailbox's Vault token (set_mailbox_token), like OAuth
-- refresh tokens; nothing secret in this table.
alter table public.mailboxes drop constraint if exists mailboxes_provider_check;
alter table public.mailboxes add constraint mailboxes_provider_check check (provider in ('gmail', 'outlook', 'imap', 'test'));

-- ── Inbox labels (D-239): each conversation is Interested, Not interested or
-- Needs follow-up. Set from the reply analysis, changeable by the member.
alter table public.inbox_threads add column if not exists label text check (label is null or label in ('interested', 'not_interested', 'follow_up'));

create or replace view public.crm_leads with (security_invoker = true) as
select l.*,
  t.status as thread_status,
  (t.last_inbound_at is not null and t.last_inbound_at > coalesce(t.last_read_at, '-infinity'::timestamptz)) as unread,
  (select m.starts_at from public.sales_meetings m where m.lead_id = l.id and m.status = 'scheduled' and m.starts_at >= now() - interval '2 hours' order by m.starts_at limit 1) as next_meeting_at,
  (select array_agg(oc.name order by e.created_at) from public.outreach_enrollments e join public.outreach_campaigns oc on oc.id = e.campaign_id where e.lead_id = l.id) as campaign_names,
  (select count(*) from public.lead_tasks k where k.lead_id = l.id and k.done_at is null)::int as open_tasks,
  co.domain as company_domain,
  coalesce(p.linkedin_url, co.linkedin_url) as linkedin_url,
  coalesce(p.phone, co.phone) as phone,
  p.title as job_title,
  coalesce(p.match_score, co.match_score) as match_score,
  t.last_message_at as thread_last_message_at,
  t.label as thread_label,
  t.last_inbound_at as thread_last_inbound_at
from public.sales_leads l
left join public.inbox_threads t on t.lead_id = l.id
left join public.prospects p on p.id = l.prospect_id
left join public.companies co on co.id = l.company_id;
grant select on public.crm_leads to authenticated;

-- ── Prospects: company revenue, website visitors and traffic geography
-- (owner brief 2026-10-19, D-240), filled when a data source provides them;
-- the table shows "—" otherwise. Funding was already stored.
alter table public.companies
  add column if not exists annual_revenue_usd numeric(16, 0) check (annual_revenue_usd is null or annual_revenue_usd >= 0),
  add column if not exists monthly_visits bigint check (monthly_visits is null or monthly_visits >= 0),
  add column if not exists traffic_geo text check (traffic_geo is null or length(traffic_geo) <= 200);

create or replace view public.prospect_items with (security_invoker = true) as
select
  'company:' || c.id::text as key,
  c.kind as item_type,
  c.id, c.workspace_id, c.campaign_id, cp.name as campaign_name, cp.origin as campaign_origin,
  c.name, null::text as title, c.id as company_id, c.name as company_name,
  c.domain, c.website, coalesce(c.industry, c.category) as industry, c.description,
  c.city, c.country, c.employee_count, c.funding_stage, c.hiring_roles,
  (c.hiring_roles > 0 or exists (select 1 from public.jobs j where j.company_id = c.id)) as hiring,
  (select string_agg(s, ' | ') from jsonb_array_elements_text(case when jsonb_typeof(c.signals) = 'array' then c.signals else '[]'::jsonb end) s) as signals_text,
  c.email, null::text as email_status, c.phone, c.whatsapp, c.linkedin_url,
  c.logo_url as image_url, c.match_score, c.saved_at, c.bookmarked_at, c.created_at, true as revealed,
  (select string_agg(p.title, ' | ') from public.prospects p where p.company_id = c.id and p.title is not null) as people_titles,
  c.people_found,
  c.funding_total_usd, c.annual_revenue_usd, c.monthly_visits, c.traffic_geo
from public.companies c
left join public.campaigns cp on cp.id = c.campaign_id
union all
select
  'person:' || p.id::text,
  'person',
  p.id, p.workspace_id, p.campaign_id, cp.name, cp.origin,
  p.full_name, p.title, p.company_id, co.name,
  co.domain, co.website, coalesce(co.industry, co.category), co.description,
  coalesce(p.city, co.city), coalesce(p.country, co.country), co.employee_count, co.funding_stage, co.hiring_roles,
  coalesce(co.hiring_roles > 0, false) as hiring,
  (select string_agg(s, ' | ') from jsonb_array_elements_text(case when jsonb_typeof(co.signals) = 'array' then co.signals else '[]'::jsonb end) s),
  p.email, p.email_status, p.phone, p.whatsapp, p.linkedin_url,
  p.photo_url, p.match_score, p.saved_at, p.bookmarked_at, p.created_at, p.revealed_at is not null,
  p.title, 0,
  co.funding_total_usd, co.annual_revenue_usd, co.monthly_visits, co.traffic_geo
from public.prospects p
left join public.companies co on co.id = p.company_id
left join public.campaigns cp on cp.id = p.campaign_id;

grant select on public.prospect_items to authenticated;
