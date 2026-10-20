-- Data import (owner brief 2026-10-20, D-248): every dataset Yolias buys or
-- collects (bought lists, open data, government registries, our crawler) is
-- uploaded in Yolias Admin with its source and licence, mapped to Yolias
-- fields, normalised, matched with the shared database (intel) and reported.
-- Rows are staged first (intel.dataset_rows), then merged in batches by
-- intel.dataset_merge(). What each dataset created or added stays traceable
-- (intel.dataset_records, field_values.source = 'dataset:<id>'), so a dataset
-- can be removed completely when its licence ends.

create table intel.datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 200),
  source_kind text not null default 'purchased' check (source_kind in ('purchased', 'open_data', 'registry', 'crawl', 'partner', 'other')),
  vendor text check (vendor is null or length(vendor) <= 200),
  source_url text check (source_url is null or length(source_url) <= 1000),
  -- Licence (docs/03 "Licensing"): what Yolias may do with the rows.
  license_name text check (license_name is null or length(license_name) <= 200),
  license_scope text not null default 'internal' check (license_scope in ('yolias_shared', 'internal')),
  customer_facing boolean not null default false,      -- may be shown / delivered to customers
  redistributable boolean not null default false,      -- may be reused across workspaces
  attribution text check (attribution is null or length(attribution) <= 500),
  retention_days int check (retention_days is null or retention_days between 1 and 36500),
  purchased_at date,
  cost_usd numeric(12, 2) check (cost_usd is null or cost_usd >= 0),
  countries text[] not null default '{}',
  default_country text check (default_country is null or default_country ~ '^[A-Z]{2}$'),
  notes text check (notes is null or length(notes) <= 4000),
  entity text not null default 'company' check (entity in ('company', 'person')),
  status text not null default 'mapping' check (status in ('mapping', 'importing', 'ready', 'deleted')),
  file_name text,
  file_rows int,
  headers text[] not null default '{}',
  sample jsonb not null default '[]',
  mapping jsonb not null default '{}',
  mapping_source text check (mapping_source in ('ai', 'rules', 'manual')),
  enrich boolean not null default false,
  enrich_state jsonb not null default '{}',
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  imported_at timestamptz,
  deleted_at timestamptz,
  deleted_by text
);
create index datasets_created_idx on intel.datasets (created_at desc);

create table intel.dataset_rows (
  id bigint generated always as identity primary key,
  dataset_id uuid not null references intel.datasets(id) on delete cascade,
  row_no int not null,
  raw jsonb not null,
  data jsonb not null,
  status text not null default 'staged' check (status in ('staged', 'invalid', 'new', 'merged', 'duplicate')),
  problems text[] not null default '{}',
  company_id uuid,
  person_id uuid,
  created_at timestamptz not null default now(),
  unique (dataset_id, row_no)
);
create index dataset_rows_status_idx on intel.dataset_rows (dataset_id, status, id);

-- What a dataset brought: created = the record didn't exist before it.
create table intel.dataset_records (
  dataset_id uuid not null references intel.datasets(id) on delete cascade,
  entity_type text not null check (entity_type in ('company', 'person')),
  entity_id uuid not null,
  created boolean not null default false,
  enriched_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (dataset_id, entity_type, entity_id)
);
create index dataset_records_entity_idx on intel.dataset_records (entity_type, entity_id);

-- More ways to recognise the same company across sources.
alter table intel.company_identifiers drop constraint if exists company_identifiers_kind_check;
alter table intel.company_identifiers add constraint company_identifiers_kind_check check (kind in ('domain', 'place_id', 'linkedin', 'provider', 'registry', 'phone', 'name_key'));
create index if not exists field_values_source_idx on intel.field_values (source);
create index if not exists contacts_source_idx on intel.contacts (source);

alter table intel.datasets enable row level security;
alter table intel.dataset_rows enable row level security;
alter table intel.dataset_records enable row level security;
grant all on intel.datasets, intel.dataset_rows, intel.dataset_records to service_role;

-- ───────────────────────── Merge ─────────────────────────

