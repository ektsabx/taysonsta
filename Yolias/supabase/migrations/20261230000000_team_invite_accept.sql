-- Team invitations are accepted, not applied (audit, 2026-11-10). Before,
-- inviting an address created its account at once and the signup trigger put
-- it in the team before the person did anything. Now an invitation is a link
-- (/join/<token>): the person opens it and joins, by signing up from it or by
-- pressing Join when they already have an account.
alter table public.workspace_invitations add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists workspace_invitations_token on public.workspace_invitations (token);

-- A new account joins a team only when it was created from that team's
-- invitation link (its token is in the signup metadata, for the same email).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv public.workspace_invitations;
  ws uuid;
  v_token uuid;
begin
  if not public.is_yolias_customer(new) then
    return new;
  end if;

  begin
    v_token := nullif(new.raw_user_meta_data->>'invite_token', '')::uuid;
  exception when others then
    v_token := null;
  end;
  if v_token is not null then
    select * into inv from public.workspace_invitations
      where token = v_token and email = lower(new.email) and accepted_at is null limit 1;
  end if;

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
