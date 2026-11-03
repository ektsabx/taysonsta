-- Audit plan, phase 5 (2026-11-03): the AI cost of each campaign's messages
-- (writing and replies) next to its results in Admin → Campaign operations.
drop function if exists public.admin_campaign_ops(timestamptz);
create or replace function public.admin_campaign_ops(p_since timestamptz)
returns table (
  campaign_id uuid, workspace_id uuid, workspace_name text, name text, status text, objective text,
  created_at timestamptz, approved_at timestamptz, mailbox_email text, daily_limit int,
  sent bigint, bounced bigint, failed bigint, replies bigint, interested bigint, meetings bigint, last_sent_at timestamptz, ai_cost_usd numeric
)
language sql stable
set search_path = public
as $$
  with m as (
    select outreach_campaign_id as cid,
      count(*) filter (where direction = 'outbound' and status = 'sent' and sent_at >= p_since) as sent,
      count(*) filter (where direction = 'outbound' and delivery_status = 'bounced' and sent_at >= p_since) as bounced,
      count(*) filter (where direction = 'outbound' and status = 'failed' and updated_at >= p_since) as failed,
      count(distinct lead_id) filter (where direction = 'inbound' and coalesce(received_at, created_at) >= p_since) as replies,
      count(distinct lead_id) filter (where direction = 'inbound' and coalesce(received_at, created_at) >= p_since and analysis->>'kind' in ('interested', 'meeting_request')) as interested,
      max(sent_at) filter (where direction = 'outbound' and status = 'sent') as last_sent_at,
      coalesce(sum(cost_usd) filter (where created_at >= p_since), 0) as ai_cost_usd
    from public.outreach_messages
    where outreach_campaign_id is not null
    group by outreach_campaign_id
  ), mt as (
    select campaign_id as cid, count(*) as meetings
    from public.sales_meetings
    where campaign_id is not null and status <> 'canceled' and created_at >= p_since
    group by campaign_id
  )
  select c.id, c.workspace_id, w.name, c.name, c.status, coalesce(c.objective, 'meetings'),
    c.created_at, c.approved_at, mb.email, c.daily_limit,
    coalesce(m.sent, 0), coalesce(m.bounced, 0), coalesce(m.failed, 0), coalesce(m.replies, 0), coalesce(m.interested, 0), coalesce(mt.meetings, 0), m.last_sent_at, coalesce(m.ai_cost_usd, 0)
  from public.outreach_campaigns c
  join public.workspaces w on w.id = c.workspace_id
  left join public.mailboxes mb on mb.id = c.mailbox_id
  left join m on m.cid = c.id
  left join mt on mt.cid = c.id
  where c.status <> 'archived'
$$;

revoke all on function public.admin_campaign_ops(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_campaign_ops(timestamptz) to service_role;
