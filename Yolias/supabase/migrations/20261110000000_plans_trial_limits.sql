-- Plans, free trial and usage limits (owner brief 2026-10-12, D-183..D-186).
--
-- 1. A third paid plan, "scale" ($200, 4,000 prospects). The $0 plan is no
--    longer offered; workspaces already on Free keep what they have.
-- 2. Every plan carries three monthly limits, all configuration in
--    plan_quotas: prospects (as before), prepared emails and uploaded
--    contacts (CSV import).
-- 3. A 7-day free trial on the chosen plan (card required, taken by the
--    payment provider). During the trial the limits are the trial limits
--    (site_settings "yolias_trial", default 50 / 50 / 50). When the first
--    payment converts the trial, what the trial used is deducted from the
--    first paid month: usage in the conversion month already counts, and
--    usage from an earlier month is carried over (workspaces.trial_carry).
-- 4. Emails: an email counts when the member opens Yolias's message in their
--    own Gmail / Outlook / mail app (Yolias sends nothing, D-155). Enforced
--    by a trigger, atomically per workspace.
-- 5. CSV import: one "import" campaign per file, rows counted against the
--    uploaded-contacts limit, inserted in one transaction (import_contacts).
-- 6. One view over companies, local businesses and people for the unified
--    Prospects table (RLS of the underlying tables applies).
-- 7. Polar webhook deliveries are stored once per webhook-id (idempotency).
-- Additive: nothing is deleted.

-- ───────────────────────── 1. The "scale" plan ─────────────────────────

-- (Used by the functions below: an import campaign holds one CSV file.)
alter table public.campaigns add column if not exists origin text not null default 'search' check (origin in ('search', 'import'));

alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces add constraint workspaces_plan_check check (plan in ('free', 'pro', 'growth', 'scale'));
alter table public.subscription_events drop constraint if exists subscription_events_plan_check;
alter table public.subscription_events add constraint subscription_events_plan_check check (plan in ('free', 'pro', 'growth', 'scale'));
alter table public.invoices drop constraint if exists invoices_plan_check;
alter table public.invoices add constraint invoices_plan_check check (plan in ('pro', 'growth', 'scale'));
alter table public.payments drop constraint if exists payments_plan_check;
alter table public.payments add constraint payments_plan_check check (plan in ('pro', 'growth', 'scale'));
alter table public.plan_quotas drop constraint if exists plan_quotas_plan_check;
alter table public.plan_quotas add constraint plan_quotas_plan_check check (plan in ('free', 'pro', 'growth', 'scale'));

-- ───────────────────────── 2. Limits per plan ─────────────────────────

alter table public.plan_quotas
  add column if not exists emails_per_month int not null default 0 check (emails_per_month >= 0),
  add column if not exists contacts_per_month int not null default 0 check (contacts_per_month >= 0);

update public.plan_quotas set emails_per_month = 50, contacts_per_month = 50, updated_by = 'owner brief 2026-10-12', updated_at = now() where plan = 'free';
update public.plan_quotas set emails_per_month = 1000, contacts_per_month = 1000, updated_by = 'owner brief 2026-10-12', updated_at = now() where plan = 'pro';
update public.plan_quotas set emails_per_month = 2000, contacts_per_month = 2000, updated_by = 'owner brief 2026-10-12', updated_at = now() where plan = 'growth';
insert into public.plan_quotas (plan, price_usd, prospects_per_month, emails_per_month, contacts_per_month, updated_by)
values ('scale', 200, 4000, 4000, 4000, 'owner brief 2026-10-12')
on conflict (plan) do nothing;

-- ───────────────────────── 3. Trial state ─────────────────────────

alter table public.workspaces drop constraint if exists workspaces_subscription_status_check;
alter table public.workspaces add constraint workspaces_subscription_status_check
  check (subscription_status in ('none', 'trialing', 'active', 'test', 'canceled', 'past_due'));
