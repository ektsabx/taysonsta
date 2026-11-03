-- D-275 (owner, 2026-11-02): roles like an ad account's. "admin" (everything,
-- with billing and the team), "member" (shown as Advertiser: the work) and the
-- new "analyst" (sees the results, changes nothing). The app checks the role
-- in every write action; this keeps an Analyst read-only in the database too.

alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check check (role in ('owner', 'admin', 'member', 'analyst'));
alter table public.workspace_invitations drop constraint if exists workspace_invitations_role_check;
alter table public.workspace_invitations add constraint workspace_invitations_role_check check (role in ('admin', 'member', 'analyst'));

-- A member who may change the workspace's work (everyone but an Analyst).
create or replace function public.can_edit_workspace(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid() and m.role <> 'analyst');
$$;

-- Restrictive: added to the existing policies (which still decide who is a
-- member), only for writes. Reading, Yolias AI conversations, saved views,
-- notifications and a person's own profile stay open to an Analyst.
do $$
declare t text;
begin
  foreach t in array array[
    'strategies', 'campaigns', 'prospects', 'companies', 'outreach_messages', 'agent_memories',
    'customer_profiles', 'sales_leads', 'lead_activities', 'lead_tasks', 'sales_meetings',
    'outreach_campaigns', 'outreach_steps', 'outreach_enrollments', 'inbox_threads',
    'audience_groups', 'audiences', 'audience_members'
  ] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'workspace_id') then
      execute format('drop policy if exists "editors insert" on public.%I', t);
      execute format('drop policy if exists "editors update" on public.%I', t);
      execute format('drop policy if exists "editors delete" on public.%I', t);
      execute format('create policy "editors insert" on public.%I as restrictive for insert to authenticated with check (public.can_edit_workspace(workspace_id))', t);
      execute format('create policy "editors update" on public.%I as restrictive for update to authenticated using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id))', t);
      execute format('create policy "editors delete" on public.%I as restrictive for delete to authenticated using (public.can_edit_workspace(workspace_id))', t);
    end if;
  end loop;
end $$;
