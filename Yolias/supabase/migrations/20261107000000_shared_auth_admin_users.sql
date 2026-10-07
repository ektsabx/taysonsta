-- One Supabase project for Yolias and Yolias Admin (owner decision,
-- 2026-10-07): both share auth.users. Admin staff (invited as role "staff")
-- and the Taysonsta website's proposal clients are not Yolias customers, so
-- they get no Yolias profile or workspace. Everyone else signs up as before.
create or replace function public.is_yolias_customer(u auth.users) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(u.raw_app_meta_data->>'role', u.raw_user_meta_data->>'role', '') not in ('staff', 'proposal_client');
$$;
revoke execute on function public.is_yolias_customer(auth.users) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv public.workspace_invitations;
  ws uuid;
begin
  if not public.is_yolias_customer(new) then
    return new;
  end if;

  select * into inv from public.workspace_invitations
    where email = lower(new.email) and accepted_at is null
    order by created_at desc limit 1;

  if inv.id is not null then
    ws := inv.workspace_id;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, inv.role)
      on conflict do nothing;
    update public.workspace_invitations set accepted_at = now() where id = inv.id;
  else
    insert into public.workspaces (created_by) values (new.id) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  end if;

  insert into public.profiles (id, email, workspace_id) values (new.id, lower(new.email), ws);
  return new;
end $$;
