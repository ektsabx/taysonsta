-- Kashier replaces Paymob for card payments (owner decision 2026-10-19, D-235).
-- Kashier takes the card inside Yolias's own checkout page (an embedded
-- Payment Session), charges in USD (or EGP when the account is EGP-only),
-- saves the card with the first payment and lets Yolias charge it for every
-- renewal. Paymob stays in the schema so payments already started can settle.

-- ── Provider and its secrets (Vault, service role only) ─────────────────────
alter table public.payment_providers drop constraint if exists payment_providers_id_check;
alter table public.payment_providers add constraint payment_providers_id_check check (id in ('paymob', 'kashier'));
insert into public.payment_providers (id, config) values ('kashier', '{"currency": "USD", "save_card": "forced"}'::jsonb)
  on conflict (id) do nothing;

-- api_key = Kashier's "Payment API Key" (hashes and webhook signatures);
-- secret_key = the account secret key (Authorization header of the APIs).
alter table public.payment_provider_secrets drop constraint if exists payment_provider_secrets_name_check;
alter table public.payment_provider_secrets add constraint payment_provider_secrets_name_check check (name in ('secret_key', 'hmac_secret', 'api_key'));

alter table public.workspaces drop constraint if exists workspaces_billing_provider_check;
alter table public.workspaces add constraint workspaces_billing_provider_check check (billing_provider is null or billing_provider in ('paymob', 'polar', 'kashier'));

-- ── Saved cards ─────────────────────────────────────────────────────────────
-- One saved card per workspace and provider: the card Kashier tokenized at the
-- last successful payment. The token is in Vault; members see brand, last 4
-- digits and expiry only.
create table public.billing_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('kashier')),
  customer_reference text not null check (length(customer_reference) between 1 and 100),
  token_secret_id uuid,
  brand text check (brand is null or length(brand) <= 40),
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  exp_month text check (exp_month is null or exp_month ~ '^[0-9]{1,2}$'),
  exp_year text check (exp_year is null or exp_year ~ '^[0-9]{2,4}$'),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);
create trigger billing_cards_updated_at before update on public.billing_cards for each row execute function public.set_updated_at();
alter table public.billing_cards enable row level security;
create policy "members read their workspace card" on public.billing_cards for select using (public.is_workspace_member(workspace_id));
grant select (id, workspace_id, provider, brand, last4, exp_month, exp_year, status, created_at, updated_at) on public.billing_cards to authenticated;

create or replace function public.set_card_token(p_card uuid, p_token text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_token)), 0) = 0 then raise exception 'empty token'; end if;
  select token_secret_id into v_id from public.billing_cards where id = p_card for update;
  if not found then raise exception 'unknown card'; end if;
  if v_id is null then
    v_id := vault.create_secret(p_token, 'card_' || p_card, 'Yolias saved card token');
    update public.billing_cards set token_secret_id = v_id where id = p_card;
  else
    perform vault.update_secret(v_id, p_token);
  end if;
end $$;

create or replace function public.card_token(p_card uuid) returns text
language sql stable security definer set search_path = public, vault as $$
  select s.decrypted_secret from public.billing_cards c join vault.decrypted_secrets s on s.id = c.token_secret_id where c.id = p_card and c.status = 'active';
$$;

create or replace function public.clear_card_token(p_card uuid) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  select token_secret_id into v_id from public.billing_cards where id = p_card for update;
  update public.billing_cards set token_secret_id = null, status = 'removed' where id = p_card;
  if v_id is not null then delete from vault.secrets where id = v_id; end if;
end $$;

revoke execute on function public.set_card_token(uuid, text) from public, anon, authenticated;
revoke execute on function public.card_token(uuid) from public, anon, authenticated;
revoke execute on function public.clear_card_token(uuid) from public, anon, authenticated;
grant execute on function public.set_card_token(uuid, text) to service_role;
grant execute on function public.card_token(uuid) to service_role;
grant execute on function public.clear_card_token(uuid) to service_role;
