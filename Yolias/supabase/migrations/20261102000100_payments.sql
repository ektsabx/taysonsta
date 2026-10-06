-- Final spec phase 3: payments.
-- Provider-agnostic billing: a payment row is created before the customer
-- is sent to the provider, the provider's signed callback settles it, and
-- only then is the plan started or the prospect pack granted. Paymob is the
-- first provider (D-007); secrets live in Supabase Vault, never in the
-- browser or in a table. Money is in its own currency (USD / EGP), never
-- converted (D-120, D-122).

-- ───────────────────────── Providers ─────────────────────────

create table public.payment_providers (
  id text primary key check (id in ('paymob')),
  enabled boolean not null default false,
  -- 'test' = the provider's sandbox keys; payments are marked as tests.
  mode text not null default 'test' check (mode in ('test', 'live')),
  -- Non-secret settings: base_url, public_key, integration ids per currency.
  config jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.payment_providers (id, config)
values ('paymob', '{"base_url": "https://accept.paymob.com", "integrations": {}}'::jsonb);

alter table public.payment_providers enable row level security;  -- service role only

create table public.payment_provider_secrets (
  provider text not null references public.payment_providers(id) on delete cascade,
  name text not null check (name in ('secret_key', 'hmac_secret')),
  secret_id uuid not null,
  hint text,                                       -- last 4 characters, for the admin
  updated_at timestamptz not null default now(),
  primary key (provider, name)
);
alter table public.payment_provider_secrets enable row level security;  -- service role only

create or replace function public.set_payment_secret(p_provider text, p_name text, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  if coalesce(length(trim(p_secret)), 0) = 0 then
    raise exception 'empty secret';
  end if;
  select secret_id into v_id from public.payment_provider_secrets where provider = p_provider and name = p_name for update;
  if v_id is null then
    v_id := vault.create_secret(p_secret, 'payment_' || p_provider || '_' || p_name, 'Yolias payment provider secret');
    insert into public.payment_provider_secrets (provider, name, secret_id, hint)
    values (p_provider, p_name, v_id, right(trim(p_secret), 4));
  else
    perform vault.update_secret(v_id, p_secret);
    update public.payment_provider_secrets set hint = right(trim(p_secret), 4), updated_at = now()
    where provider = p_provider and name = p_name;
  end if;
end $$;

create or replace function public.clear_payment_secret(p_provider text, p_name text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  delete from public.payment_provider_secrets where provider = p_provider and name = p_name returning secret_id into v_id;
  if v_id is not null then
    delete from vault.secrets where id = v_id;
  end if;
end $$;

create or replace function public.payment_secret(p_provider text, p_name text)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select s.decrypted_secret
  from public.payment_provider_secrets p
  join vault.decrypted_secrets s on s.id = p.secret_id
  where p.provider = p_provider and p.name = p_name;
$$;

revoke execute on function public.set_payment_secret(text, text, text) from public, anon, authenticated;
revoke execute on function public.clear_payment_secret(text, text) from public, anon, authenticated;
revoke execute on function public.payment_secret(text, text) from public, anon, authenticated;
grant execute on function public.set_payment_secret(text, text, text) to service_role;
grant execute on function public.clear_payment_secret(text, text) to service_role;
grant execute on function public.payment_secret(text, text) to service_role;

-- ───────────────────────── Buy More Prospects ─────────────────────────
-- Extra prospects for the current month, on top of the plan's allowance.

create table public.prospect_packs (
  id uuid primary key default gen_random_uuid(),
  prospects int not null check (prospects > 0 and prospects <= 1000000),
  price_usd numeric(12, 2) not null check (price_usd > 0),
  price_egp numeric(12, 2) check (price_egp is null or price_egp > 0),
  active boolean not null default true,
  sort int not null default 0,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.prospect_packs enable row level security;
create policy "anyone reads active packs" on public.prospect_packs for select using (active);
grant select on public.prospect_packs to anon, authenticated;

-- ───────────────────────── Invoices & events in their own currency ─────────────────────────

alter table public.invoices rename column amount_usd to amount;
alter table public.invoices
  add column currency text not null default 'USD' check (currency in ('USD', 'EGP')),
  add column kind text not null default 'subscription' check (kind in ('subscription', 'prospect_pack')),
  add column prospects int check (prospects is null or prospects > 0);
alter table public.invoices alter column plan drop not null;
alter table public.invoices alter column billing_period drop not null;
alter table public.invoices add constraint invoices_kind_shape check (
  (kind = 'subscription' and plan is not null and billing_period is not null)
  or (kind = 'prospect_pack' and prospects is not null)
);

alter table public.subscription_events rename column amount_usd to amount;
alter table public.subscription_events
  add column currency text not null default 'USD' check (currency in ('USD', 'EGP'));
alter table public.subscription_events drop constraint if exists subscription_events_status_check;
alter table public.subscription_events
  add constraint subscription_events_status_check
  check (status in ('activated', 'changed', 'canceled', 'resumed', 'ended', 'renewed', 'past_due'));

-- ───────────────────────── Payments ─────────────────────────

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('subscription', 'prospect_pack')),
  plan text check (plan in ('pro', 'growth')),
  billing_period text check (billing_period in ('monthly', 'annual')),
  pack_id uuid references public.prospect_packs(id) on delete set null,
  prospects int check (prospects is null or prospects > 0),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency in ('USD', 'EGP')),
  provider text not null,                          -- 'paymob' (more later)
  mode text not null check (mode in ('test', 'live')),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  provider_ref text,                               -- provider order / intention id
  provider_txn text,                               -- provider transaction id
  failure_reason text,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint payments_kind_shape check (
    (kind = 'subscription' and plan is not null and billing_period is not null)
    or (kind = 'prospect_pack' and prospects is not null)
  )
);
create index payments_workspace_idx on public.payments(workspace_id, created_at desc);
create unique index payments_provider_ref_uq on public.payments(provider, provider_ref) where provider_ref is not null;
create unique index payments_provider_txn_uq on public.payments(provider, provider_txn) where provider_txn is not null;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
-- Billing is visible to the workspace owner and admins (like invoices).
create policy "admins read payments" on public.payments for select using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id = payments.workspace_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  )
);

