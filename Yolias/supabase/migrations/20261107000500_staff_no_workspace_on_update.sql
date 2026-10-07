-- Shared auth.users (D-150): Supabase writes an account's app_metadata (where
-- the Admin puts role "staff") in an update right after creating it, so the
-- sign-up trigger can't see the role yet and creates a Yolias workspace. When
-- the account turns out to be staff or a proposal client, remove that
-- workspace again — only if it is still new and untouched (no searches,
-- campaigns, payments or other members).
create or replace function public.drop_workspace_of_non_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
begin
  if public.is_yolias_customer(new) or not public.is_yolias_customer(old) then
    return new;
  end if;
  select p.workspace_id into ws from public.profiles p where p.id = new.id;
  if ws is not null
    and exists (select 1 from public.workspaces w where w.id = ws and w.created_by = new.id and w.created_at > now() - interval '1 day')
    and not exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id <> new.id)
    and not exists (select 1 from public.strategies s where s.workspace_id = ws)
    and not exists (select 1 from public.campaigns c where c.workspace_id = ws)
    and not exists (select 1 from public.payments pay where pay.workspace_id = ws)
  then
    delete from public.profiles where id = new.id;
    delete from public.workspaces where id = ws;
  end if;
  return new;
end $$;
revoke execute on function public.drop_workspace_of_non_customer() from public, anon, authenticated;

drop trigger if exists on_auth_user_role_set on auth.users;
create trigger on_auth_user_role_set after update of raw_app_meta_data, raw_user_meta_data on auth.users
  for each row execute function public.drop_workspace_of_non_customer();

-- Empty workspaces left without any member (e.g. their account was deleted).
delete from public.workspaces w
where not exists (select 1 from public.workspace_members m where m.workspace_id = w.id)
  and not exists (select 1 from public.strategies s where s.workspace_id = w.id)
  and not exists (select 1 from public.campaigns c where c.workspace_id = w.id)
  and not exists (select 1 from public.payments p where p.workspace_id = w.id)
  and not exists (select 1 from public.invoices i where i.workspace_id = w.id);
