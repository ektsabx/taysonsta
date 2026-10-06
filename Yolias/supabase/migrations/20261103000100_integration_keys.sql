-- One place for every integration key (owner decision, D-132): keys are
-- entered only in Yolias Admin → Settings → Integrations. Admin copies the
-- active connection of each provider Yolias uses into this table; the
-- secrets themselves live in Supabase Vault (one JSON secret per provider)
-- and are readable by the service role only. Yolias reads keys from here,
-- never from environment variables.

create table public.integration_keys (
  provider text primary key check (provider ~ '^[a-z0-9_]{2,40}$'),
  -- Non-secret settings (e.g. an OpenAI organization id).
  config jsonb not null default '{}'::jsonb,
  secret_id uuid not null,
  -- Last 4 characters of each secret, for the admin.
  hint jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.integration_keys enable row level security;  -- service role only

create or replace function public.set_integration_keys(p_provider text, p_config jsonb, p_secrets jsonb, p_by text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
  v_hint jsonb;
begin
  if p_secrets is null or jsonb_typeof(p_secrets) <> 'object' or p_secrets = '{}'::jsonb then
    raise exception 'empty secrets';
  end if;
  select coalesce(jsonb_object_agg(key, right(value, 4)), '{}'::jsonb) into v_hint from jsonb_each_text(p_secrets);
  select secret_id into v_id from public.integration_keys where provider = p_provider for update;
  if v_id is null then
    v_id := vault.create_secret(p_secrets::text, 'integration_' || p_provider, 'Yolias integration keys (from Yolias Admin)');
    insert into public.integration_keys (provider, config, secret_id, hint, updated_by)
    values (p_provider, coalesce(p_config, '{}'::jsonb), v_id, v_hint, p_by);
  else
    perform vault.update_secret(v_id, p_secrets::text);
    update public.integration_keys set config = coalesce(p_config, '{}'::jsonb), hint = v_hint, updated_by = p_by, updated_at = now()
    where provider = p_provider;
  end if;
end $$;

create or replace function public.clear_integration_keys(p_provider text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  delete from public.integration_keys where provider = p_provider returning secret_id into v_id;
  if v_id is not null then
    delete from vault.secrets where id = v_id;
  end if;
end $$;

create or replace function public.integration_values()
returns table (provider text, config jsonb, secrets jsonb)
language sql
stable
security definer
set search_path = public, vault
as $$
  select k.provider, k.config, s.decrypted_secret::jsonb
  from public.integration_keys k
  join vault.decrypted_secrets s on s.id = k.secret_id;
$$;

revoke execute on function public.set_integration_keys(text, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.clear_integration_keys(text) from public, anon, authenticated;
revoke execute on function public.integration_values() from public, anon, authenticated;
grant execute on function public.set_integration_keys(text, jsonb, jsonb, text) to service_role;
grant execute on function public.clear_integration_keys(text) to service_role;
grant execute on function public.integration_values() to service_role;
