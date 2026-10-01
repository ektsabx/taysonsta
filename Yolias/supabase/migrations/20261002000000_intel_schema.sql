-- Intelligence Layer data (docs/04-data-model.md, docs/03-intelligence-layer.md).
-- Shared intelligence lives in the `intel` schema: no customer access at all
-- (no grants to anon/authenticated); only the service role (server code and
-- the worker) reads and writes it. Workspace data stays in `public` with RLS.

create schema if not exists intel;
revoke all on schema intel from public, anon, authenticated;
grant usage on schema intel to service_role;
alter default privileges in schema intel grant all on tables to service_role;
alter default privileges in schema intel grant all on sequences to service_role;
alter default privileges in schema intel grant execute on functions to service_role;
alter default privileges in schema intel revoke execute on functions from public;

create or replace function intel.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────── Configuration ─────────────────────────

-- Key/value settings edited from Yolias Admin (routing ladder, TTLs, model
-- prices, circuit breaker). Values are configuration, never code (rule 14).
create table intel.settings (
  key text primary key,
  value jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into intel.settings (key, value) values
  ('routing_ladder', '["shared_db", "code", "public", "paid", "llm"]'),
  ('ttl_days', '{"company_firmographics": 90, "hiring_signals": 7, "person_employment": 45, "email_verification": 30, "phone": 90, "search_cache": 7, "provider_coverage": 30}'),
  ('circuit_breaker', '{"failures": 5, "open_seconds": 300}'),
  -- USD per million tokens. Planning values: confirm on the provider's pricing page and edit in the admin.
  ('llm_prices', '{
    "claude-opus-5-5": {"input": 4, "output": 20, "cache_read_multiplier": 0.1, "cache_write_multiplier": 1.25},
    "claude-sonnet-5-5": {"input": 2, "output": 10, "cache_read_multiplier": 0.1, "cache_write_multiplier": 1.25},
    "claude-haiku-4-5-20251001": {"input": 1, "output": 5, "cache_read_multiplier": 0.1, "cache_write_multiplier": 1.25}
  }');

-- Provider registry. One row per provider adapter in code (Yolias syncs
-- missing rows, disabled). Everything else here is edited in the admin.
create table intel.providers (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  enabled boolean not null default false,
  priority int not null default 100,                  -- lower runs first
  capabilities text[] not null default '{}',          -- declared by the adapter
  pricing jsonb not null default '{}',                -- {"<capability>": {"unit": "record", "unit_cost_usd": 0.01}}
  rate_limit_per_min int check (rate_limit_per_min > 0),
  burst int check (burst > 0),
  concurrency int not null default 2 check (concurrency between 1 and 100),
  daily_budget_usd numeric(12, 2) check (daily_budget_usd >= 0),
  monthly_budget_usd numeric(12, 2) check (monthly_budget_usd >= 0),
  fallback_to text[] not null default '{}',
  -- Licensing (docs/03 "Licensing"). Unknown = most restrictive.
  license_scope text,
  storage_allowed boolean not null default false,
  retention_days int check (retention_days > 0),
  display_allowed boolean not null default false,
  customer_facing_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  derived_data_allowed boolean not null default false,
  attribution_required boolean not null default false,
  -- Credentials live in Supabase Vault; only the secret's id is stored here.
  credential_secret_id uuid,
  credential_hint text,
  health jsonb not null default '{}',                 -- {consecutive_failures, circuit_open_until, last_error, last_success_at}
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger providers_touch before update on intel.providers for each row execute function intel.touch_updated_at();

-- ───────────────────────── Cost engine ─────────────────────────

-- Every external provider call (docs/06 "Cost engine").
create table intel.provider_calls (
  id bigint generated always as identity primary key,
  provider text not null,
  capability text not null,
  operation text not null,
  workspace_id uuid,
  campaign_id uuid,
  request_hash text,
  ok boolean not null,
  http_status int,
  attempts int not null default 1,
  latency_ms int,
  records_returned int not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  cache_hit boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);
create index provider_calls_time_idx on intel.provider_calls (created_at desc);
create index provider_calls_provider_idx on intel.provider_calls (provider, created_at desc);
create index provider_calls_workspace_idx on intel.provider_calls (workspace_id, created_at desc);
create index provider_calls_campaign_idx on intel.provider_calls (campaign_id);

-- Every LLM call, cached answers included (cost 0, cache_hit = true).
create table intel.llm_calls (
  id bigint generated always as identity primary key,
  task text not null,                                 -- e.g. "icp.parse"
  model text not null,
  served_model text,
  prompt_version text,
  workspace_id uuid,
  campaign_id uuid,
  strategy_id uuid,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  cache_hit boolean not null default false,
  ok boolean not null,
  error text,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index llm_calls_time_idx on intel.llm_calls (created_at desc);
create index llm_calls_workspace_idx on intel.llm_calls (workspace_id, created_at desc);

-- LLM answers by input hash (same request + model + prompt version ⇒ no new call).
create table intel.llm_cache (
  key text primary key,                               -- sha256 of task|model|prompt_version|input
  task text not null,
  model text not null,
  prompt_version text not null,
  output jsonb not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  hits int not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz,
  expires_at timestamptz
);

-- Search results by ICP fingerprint (docs/05 "Search cache").
create table intel.search_cache (
  fingerprint text primary key,
  company_ids uuid[] not null default '{}',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Measured coverage per provider (feeds routing).
create table intel.provider_coverage (
  provider text not null,
  capability text not null,
  country text not null default '*',
  industry text not null default '*',
  requests int not null default 0,
  successes int not null default 0,
  records int not null default 0,
  measured_at timestamptz not null default now(),
  primary key (provider, capability, country, industry)
);

-- ───────────────────────── Shared intelligence ─────────────────────────

create table intel.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,                                 -- eTLD+1, lower case
  website text,
  industry text,
  description text,
  employee_count int,
  city text,
  country text,                                       -- ISO alpha-2
  linkedin_url text,
  place_id text,
  socials jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  refreshed_at timestamptz
);
create trigger companies_touch before update on intel.companies for each row execute function intel.touch_updated_at();

create table intel.company_identifiers (
  kind text not null check (kind in ('domain', 'place_id', 'linkedin', 'provider')),
  value text not null,                                -- for 'provider': "<provider>:<id>"
  company_id uuid not null references intel.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (kind, value)
);
create index company_identifiers_company_idx on intel.company_identifiers (company_id);

create table intel.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_name text not null,
  linkedin_url text unique,
  title text,
  seniority text,
  department text,
  current_company_id uuid references intel.companies(id) on delete set null,
  city text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  refreshed_at timestamptz
);
create index people_company_name_idx on intel.people (current_company_id, normalized_name);
create trigger people_touch before update on intel.people for each row execute function intel.touch_updated_at();

create table intel.person_identifiers (
  kind text not null check (kind in ('linkedin', 'email', 'provider')),
  value text not null,
  person_id uuid not null references intel.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (kind, value)
);
create index person_identifiers_person_idx on intel.person_identifiers (person_id);

create table intel.employments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references intel.people(id) on delete cascade,
  company_id uuid not null references intel.companies(id) on delete cascade,
  title text,
  seniority text,
  department text,
  is_current boolean not null default true,
  started_on date,
  ended_on date,
  source text not null,
  observed_at timestamptz not null default now(),
  unique (person_id, company_id, title)
);

create table intel.contacts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references intel.people(id) on delete cascade,
  kind text not null check (kind in ('work_email', 'personal_email', 'phone', 'mobile')),
  value text not null,
  status text not null default 'unknown' check (status in ('unknown', 'valid', 'invalid', 'catch_all', 'risky')),
  verified_at timestamptz,
  verified_by text,
  source text not null,
  observed_at timestamptz not null default now(),
  unique (person_id, kind, value)
);