/**
 * Merges up to p_limit staged rows of a dataset into the shared database.
 * Company: domain → registry id → LinkedIn page → phone → same name in the
 * same country (and city). A name match whose domain differs is not merged:
 * a new company is created and the pair is recorded as a possible
 * duplicate. Existing values are never overwritten; every value is recorded
 * with its source (field_values). Person: LinkedIn → email → same name at
 * the same company.
 */
create or replace function intel.dataset_merge(p_dataset uuid, p_limit int default 500)
returns jsonb
language plpgsql security definer set search_path = intel, public
as $$
declare
  d intel.datasets; r record; c jsonb; p jsonb;
  v_src text; v_cid uuid; v_pid uuid; v_new boolean; v_pnew boolean; v_status text; v_n int := 0;
  v_name_key text; v_li text; v_reg text; v_cur_domain text; v_expires timestamptz; v_seen boolean; v_dup_of uuid;
  v_pli text; v_pemail text; v_left int;
begin
  select * into d from intel.datasets where id = p_dataset;
  if not found or d.status = 'deleted' then return jsonb_build_object('processed', 0, 'remaining', 0); end if;
  v_src := 'dataset:' || d.id;
  v_expires := case when d.retention_days is null then null else now() + make_interval(days => d.retention_days) end;

  for r in select * from intel.dataset_rows where dataset_id = p_dataset and status = 'staged' order by id limit greatest(1, least(p_limit, 2000)) for update skip locked loop
    v_n := v_n + 1;
    c := r.data->'company'; p := r.data->'person';
    v_cid := null; v_new := false; v_pid := null; v_pnew := false; v_dup_of := null;
    v_li := nullif(regexp_replace(lower(coalesce(c->>'linkedin_url', '')), '^https?://(www\.)?', ''), '');
    v_reg := case when nullif(c->>'registry_id', '') is null then null else coalesce(c->>'country', 'xx') || ':' || lower(regexp_replace(c->>'registry_id', '\s', '', 'g')) end;
    v_name_key := case when nullif(c->>'key', '') is null then null else (c->>'key') || '|' || coalesce(c->>'country', '') || '|' || lower(coalesce(c->>'city', '')) end;

    if c->>'domain' is not null then
      select company_id into v_cid from intel.company_identifiers where kind = 'domain' and value = c->>'domain';
    end if;
    if v_cid is null and v_reg is not null then
      select company_id into v_cid from intel.company_identifiers where kind = 'registry' and value = v_reg;
    end if;
    if v_cid is null and v_li is not null then
      select company_id into v_cid from intel.company_identifiers where kind = 'linkedin' and value = v_li;
    end if;
    if v_cid is null and c->>'phone' is not null then
      select company_id into v_cid from intel.company_identifiers where kind = 'phone' and value = c->>'phone';
    end if;
    -- A person row with only a company name: a person we already know (by
    -- LinkedIn or email) stays at their company.
    if v_cid is null and d.entity = 'person' and p is not null and jsonb_typeof(p) = 'object' then
      select pe.current_company_id into v_cid
      from intel.person_identifiers pi join intel.people pe on pe.id = pi.person_id
      where (pi.kind = 'linkedin' and pi.value = nullif(regexp_replace(lower(coalesce(p->>'linkedin', '')), '^https?://(www\.)?', ''), ''))
         or (pi.kind = 'email' and pi.value = nullif(lower(p->>'email'), ''))
      limit 1;
    end if;
    if v_cid is null and v_name_key is not null then
      select company_id into v_cid from intel.company_identifiers where kind = 'name_key' and value = v_name_key;
      if v_cid is not null and c->>'domain' is not null then
        select domain into v_cur_domain from intel.companies where id = v_cid;
        if v_cur_domain is not null and v_cur_domain <> c->>'domain' then
          v_dup_of := v_cid; v_cid := null;   -- same name, different website
        end if;
      end if;
    end if;

    if v_cid is null then
      insert into intel.companies (name, domain, website, industry, description, employee_count, city, country, linkedin_url, refreshed_at, redistributable)
      values (coalesce(c->>'name', c->>'domain'), c->>'domain', c->>'website', c->>'industry', c->>'description', (c->>'employee_count')::int,
              c->>'city', c->>'country', c->>'linkedin_url', now(), d.redistributable)
      on conflict (domain) do nothing
      returning id into v_cid;
      if v_cid is null then  -- raced on the unique domain
        select id into v_cid from intel.companies where domain = c->>'domain';
      else
        v_new := true;
      end if;
      if v_dup_of is not null then
        insert into intel.possible_duplicates (entity_type, a, b, reason)
        values ('company', v_dup_of, v_cid, 'same name and place, different website (' || d.name || ')')
        on conflict do nothing;
      end if;
    else
      update intel.companies set
        domain = coalesce(domain, case when not exists (select 1 from intel.companies x where x.domain = c->>'domain') then c->>'domain' end),
        website = coalesce(website, c->>'website'), industry = coalesce(industry, c->>'industry'), description = coalesce(description, c->>'description'),
        employee_count = coalesce(employee_count, (c->>'employee_count')::int), city = coalesce(city, c->>'city'), country = coalesce(country, c->>'country'),
        linkedin_url = coalesce(linkedin_url, c->>'linkedin_url'), redistributable = redistributable or d.redistributable,
        refreshed_at = now(), updated_at = now()
      where id = v_cid;
    end if;

    insert into intel.company_identifiers (kind, value, company_id)
    select k, v, v_cid from (values ('domain', c->>'domain'), ('registry', v_reg), ('linkedin', v_li), ('phone', c->>'phone'), ('name_key', v_name_key)) as t(k, v)
    where v is not null
    on conflict (kind, value) do nothing;

    insert into intel.field_values (entity_type, entity_id, field, value, source, license_scope, expires_at)
    select 'company', v_cid, f, to_jsonb(val), v_src, d.license_scope, v_expires
    from (values ('name', c->>'name'), ('website', c->>'website'), ('email', c->>'email'), ('phone', c->>'phone'), ('country', c->>'country'), ('city', c->>'city'),
                 ('address', c->>'address'), ('industry', c->>'industry'), ('category', c->>'category'), ('description', c->>'description'),
                 ('employee_count', c->>'employee_count'), ('linkedin_url', c->>'linkedin_url'), ('registry_id', c->>'registry_id')) as t(f, val)
    where val is not null;

    select exists (select 1 from intel.dataset_records where dataset_id = d.id and entity_type = 'company' and entity_id = v_cid) into v_seen;
    insert into intel.dataset_records (dataset_id, entity_type, entity_id, created) values (d.id, 'company', v_cid, v_new) on conflict do nothing;
    v_status := case when v_seen then 'duplicate' when v_new then 'new' else 'merged' end;

    -- A person row: the person at that company.
    if d.entity = 'person' and p is not null and nullif(p->>'full_name', '') is not null then
      v_pli := nullif(regexp_replace(lower(coalesce(p->>'linkedin', '')), '^https?://(www\.)?', ''), '');
      v_pemail := nullif(lower(p->>'email'), '');
      if v_pli is not null then select person_id into v_pid from intel.person_identifiers where kind = 'linkedin' and value = v_pli; end if;
      if v_pid is null and v_pemail is not null then select person_id into v_pid from intel.person_identifiers where kind = 'email' and value = v_pemail; end if;
      if v_pid is null and nullif(p->>'normalized', '') is not null then
        select id into v_pid from intel.people
        where current_company_id = v_cid and normalized_name = p->>'normalized'
          and (v_pli is null or linkedin_url is null or lower(regexp_replace(linkedin_url, '^https?://(www\.)?', '')) = v_pli)
        limit 1;
      end if;
      if v_pid is null then
        insert into intel.people (full_name, normalized_name, linkedin_url, title, current_company_id, city, country, refreshed_at, redistributable)
        values (p->>'full_name', coalesce(p->>'normalized', lower(p->>'full_name')), case when v_pli is null then null else 'https://www.' || v_pli end, p->>'title', v_cid,
                c->>'city', c->>'country', now(), d.redistributable)
        on conflict (linkedin_url) do nothing
        returning id into v_pid;
        if v_pid is null then select id into v_pid from intel.people where linkedin_url = 'https://www.' || v_pli; else v_pnew := true; end if;
      else
        update intel.people set title = coalesce(title, p->>'title'), current_company_id = coalesce(current_company_id, v_cid), refreshed_at = now(), updated_at = now(),
          redistributable = redistributable or d.redistributable
        where id = v_pid;
      end if;
      insert into intel.person_identifiers (kind, value, person_id)
      select k, v, v_pid from (values ('linkedin', v_pli), ('email', v_pemail)) as t(k, v) where v is not null
      on conflict (kind, value) do nothing;
      if v_pemail is not null then
        insert into intel.contacts (person_id, kind, value, source, status) values (v_pid, 'work_email', v_pemail, v_src, 'unknown') on conflict (person_id, kind, value) do nothing;
      end if;
      if nullif(p->>'phone', '') is not null then
        insert into intel.contacts (person_id, kind, value, source, status) values (v_pid, 'phone', p->>'phone', v_src, 'unknown') on conflict (person_id, kind, value) do nothing;
      end if;
      insert into intel.employments (person_id, company_id, title, is_current, source)
      values (v_pid, v_cid, p->>'title', true, v_src)
      on conflict (person_id, company_id, title) do nothing;
      insert into intel.field_values (entity_type, entity_id, field, value, source, license_scope, expires_at)
      select 'person', v_pid, f, to_jsonb(val), v_src, d.license_scope, v_expires
      from (values ('full_name', p->>'full_name'), ('title', p->>'title'), ('email', p->>'email'), ('phone', p->>'phone'), ('linkedin_url', p->>'linkedin')) as t(f, val)
      where val is not null;
      select exists (select 1 from intel.dataset_records where dataset_id = d.id and entity_type = 'person' and entity_id = v_pid) into v_seen;
      insert into intel.dataset_records (dataset_id, entity_type, entity_id, created) values (d.id, 'person', v_pid, v_pnew) on conflict do nothing;
      v_status := case when v_seen then 'duplicate' when v_pnew then 'new' else 'merged' end;
    end if;

    update intel.dataset_rows set status = v_status, company_id = v_cid, person_id = v_pid where id = r.id;
  end loop;

  select count(*) into v_left from intel.dataset_rows where dataset_id = p_dataset and status = 'staged';
  if v_left = 0 and d.status = 'importing' and coalesce(d.file_rows, 0) <= (select count(*) from intel.dataset_rows where dataset_id = p_dataset) then
    update intel.datasets set status = 'ready', imported_at = now(), updated_at = now() where id = d.id;
  end if;
  return jsonb_build_object('processed', v_n, 'remaining', v_left);