alter table public.workspaces
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  -- {period: 'YYYY-MM-01', prospects, emails, contacts}: trial usage from an
  -- earlier month, deducted from the month the trial converted in.
  add column if not exists trial_carry jsonb,
  -- Which provider bills the workspace (Egypt → Paymob, elsewhere → Polar).
  add column if not exists billing_provider text check (billing_provider is null or billing_provider in ('paymob', 'polar')),
  add column if not exists polar_customer_id text,
  add column if not exists polar_subscription_id text;

alter table public.subscription_events drop constraint if exists subscription_events_status_check;
alter table public.subscription_events add constraint subscription_events_status_check
  check (status in ('activated', 'changed', 'canceled', 'resumed', 'ended', 'renewed', 'past_due', 'trial_started', 'trial_converted', 'trial_ended'));

insert into public.site_settings (key, value)
values ('yolias_trial', '{"days": 7, "prospects": 50, "emails": 50, "contacts": 50}'::jsonb)
on conflict (key) do nothing;

-- Trial limits (configuration; missing values use the defaults).
create or replace function public.trial_limits()
returns table (days int, prospects int, emails int, contacts int)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((v->>'days')::int, 7), coalesce((v->>'prospects')::int, 50), coalesce((v->>'emails')::int, 50), coalesce((v->>'contacts')::int, 50)
  from (select coalesce((select value from public.site_settings where key = 'yolias_trial'), '{}'::jsonb) as v) s;
$$;

-- Trial usage of earlier months: what a trial that spans a month boundary
-- already used before the current month (so a new month never refills it).
create or replace function public.trial_used_before(p_ws uuid, p_kind text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with w as (select trial_started_at as ts from public.workspaces where id = p_ws),
       p as (select public.usage_period_start() as ps)
  select case p_kind
    when 'prospects' then (
      select coalesce(sum(u.prospects), 0)::int from public.usage_ledger u, w, p
      where u.workspace_id = p_ws and u.kind = 'consume' and coalesce(u.reason, '') <> 'extra'
        and u.created_at >= w.ts and u.period_start < p.ps)
    when 'emails' then (
      select count(*)::int from public.outreach_messages m, w, p
      where m.workspace_id = p_ws and m.channel = 'email' and m.opened_at >= w.ts and m.opened_at < p.ps::timestamptz)
    else (
      select coalesce(sum(c.prospects_found), 0)::int from public.campaigns c, w, p
      where c.workspace_id = p_ws and c.origin = 'import' and c.created_at >= w.ts and c.created_at < p.ps::timestamptz)
  end;
$$;

-- What a converted trial carries into this month for one kind (0 otherwise).
create or replace function public.trial_carry_for(p_ws uuid, p_kind text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (w.trial_carry->>p_kind)::int from public.workspaces w
    where w.id = p_ws and w.trial_carry->>'period' = public.usage_period_start()::text
  ), 0);
$$;

-- ───────────────────────── 4. Prospects quota with the trial ─────────────────────────
-- Same as 20261106000100 (extra prospects never expire), with the quota now:
--   trialing → trial prospects − trial use in earlier months
--   free     → the one-time gift (D-138)
--   paid     → the plan's monthly prospects − a converted trial's carry-over

