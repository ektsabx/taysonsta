-- One round trip for the signed-in session (owner brief 2026-10-21, D-251:
-- slow navigation). Before: Auth getUser (network) → profile → workspace +
-- membership, in sequence, on every page. Now the token is verified on the
-- server (getClaims, ES256 keys) and this function returns everything at once.
-- It keeps the checks getUser gave: a user that no longer exists or is banned
-- in Auth (Admin suspend / pause / ban all ban in Auth) gets nothing; a user with a
-- verified second factor who hasn't entered it gets needs_mfa.
create or replace function public.session_context()
returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_user auth.users;
  v_profile public.profiles;
  v_ws public.workspaces;
  v_role text;
begin
  if v_uid is null then return null; end if;
  select * into v_user from auth.users where id = v_uid;
  if not found or v_user.deleted_at is not null or (v_user.banned_until is not null and v_user.banned_until > now()) then return null; end if;
  if exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')
     and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    return jsonb_build_object('needs_mfa', true);
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.workspace_id is null then return null; end if;
  select * into v_ws from public.workspaces where id = v_profile.workspace_id;
  select role into v_role from public.workspace_members where workspace_id = v_profile.workspace_id and user_id = v_uid;
  if v_ws.id is null or v_role is null then return null; end if;
  return jsonb_build_object(
    'email', v_user.email, 'email_confirmed', v_user.email_confirmed_at is not null, 'user_metadata', coalesce(v_user.raw_user_meta_data, '{}'::jsonb),
    'profile', to_jsonb(v_profile), 'workspace', to_jsonb(v_ws), 'role', v_role);
end $$;
revoke execute on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;