end $$;

-- ───────────────────────── Report ─────────────────────────

create or replace function intel.dataset_report(p_dataset uuid)
returns jsonb
language sql stable security definer set search_path = intel, public
as $$
  select jsonb_build_object(
    'rows', (select count(*) from intel.dataset_rows where dataset_id = p_dataset),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from intel.dataset_rows where dataset_id = p_dataset group by status) s), '{}'),
    'problems', coalesce((select jsonb_object_agg(pr, n) from (select unnest(problems) pr, count(*) n from intel.dataset_rows where dataset_id = p_dataset group by 1) s), '{}'),
    'filled', coalesce((select jsonb_object_agg(f, n) from (
        select f, count(*) n from intel.dataset_rows r, lateral jsonb_each(r.data->'company') e(f, v)
        where r.dataset_id = p_dataset and r.status <> 'invalid' and jsonb_typeof(v) <> 'null' and f <> 'key' group by f
        union all
        select 'person_' || f, count(*) from intel.dataset_rows r, lateral jsonb_each(case when jsonb_typeof(r.data->'person') = 'object' then r.data->'person' else '{}'::jsonb end) e(f, v)
        where r.dataset_id = p_dataset and r.status <> 'invalid' and jsonb_typeof(v) <> 'null' and f <> 'normalized' group by f) s), '{}'),
    'companies_new', (select count(*) from intel.dataset_records where dataset_id = p_dataset and entity_type = 'company' and created),
    'companies_matched', (select count(*) from intel.dataset_records where dataset_id = p_dataset and entity_type = 'company' and not created),
    'people_new', (select count(*) from intel.dataset_records where dataset_id = p_dataset and entity_type = 'person' and created),
    'people_matched', (select count(*) from intel.dataset_records where dataset_id = p_dataset and entity_type = 'person' and not created),
    'enriched', (select count(*) from intel.dataset_records where dataset_id = p_dataset and enriched_at is not null),
    'possible_duplicates', (select count(*) from intel.possible_duplicates pd where pd.status = 'open' and pd.reason like '%(' || (select name from intel.datasets where id = p_dataset) || ')')
  );