alter table public.invoices add column payment_id uuid references public.payments(id) on delete set null;

-- ───────────────────────── Admin revenue, per currency ─────────────────────────
-- Never summed across currencies (D-120): one row per workspace and currency.

drop function if exists public.admin_profitability(timestamptz);
create or replace function public.admin_profitability(p_since timestamptz)
returns table (workspace_id uuid, name text, plan text, currency text, revenue_live numeric, revenue_test numeric, llm_cost numeric, provider_cost numeric, unpriced_calls bigint, prospects bigint)
language sql
stable
security definer
set search_path = public, intel
as $$
  with rev as (
    select workspace_id, currency,
           coalesce(sum(amount) filter (where mode = 'live'), 0) as live,
           coalesce(sum(amount) filter (where mode = 'test'), 0) as test
    from public.invoices where status = 'paid' and created_at >= p_since group by workspace_id, currency
  ),
  llm as (
    select workspace_id, coalesce(sum(cost_usd), 0) as cost, count(*) filter (where cost_usd is null and not cache_hit) as unpriced
    from intel.llm_calls where created_at >= p_since and workspace_id is not null group by workspace_id
  ),
  prov as (
    select workspace_id, coalesce(sum(cost_usd), 0) as cost, count(*) filter (where cost_usd is null) as unpriced
    from intel.provider_calls where created_at >= p_since and workspace_id is not null group by workspace_id
  ),
  used as (
    select workspace_id, coalesce(sum(prospects), 0) as n
    from public.usage_ledger where kind = 'consume' and created_at >= p_since group by workspace_id
  )
  select w.id, w.name, w.plan, coalesce(rev.currency, w.billing_currency),
         coalesce(rev.live, 0), coalesce(rev.test, 0), coalesce(llm.cost, 0), coalesce(prov.cost, 0),
         coalesce(llm.unpriced, 0) + coalesce(prov.unpriced, 0), coalesce(used.n, 0)
  from public.workspaces w
  left join rev on rev.workspace_id = w.id
  left join llm on llm.workspace_id = w.id
  left join prov on prov.workspace_id = w.id
  left join used on used.workspace_id = w.id
  where rev.workspace_id is not null or llm.workspace_id is not null or prov.workspace_id is not null or used.workspace_id is not null;
$$;
revoke execute on function public.admin_profitability(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_profitability(timestamptz) to service_role;
