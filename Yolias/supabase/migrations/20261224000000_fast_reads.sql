-- Speed (owner, 2026-11-05): the campaign Breakdown and the Meetings cost line
-- are counted in the database instead of pulling rows into the app.
-- Called by the server after the session check. Service role only.

create or replace function public.campaign_breakdowns(p_ws uuid, p_from timestamptz, p_to timestamptz)
returns table (dim text, key text, contacted bigint, sent bigint, bounced bigint, replies bigint, interested bigint, meetings bigint, held bigint, opened bigint)
language sql stable
set search_path = public
as $$
  with e as (
    select distinct on (en.lead_id) en.lead_id, ag.name as grp, pr.title, upper(coalesce(pr.country, co.country)) as country, co.industry
    from public.outreach_enrollments en
    join public.sales_leads l on l.id = en.lead_id
    left join public.audience_groups ag on ag.id = en.audience_group_id
    left join public.prospects pr on pr.id = l.prospect_id
    left join public.companies co on co.id = l.company_id
    where en.workspace_id = p_ws
    order by en.lead_id, en.created_at desc
  ), v as (
    select distinct on (lead_id) lead_id, upper(variant) as variant
    from public.outreach_messages
    where workspace_id = p_ws and direction = 'outbound' and step_position = 1 and variant is not null and lead_id is not null
    order by lead_id, created_at desc
  ), ev as (
    select lead_id, 'out' as kind, sent_at as ts, coalesce(delivery_status = 'bounced', false) as flag, recipient_opened_at is not null as opened
    from public.outreach_messages
    where workspace_id = p_ws and outreach_campaign_id is not null and lead_id is not null and direction = 'outbound' and status = 'sent'
    union all
    select lead_id, 'in', coalesce(received_at, created_at), coalesce(analysis->>'kind' in ('interested', 'meeting_request'), false), false
    from public.outreach_messages
    where workspace_id = p_ws and outreach_campaign_id is not null and lead_id is not null and direction = 'inbound' and coalesce(analysis->>'kind', '') <> 'out_of_office'
    union all
    select lead_id, 'meeting', starts_at, status = 'completed', false
    from public.sales_meetings
    where workspace_id = p_ws and campaign_id is not null and lead_id is not null and status <> 'canceled'
  ), k as (
    select ev.*, d.dim, d.key
    from ev
    left join e on e.lead_id = ev.lead_id
    left join v on v.lead_id = ev.lead_id
    cross join lateral (values
      ('day', left(ev.ts::text, 10)), ('group', coalesce(e.grp, '–')), ('variant', coalesce(v.variant, '–')),
      ('country', coalesce(e.country, '–')), ('industry', coalesce(e.industry, '–')), ('title', coalesce(e.title, '–'))
    ) as d(dim, key)
    where (p_from is null or ev.ts >= p_from) and (p_to is null or ev.ts < p_to)
  )
  select dim, key,
    count(distinct lead_id) filter (where kind = 'out'),
    count(*) filter (where kind = 'out'),
    count(*) filter (where kind = 'out' and flag),
    count(distinct lead_id) filter (where kind = 'in'),
    count(distinct lead_id) filter (where kind = 'in' and flag),
    count(*) filter (where kind = 'meeting'),
    count(*) filter (where kind = 'meeting' and flag),
    count(distinct lead_id) filter (where kind = 'out' and opened)
  from k
  group by dim, key
  order by dim, case when dim = 'day' then key end, 3 desc
$$;

create or replace function public.campaign_cost_window(p_ws uuid, p_since timestamptz)
returns table (meetings bigint, prospects bigint)
language sql stable
set search_path = public
as $$
  select
    (select count(*) from public.sales_meetings where workspace_id = p_ws and campaign_id is not null and status <> 'canceled' and starts_at >= p_since),
    (select coalesce(sum(prospects), 0) from public.usage_ledger where workspace_id = p_ws and kind = 'consume' and created_at >= p_since)
$$;

revoke all on function public.campaign_breakdowns(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.campaign_cost_window(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.campaign_breakdowns(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.campaign_cost_window(uuid, timestamptz) to service_role;