$$;

-- ───────────────────────── Delete by source ─────────────────────────

/**
 * Removes everything a dataset brought: its values, contacts and job
 * records, and the companies / people it created that no other source
 * knows. Workspace copies already delivered to customers are not touched
 * (their link to the shared record becomes empty). Idempotent.
 */
create or replace function intel.dataset_delete(p_dataset uuid, p_actor text)
returns jsonb
language plpgsql security definer set search_path = intel, public
as $$
declare v_src text; v_companies int := 0; v_people int := 0; v_values int := 0;
begin
  v_src := 'dataset:' || p_dataset;
  delete from intel.field_values where source = v_src; get diagnostics v_values = row_count;
  delete from intel.contacts where source = v_src;
  delete from intel.employments where source = v_src;
  with gone as (
    delete from intel.people pe using intel.dataset_records dr
    where dr.dataset_id = p_dataset and dr.entity_type = 'person' and dr.created and pe.id = dr.entity_id
      and not exists (select 1 from intel.dataset_records o where o.entity_type = 'person' and o.entity_id = pe.id and o.dataset_id <> p_dataset)
      and not exists (select 1 from intel.field_values f where f.entity_type = 'person' and f.entity_id = pe.id)
    returning 1)
  select count(*) into v_people from gone;
  -- What our crawler read from a website it only visited because of this
  -- dataset doesn't keep the company alive (D-248 enrichment).
  with gone as (
    delete from intel.companies co using intel.dataset_records dr
    where dr.dataset_id = p_dataset and dr.entity_type = 'company' and dr.created and co.id = dr.entity_id
      and not exists (select 1 from intel.dataset_records o where o.entity_type = 'company' and o.entity_id = co.id and o.dataset_id <> p_dataset)
      and not exists (select 1 from intel.field_values f where f.entity_type = 'company' and f.entity_id = co.id and f.source <> 'yolias_crawler')
      and not exists (select 1 from intel.people pp where pp.current_company_id = co.id)
    returning co.id),
  values_gone as (delete from intel.field_values f using gone where f.entity_type = 'company' and f.entity_id = gone.id returning 1)
  select count(*) into v_companies from gone;
  -- Records it created that stay (another dataset still uses them) now
  -- belong to that dataset, so deleting it later removes them too.
  update intel.dataset_records o set created = true
  from intel.dataset_records dr
  where dr.dataset_id = p_dataset and dr.created and o.entity_type = dr.entity_type and o.entity_id = dr.entity_id and o.dataset_id <> p_dataset;
  delete from intel.dataset_records where dataset_id = p_dataset;
  delete from intel.dataset_rows where dataset_id = p_dataset;
  update intel.datasets set status = 'deleted', deleted_at = now(), deleted_by = p_actor, updated_at = now() where id = p_dataset;
  return jsonb_build_object('companies', v_companies, 'people', v_people, 'values', v_values);
