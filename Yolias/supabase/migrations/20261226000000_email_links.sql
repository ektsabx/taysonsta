-- Link clicks (owner, 2026-11-05): every link Yolias puts in a campaign email
-- goes through yolias.com/l/<code>, so a click is counted for the person and
-- the campaign before they reach the page. Service role only.
create table if not exists public.email_links (
  code text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  url text not null,
  clicks integer not null default 0,
  first_click_at timestamptz,
  last_click_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lead_id, url)
);
create index if not exists email_links_campaign_idx on public.email_links (campaign_id) where first_click_at is not null;
alter table public.email_links enable row level security;

-- One step per click, safe when two clicks land together.
create or replace function public.email_link_click(p_code text)
returns text
language sql
set search_path = public
as $$
  update public.email_links
  set clicks = clicks + 1, first_click_at = coalesce(first_click_at, now()), last_click_at = now()
  where code = p_code
  returning url;
$$;
revoke all on function public.email_link_click(text) from public, anon, authenticated;
grant execute on function public.email_link_click(text) to service_role;
