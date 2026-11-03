-- D-275 (owner, 2026-11-02): each campaign's own insights, rebuilt daily by
-- the learning step (lib/agent-core/learning.ts): what brought results in
-- this campaign, shown as "Yolias learned…" on its page. Written by the
-- server only; members of the workspace read it.
create table if not exists public.campaign_insights (
  campaign_id uuid primary key references public.outreach_campaigns(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);
create index if not exists campaign_insights_ws_idx on public.campaign_insights (workspace_id);
alter table public.campaign_insights enable row level security;
drop policy if exists "members read campaign insights" on public.campaign_insights;
create policy "members read campaign insights" on public.campaign_insights for select using (public.is_workspace_member(workspace_id));