create or replace function public.usage_summary(p_ws uuid)
returns table (period_start date, quota int, granted int, allowance int, consumed int, reserved int, available int)
language sql
stable
security definer
set search_path = public
as $$
  with p as (select public.usage_period_start() as ps),
  q as (
    select case
      when w.subscription_status = 'trialing'
      then greatest((select prospects from public.trial_limits()) - public.trial_used_before(p_ws, 'prospects'), 0)
      when w.plan = 'free'
      then greatest(coalesce(pq.prospects_per_month, 0) - (
        select coalesce(sum(u.prospects), 0)::int from public.usage_ledger u, p
        where u.workspace_id = p_ws and u.kind = 'consume' and coalesce(u.reason, '') <> 'extra' and u.period_start < p.ps
      ), 0)
      else greatest(coalesce(pq.prospects_per_month, 0) - public.trial_carry_for(p_ws, 'prospects'), 0) end as quota
    from public.workspaces w left join public.plan_quotas pq on pq.plan = w.plan
    where w.id = p_ws
  ),
  l as (
    select
      coalesce(sum(prospects) filter (where kind in ('grant', 'adjust') and coalesce(reason, '') not like 'prospect_pack:%'), 0)::int as other_grants,
      coalesce(sum(prospects) filter (where kind = 'consume'), 0)::int as consumed,
      coalesce(sum(prospects) filter (where kind = 'consume' and coalesce(reason, '') <> 'extra'), 0)::int as base_used,
      coalesce(sum(prospects) filter (where kind = 'consume' and reason = 'extra'), 0)::int as extra_used_now
    from public.usage_ledger, p
    where workspace_id = p_ws and usage_ledger.period_start = p.ps
  ),
  x as (
    select greatest(
      coalesce(sum(prospects) filter (where kind = 'grant' and reason like 'prospect_pack:%'), 0)
      - coalesce(sum(prospects) filter (where kind = 'consume' and reason = 'extra'), 0), 0)::int as extra_left
    from public.usage_ledger where workspace_id = p_ws
  ),
  r as (
    select coalesce(sum(greatest(held, 0)), 0)::int as reserved
    from (
      select sum(case kind when 'reserve' then prospects when 'consume' then -prospects when 'release' then -prospects else 0 end) as held
      from public.usage_ledger, p
      where workspace_id = p_ws and usage_ledger.period_start = p.ps and campaign_id is not null
      group by campaign_id
    ) x
  )
  select p.ps,
         q.quota,
         l.other_grants + l.extra_used_now + x.extra_left,
         q.quota + l.other_grants + l.extra_used_now + x.extra_left,
         l.consumed,
         r.reserved,
         greatest(greatest(q.quota + l.other_grants - l.base_used, 0) + x.extra_left - r.reserved, 0)
  from p, q, l, x, r;
$$;

-- ───────────────────────── 5. Emails and uploaded contacts ─────────────────────────

create index if not exists campaigns_import_idx on public.campaigns (workspace_id, created_at) where origin = 'import';
create index if not exists outreach_email_opened_idx on public.outreach_messages (workspace_id, opened_at) where channel = 'email' and opened_at is not null;

