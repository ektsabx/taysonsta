-- Audit (2026-11-03): Yolias Admin's Campaign operations and Deliverability
-- pages. Every campaign / mailbox across all accounts with its sending and
-- results for a period, counted in the database. Service role only.

create or replace function public.admin_campaign_ops(p_since timestamptz)
returns table (
  campaign_id uuid, workspace_id uuid, workspace_name text, name text, status text, objective text,
  created_at timestamptz, approved_at timestamptz, mailbox_email text, daily_limit int,
  sent bigint, bounced bigint, failed bigint, replies bigint, interested bigint, meetings bigint, last_sent_at timestamptz
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
      max(sent_at) filter (where direction = 'outbound' and status = 'sent') as last_sent_at
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
    coalesce(m.sent, 0), coalesce(m.bounced, 0), coalesce(m.failed, 0), coalesce(m.replies, 0), coalesce(m.interested, 0), coalesce(mt.meetings, 0), m.last_sent_at
  from public.outreach_campaigns c
  join public.workspaces w on w.id = c.workspace_id
  left join public.mailboxes mb on mb.id = c.mailbox_id
  left join m on m.cid = c.id
  left join mt on mt.cid = c.id
  where c.status <> 'archived'
$$;

create or replace function public.admin_deliverability(p_since timestamptz)
returns table (
  mailbox_id uuid, email text, provider text, status text, workspace_name text, daily_limit int,
  sent bigint, bounced bigint, replies bigint, unsubscribed bigint, last_error text, last_synced_at timestamptz
)
language sql stable
set search_path = public
as $$
  with m as (
    select mailbox_id as mid,
      count(*) filter (where direction = 'outbound' and status = 'sent' and sent_at >= p_since) as sent,
      count(*) filter (where direction = 'outbound' and delivery_status = 'bounced' and sent_at >= p_since) as bounced,
      count(distinct lead_id) filter (where direction = 'inbound' and coalesce(received_at, created_at) >= p_since) as replies
    from public.outreach_messages
    where mailbox_id is not null
    group by mailbox_id
  ), u as (
    select om.mailbox_id as mid, count(distinct l.id) as unsubscribed
    from public.sales_leads l
    join public.outreach_messages om on om.lead_id = l.id and om.direction = 'outbound' and om.mailbox_id is not null
    where l.unsubscribed_at >= p_since
    group by om.mailbox_id
  )
  select mb.id, mb.email, mb.provider, mb.status, w.name, mb.daily_limit,
    coalesce(m.sent, 0), coalesce(m.bounced, 0), coalesce(m.replies, 0), coalesce(u.unsubscribed, 0), mb.last_error, mb.last_synced_at
  from public.mailboxes mb
  join public.workspaces w on w.id = mb.workspace_id
  left join m on m.mid = mb.id
  left join u on u.mid = mb.id
$$;

revoke all on function public.admin_campaign_ops(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_deliverability(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_campaign_ops(timestamptz) to service_role;
grant execute on function public.admin_deliverability(timestamptz) to service_role;
