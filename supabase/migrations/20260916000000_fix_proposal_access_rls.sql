-- Fix: the "client reads own published proposal" policy on `proposals`
-- referenced `proposal_access` directly in an EXISTS subquery. Since
-- `proposal_access` also has row level security enabled (with no policy
-- granting `authenticated` any visibility into it — by design, clients
-- never query it directly), that subquery was itself being blocked by RLS
-- for the `authenticated` role, so the EXISTS check always evaluated to
-- false regardless of the actual data. A SECURITY DEFINER function owned
-- by the table owner bypasses RLS on `proposal_access` for this one
-- narrow, safe check (does auth.uid() own this proposal?), while the
-- table itself remains completely inaccessible to `authenticated` for
-- everything else.

create or replace function public.has_proposal_access(target_proposal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from proposal_access pa
    where pa.proposal_id = target_proposal_id
      and pa.auth_user_id = auth.uid()
  );
$$;

revoke all on function public.has_proposal_access(uuid) from public;
grant execute on function public.has_proposal_access(uuid) to authenticated;

drop policy if exists "client reads own published proposal" on proposals;
create policy "client reads own published proposal" on proposals
  for select to authenticated
  using (
    status in ('published', 'viewed', 'accepted', 'rejected', 'expired')
    and public.has_proposal_access(id)
  );