-- Monthly limit of a kind ('emails' | 'contacts') for a workspace, trial-aware.
create or replace function public.monthly_limit(p_ws uuid, p_kind text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when w.subscription_status = 'trialing' then greatest(
      (select case p_kind when 'emails' then emails else contacts end from public.trial_limits()) - public.trial_used_before(p_ws, p_kind), 0)
    else greatest(coalesce(case p_kind when 'emails' then pq.emails_per_month else pq.contacts_per_month end, 0) - public.trial_carry_for(p_ws, p_kind), 0)
  end
  from public.workspaces w left join public.plan_quotas pq on pq.plan = w.plan
  where w.id = p_ws;
$$;

-- This month's use of a kind.
create or replace function public.monthly_used(p_ws uuid, p_kind text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case p_kind
    when 'emails' then (select count(*)::int from public.outreach_messages
      where workspace_id = p_ws and channel = 'email' and opened_at >= public.usage_period_start()::timestamptz)
    else (select coalesce(sum(prospects_found), 0)::int from public.campaigns
      where workspace_id = p_ws and origin = 'import' and created_at >= public.usage_period_start()::timestamptz)
  end;
$$;

-- Emails and uploaded contacts for the Usage tab: limit, used, available.
create or replace function public.limits_summary(p_ws uuid)
returns table (period_start date, emails_limit int, emails_used int, contacts_limit int, contacts_used int)
language sql
stable
security definer
set search_path = public
as $$
  select public.usage_period_start(),
         public.monthly_limit(p_ws, 'emails'), public.monthly_used(p_ws, 'emails'),
         public.monthly_limit(p_ws, 'contacts'), public.monthly_used(p_ws, 'contacts');
$$;

-- An email counts the first time it is opened in a month. Serialised per
-- workspace, so concurrent opens can never pass the limit.
create or replace function public.outreach_email_limit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.channel <> 'email' or new.opened_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.opened_at is not null
     and public.usage_period_start(old.opened_at) = public.usage_period_start(new.opened_at) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('emails:' || new.workspace_id::text, 0));
  if public.monthly_used(new.workspace_id, 'emails') >= public.monthly_limit(new.workspace_id, 'emails') then
    raise exception 'email_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists outreach_email_limit on public.outreach_messages;
create trigger outreach_email_limit before insert or update of opened_at on public.outreach_messages
  for each row execute function public.outreach_email_limit();

-- CSV import (owner brief 2026-10-12): rows already normalised by the server
-- ({kind: company|local_business|person, name, title, company, domain,
-- website, email, phone, linkedin_url, industry, city, country,
-- employee_count}). One campaign per file (origin 'import'), everything put
-- in Prospects, the member's own data (contacts shown, no prospects charged).
-- Returns {ok, imported, campaign_id} or {ok: false, error, available}.
create or replace function public.import_contacts(p_ws uuid, p_name text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n int := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  v_left int;
  v_campaign uuid;
  v_row jsonb;
  v_company uuid;
  v_domain text;
  v_cname text;
  v_kind text;
begin
  if v_user is null or not public.is_workspace_member(p_ws) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_n = 0 or v_n > 5000 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('contacts:' || p_ws::text, 0));
  v_left := greatest(public.monthly_limit(p_ws, 'contacts') - public.monthly_used(p_ws, 'contacts'), 0);
  if v_n > v_left then
    return jsonb_build_object('ok', false, 'error', 'limit', 'available', v_left);
  end if;

  insert into public.campaigns (workspace_id, created_by, name, criteria, quota, status, search_type, origin, prospects_found, started_at, completed_at)
  values (p_ws, v_user, left(coalesce(nullif(trim(p_name), ''), 'CSV import'), 200), '{}'::jsonb, greatest(least(v_n, 10000), 1), 'completed', 'companies', 'import', v_n, now(), now())
  returning id into v_campaign;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_kind := coalesce(v_row->>'kind', 'company');
    v_domain := nullif(lower(trim(v_row->>'domain')), '');
    if v_kind in ('company', 'local_business') then
      insert into public.companies (workspace_id, campaign_id, name, kind, domain, website, email, phone, linkedin_url, industry, category, city, country, employee_count, source, saved_at, delivered_at, provenance)
      values (p_ws, v_campaign, left(v_row->>'name', 300), v_kind, v_domain, nullif(v_row->>'website', ''), nullif(v_row->>'email', ''), nullif(v_row->>'phone', ''),
              nullif(v_row->>'linkedin_url', ''), case when v_kind = 'company' then nullif(v_row->>'industry', '') end, case when v_kind = 'local_business' then nullif(v_row->>'industry', '') end,
              nullif(v_row->>'city', ''), nullif(upper(v_row->>'country'), ''), nullif(v_row->>'employee_count', '')::int, 'csv_import', now(), now(),
              jsonb_build_array(jsonb_build_object('field', '*', 'source', 'csv_import', 'at', now(), 'confidence', null)))
      on conflict (campaign_id, lower(domain)) where domain is not null do nothing;
    else
      v_company := null;
      v_cname := nullif(trim(v_row->>'company'), '');
      if v_domain is not null then
        select id into v_company from public.companies where campaign_id = v_campaign and lower(domain) = v_domain limit 1;
      elsif v_cname is not null then
        select id into v_company from public.companies where campaign_id = v_campaign and domain is null and lower(name) = lower(v_cname) limit 1;
      end if;
      if v_company is null and (v_cname is not null or v_domain is not null) then
        insert into public.companies (workspace_id, campaign_id, name, kind, domain, industry, city, country, employee_count, source, delivered_at, provenance)
        values (p_ws, v_campaign, left(coalesce(v_cname, v_domain), 300), 'company', v_domain, nullif(v_row->>'industry', ''), nullif(v_row->>'city', ''),
                nullif(upper(v_row->>'country'), ''), nullif(v_row->>'employee_count', '')::int, 'csv_import', now(),
                jsonb_build_array(jsonb_build_object('field', '*', 'source', 'csv_import', 'at', now(), 'confidence', null)))
        returning id into v_company;
      end if;
      insert into public.prospects (workspace_id, campaign_id, company_id, full_name, title, email, email_status, phone, linkedin_url, city, country, source, saved_at, revealed_at, revealed_by, provenance)
      values (p_ws, v_campaign, v_company, left(v_row->>'name', 300), nullif(v_row->>'title', ''), nullif(v_row->>'email', ''),
              case when nullif(v_row->>'email', '') is null then 'unknown' else 'found' end, nullif(v_row->>'phone', ''), nullif(v_row->>'linkedin_url', ''),
              nullif(v_row->>'city', ''), nullif(upper(v_row->>'country'), ''), 'csv_import', now(), now(), v_user,
              jsonb_build_array(jsonb_build_object('field', '*', 'source', 'csv_import', 'at', now(), 'confidence', null)));
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'imported', v_n, 'campaign_id', v_campaign);
end $$;

