-- Workspace rows point at shared intelligence (docs/04). A workspace never
-- gets — or pays for — the same person twice.
alter table public.companies add column intel_company_id uuid references intel.companies(id) on delete set null;
alter table public.prospects add column person_id uuid references intel.people(id) on delete set null;
create unique index prospects_workspace_person_uidx on public.prospects (workspace_id, person_id) where person_id is not null;
create index companies_intel_idx on public.companies (intel_company_id);

-- Which licenses the shared rows came under (for reuse checks).
alter table intel.search_cache add column redistributable boolean not null default false;
alter table intel.search_cache add column workspace_id uuid;
alter table intel.companies add column redistributable boolean not null default false;
alter table intel.people add column redistributable boolean not null default false;
