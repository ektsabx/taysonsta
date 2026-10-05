-- Two-factor authentication enforced by the database too (rule 31, D-117):
-- a session that signed in with the email link but hasn't entered its 2FA
-- code yet (aal1 while the user has a verified factor) can't read or write
-- customer data through the API, whatever the app does. Restrictive policies
-- are ANDed with the existing ones.

create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke execute on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'workspaces', 'workspace_members', 'workspace_invitations', 'profiles', 'strategies', 'campaigns', 'campaign_events',
    'campaign_runs', 'companies', 'prospects', 'invoices', 'subscription_events', 'usage_ledger', 'agent_messages',
    'agent_tool_calls', 'known_devices'
  ] loop
    execute format('drop policy if exists "second factor done" on public.%I', t);
    execute format('create policy "second factor done" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;