revoke execute on function public.import_contacts(uuid, text, jsonb) from public, anon;
grant execute on function public.import_contacts(uuid, text, jsonb) to authenticated;
revoke execute on function public.trial_limits() from public, anon, authenticated;
revoke execute on function public.trial_used_before(uuid, text) from public, anon, authenticated;
revoke execute on function public.trial_carry_for(uuid, text) from public, anon, authenticated;
revoke execute on function public.monthly_limit(uuid, text) from public, anon, authenticated;
revoke execute on function public.monthly_used(uuid, text) from public, anon, authenticated;
revoke execute on function public.limits_summary(uuid) from public, anon, authenticated;
grant execute on function public.trial_limits() to service_role;
grant execute on function public.trial_used_before(uuid, text) to service_role;
grant execute on function public.trial_carry_for(uuid, text) to service_role;
grant execute on function public.monthly_limit(uuid, text) to service_role;
grant execute on function public.monthly_used(uuid, text) to service_role;
grant execute on function public.limits_summary(uuid) to service_role;

-- Converts a trial into the paid plan once: records what the trial used in
-- earlier months (deducted from this month, the first paid one).
create or replace function public.convert_trial(p_ws uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carry jsonb;
begin
  perform 1 from public.workspaces where id = p_ws and subscription_status = 'trialing' for update;
  if not found then return false; end if;
  v_carry := jsonb_build_object(
    'period', public.usage_period_start()::text,
    'prospects', public.trial_used_before(p_ws, 'prospects'),
    'emails', public.trial_used_before(p_ws, 'emails'),
    'contacts', public.trial_used_before(p_ws, 'contacts'));
  update public.workspaces set trial_carry = v_carry where id = p_ws;
  return true;
end $$;
revoke execute on function public.convert_trial(uuid) from public, anon, authenticated;
grant execute on function public.convert_trial(uuid) to service_role;

-- ───────────────────────── 6. Unified Prospects view ─────────────────────────
-- security_invoker: the member's RLS on companies / prospects / campaigns applies.

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
  c.people_found
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
  p.title, 0
from public.prospects p
left join public.companies co on co.id = p.company_id
left join public.campaigns cp on cp.id = p.campaign_id;

grant select on public.prospect_items to authenticated;

-- ───────────────────────── 7. Polar webhook deliveries ─────────────────────────

create table if not exists public.billing_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('polar')),
  webhook_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  note text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, webhook_id)
);
alter table public.billing_webhook_events enable row level security;  -- service role only

-- ───────────────────────── Affiliates: 15% and the new plan ─────────────────────────
-- A new program version (versions are append-only); only when the current
-- one is still the initial 20%.
insert into public.affiliate_program_versions (settings, terms_version, terms_text, note)
select jsonb_set(jsonb_set(v.settings, '{commission,percent_bps}', '1500'), '{eligible,plans}', '["pro", "growth", "scale"]'),
       v.terms_version, v.terms_text, 'Owner brief 2026-10-12: 15% commission, Scale plan eligible'
from public.affiliate_program_versions v
where v.id = (select max(id) from public.affiliate_program_versions)
  and (v.settings->'commission'->>'percent_bps')::int = 2000;