-- Field-level provenance: where each value came from, when, how sure, and under which license.
create table intel.field_values (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('company', 'person', 'contact')),
  entity_id uuid not null,
  field text not null,
  value jsonb,
  source text not null,
  provider_call_id bigint references intel.provider_calls(id) on delete set null,
  confidence numeric(4, 3) check (confidence between 0 and 1),
  license_scope text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz
);
create index field_values_entity_idx on intel.field_values (entity_type, entity_id, field, fetched_at desc);

-- Uncertain matches are never merged automatically (rule 22).
create table intel.possible_duplicates (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('company', 'person')),
  a uuid not null,
  b uuid not null,
  score numeric(4, 3),
  reason text,
  status text not null default 'open' check (status in ('open', 'merged', 'distinct')),
  created_at timestamptz not null default now(),
  unique (entity_type, a, b)
);

-- Never deliver these (rule 34).
create table intel.suppression_list (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email', 'domain', 'linkedin', 'person')),
  value text not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

-- ───────────────────────── Credentials (Vault) ─────────────────────────

create or replace function intel.set_provider_credential(p_provider text, p_secret text)
returns void
language plpgsql
security definer
set search_path = intel, vault, public
as $$
declare
  v_id uuid;
begin
  if coalesce(length(trim(p_secret)), 0) = 0 then
    raise exception 'empty secret';
  end if;
  select credential_secret_id into v_id from intel.providers where id = p_provider for update;
  if not found then
    raise exception 'unknown provider %', p_provider;
  end if;
  if v_id is null then
    v_id := vault.create_secret(p_secret, 'intel_provider_' || p_provider, 'Yolias provider credential');
  else
    perform vault.update_secret(v_id, p_secret);
  end if;
  update intel.providers
     set credential_secret_id = v_id,
         credential_hint = case when length(p_secret) > 8 then '••••' || right(p_secret, 4) else '••••' end
   where id = p_provider;
end $$;

create or replace function intel.clear_provider_credential(p_provider text)
returns void
language plpgsql
security definer
set search_path = intel, vault, public
as $$
declare
  v_id uuid;
begin
  select credential_secret_id into v_id from intel.providers where id = p_provider for update;
  update intel.providers set credential_secret_id = null, credential_hint = null where id = p_provider;
  if v_id is not null then
    delete from vault.secrets where id = v_id;
  end if;
end $$;

-- Plaintext credential for the adapter. Service role only.
create or replace function intel.provider_credential(p_provider text)
returns text
language sql
stable
security definer
set search_path = intel, vault, public
as $$
  select s.decrypted_secret
  from intel.providers p
  join vault.decrypted_secrets s on s.id = p.credential_secret_id
  where p.id = p_provider;
$$;

-- ───────────────────────── Aggregates for the admin ─────────────────────────

create or replace function intel.cost_summary(p_since timestamptz)
returns table (kind text, key text, calls bigint, failures bigint, cache_hits bigint, cost_usd numeric, records bigint, avg_latency_ms numeric)
language sql
stable
security definer
set search_path = intel, public
as $$
  select 'provider', provider || ' · ' || capability, count(*), count(*) filter (where not ok), count(*) filter (where cache_hit),
         coalesce(sum(cost_usd), 0), coalesce(sum(records_returned), 0)::bigint, round(avg(latency_ms))
  from intel.provider_calls where created_at >= p_since group by provider, capability
  union all
  select 'llm', task || ' · ' || model, count(*), count(*) filter (where not ok), count(*) filter (where cache_hit),
         coalesce(sum(cost_usd), 0), coalesce(sum(input_tokens + output_tokens), 0)::bigint, round(avg(latency_ms))
  from intel.llm_calls where created_at >= p_since group by task, model;
$$;

grant all on all tables in schema intel to service_role;
grant all on all sequences in schema intel to service_role;
revoke execute on all functions in schema intel from public, anon, authenticated;
grant execute on all functions in schema intel to service_role;

-- ───────────────────────── Workspace side ─────────────────────────

-- How each search was understood (docs/04 "Public schema changes").
alter table public.strategies
  add column icp_fingerprint text,
  add column icp_model text,
  add column icp_prompt_version text,
  add column interpretation_cost_usd numeric(12, 6),
  add column icp_cached boolean not null default false;
create index strategies_fingerprint_idx on public.strategies (icp_fingerprint);
