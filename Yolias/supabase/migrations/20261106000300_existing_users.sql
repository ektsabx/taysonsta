-- D-148: production shares its Supabase project (and auth.users) with the
-- Taysonsta website. Accounts that existed before Yolias get their Yolias
-- profile and workspace now, as a new sign-up would (handle_new_user).
do $$
declare
  u record;
  ws uuid;
begin
  for u in select id, email from auth.users where email is not null and id not in (select id from public.profiles) loop
    insert into public.workspaces (created_by) values (u.id) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, u.id, 'owner') on conflict do nothing;
    insert into public.profiles (id, email, workspace_id) values (u.id, lower(u.email), ws);
  end loop;
end $$;
