-- Master upgrade Phase 18 (docs/bos/30 §27; doc 31): data import engine —
-- jobs with mapping, per-row validation/duplicate results, confirmed
-- execution through the module services, log and rollback. Additive.

insert into document_sequences (key, prefix, padding) values ('import_job', 'IMP-', 6) on conflict (key) do nothing;

create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default bos_next_number('import_job'),
  data_type text not null,
  source_format text not null check (source_format in ('csv','xlsx','json')),
  file_name text not null,
  file_size int not null check (file_size > 0),
  storage_path text,
  headers text[] not null default '{}',
  mapping jsonb not null default '{}'::jsonb,         -- target field → source column
  match_key text,                                     -- field used to find existing records
  mode text not null default 'create_only' check (mode in ('create_only','update_matches')),
  expected_count int,
  status text not null default 'uploaded' check (status in ('uploaded','validated','running','completed','failed','rolled_back','cancelled')),
  total_rows int not null default 0,
  valid_rows int not null default 0,
  error_rows int not null default 0,
  duplicate_rows int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  failed_count int not null default 0,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  executed_at timestamptz,
  rolled_back_at timestamptz,
  rolled_back_by uuid references auth.users(id) on delete set null
);
create index import_jobs_recent_idx on import_jobs (created_at desc);

create table import_rows (
  id bigserial primary key,
  job_id uuid not null references import_jobs(id) on delete cascade,
  row_no int not null,
  raw jsonb not null,
  values jsonb,                                        -- normalised mapped values
  status text not null default 'pending' check (status in ('pending','valid','error','duplicate','created','updated','skipped','failed','rolled_back')),
  errors text[] not null default '{}',
  match_id uuid,                                       -- existing record found by the match key
  target_id uuid,                                      -- record created/updated
  before jsonb,                                        -- previous values for rollback of updates
  unique (job_id, row_no)
);
create index import_rows_job_idx on import_rows (job_id, status);

alter table import_jobs enable row level security;
alter table import_rows enable row level security;
grant all on import_jobs, import_rows to service_role;
grant usage, select on sequence import_rows_id_seq to service_role;

insert into permissions (key, module, action, description)
select 'imports.' || a::text, 'imports', a, 'Data import — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'::permission_scope
from roles r join permissions p on p.module = 'imports'
where r.key in ('super_admin','admin') or (r.key in ('sales_manager','hr','finance') and p.action::text in ('read','create'))
on conflict (role_id, permission_id) do nothing;
