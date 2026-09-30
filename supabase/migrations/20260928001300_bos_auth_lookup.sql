-- Server-side lookup of an auth user by email (used when linking an
-- employee to an existing login instead of inviting a duplicate).
create or replace function public.bos_find_auth_user_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
stable
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.bos_find_auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.bos_find_auth_user_by_email(text) to service_role;