end $$;

-- ───────────────────────── Search (Yolias discovery) ─────────────────────────

/**
 * Companies from datasets that may be shown to customers, matching a search:
 * countries, cities, words (name, industry, category, description) and a
 * size range; local businesses = rows with a category or an address. Only
 * rows with a way to reach them (email, phone, website or LinkedIn).
 */
create or replace function intel.dataset_search(p_countries text[], p_cities text[], p_terms text[], p_emp_min int, p_emp_max int, p_local boolean, p_limit int, p_offset int)
returns table (id uuid, name text, domain text, website text, industry text, description text, city text, country text, employee_count int,
               email text, phone text, address text, category text, linkedin_url text, dataset_id uuid)
language sql stable security definer set search_path = intel, public
as $$
  with src as (
    select dr.entity_id, min(dr.dataset_id::text)::uuid as dataset_id
    from intel.dataset_records dr join intel.datasets ds on ds.id = dr.dataset_id
    where dr.entity_type = 'company' and ds.status = 'ready' and ds.customer_facing
    group by dr.entity_id
  ),
  v as (
    select co.*, src.dataset_id,
      (select f.value #>> '{}' from intel.field_values f where f.entity_type = 'company' and f.entity_id = co.id and f.field = 'email' and (f.expires_at is null or f.expires_at > now()) order by f.fetched_at desc limit 1) as v_email,
      (select f.value #>> '{}' from intel.field_values f where f.entity_type = 'company' and f.entity_id = co.id and f.field = 'phone' and (f.expires_at is null or f.expires_at > now()) order by f.fetched_at desc limit 1) as v_phone,
      (select f.value #>> '{}' from intel.field_values f where f.entity_type = 'company' and f.entity_id = co.id and f.field = 'address' order by f.fetched_at desc limit 1) as v_address,
      (select f.value #>> '{}' from intel.field_values f where f.entity_type = 'company' and f.entity_id = co.id and f.field = 'category' order by f.fetched_at desc limit 1) as v_category
    from intel.companies co join src on src.entity_id = co.id
    where (coalesce(cardinality(p_countries), 0) = 0 or co.country = any (p_countries))
      and (coalesce(cardinality(p_cities), 0) = 0 or lower(co.city) = any (select lower(x) from unnest(p_cities) x))
      and (p_emp_min is null or co.employee_count is null or co.employee_count >= p_emp_min)
      and (p_emp_max is null or co.employee_count is null or co.employee_count <= p_emp_max)
  )
  select v.id, v.name, v.domain, v.website, v.industry, v.description, v.city, v.country, v.employee_count, v.v_email, v.v_phone, v.v_address, v.v_category, v.linkedin_url, v.dataset_id
  from v
  where (coalesce(cardinality(p_terms), 0) = 0 or exists (
          select 1 from unnest(p_terms) t
          where concat_ws(' ', v.name, v.industry, v.description, v.v_category) ilike '%' || t || '%'))
    and (not p_local or v.v_category is not null or v.v_address is not null)
    and (v.v_email is not null or v.v_phone is not null or v.website is not null or v.linkedin_url is not null)
  order by (v.v_email is not null) desc, (v.v_phone is not null) desc, v.name
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
$$;

revoke execute on function intel.dataset_merge(uuid, int), intel.dataset_report(uuid), intel.dataset_delete(uuid, text),
  intel.dataset_search(text[], text[], text[], int, int, boolean, int, int) from public, anon, authenticated;
grant execute on function intel.dataset_merge(uuid, int), intel.dataset_report(uuid), intel.dataset_delete(uuid, text),
  intel.dataset_search(text[], text[], text[], int, int, boolean, int, int) to service_role;

-- The search adapter (lib/intel/adapters/datasets.ts): free, runs before
-- paid providers and the website discovery; delivered rows keep the
-- licence of the dataset they come from (only customer-facing datasets).
insert into intel.providers (id, name, enabled, priority, capabilities, pricing, license_scope, storage_allowed, display_allowed, customer_facing_allowed, redistribution_allowed, derived_data_allowed, notes)
values ('yolias_datasets', 'Yolias datasets (imported data)', true, 10, '{company.search,place.search}', '{}', 'yolias_shared', true, true, true, false, true,
        'Searches the datasets imported in Yolias Admin → Data import that are marked customer-facing.')
on conflict (id) do nothing;
