-- Master upgrade Phase 19 (docs/bos/30 §28–29; doc 31): consented employee
-- location at work events only (never continuous or covert), with access
-- logging and retention; office camera registry with viewing policy.
-- Additive only.

alter table branches add column if not exists latitude numeric(9,6) check (latitude is null or latitude between -90 and 90);
alter table branches add column if not exists longitude numeric(9,6) check (longitude is null or longitude between -180 and 180);
alter table branches add column if not exists geofence_m int check (geofence_m is null or geofence_m between 20 and 20000);

-- The employee's own, revocable consent (purpose text versioned).
create table location_consents (
  employee_id uuid primary key references employees(id) on delete cascade,
  status text not null check (status in ('granted','withdrawn')),
  scope text not null default 'attendance' check (scope in ('attendance','attendance_tasks')),
  purpose_version int not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now()
);

-- One point per work event the employee performed (clock in/out, task check-in).
create table employee_locations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  event text not null check (event in ('clock_in','clock_out','task_checkin')),
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  accuracy_m int check (accuracy_m is null or accuracy_m >= 0),
  captured_at timestamptz not null default now(),
  attendance_record_id uuid,
  task_id uuid references tasks(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  distance_to_branch_m int,
  address text
);
create index employee_locations_emp_idx on employee_locations (employee_id, captured_at desc);
create index employee_locations_time_idx on employee_locations (captured_at);

-- Who looked at whose location, when (sensitive access log).
create table location_access_log (
  id bigserial primary key,
  viewer_user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  action text not null check (action in ('view_map','view_timeline','export')),
  period text,
  viewed_at timestamptz not null default now()
);
create index location_access_log_idx on location_access_log (viewed_at desc);

-- Cameras: registry + policy. No credentials are stored or shown.
create table cameras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch_id uuid references branches(id) on delete set null,
  location_label text,
  connection_type text not null check (connection_type in ('hls','mjpeg','rtsp','onvif','vendor_cloud','other')),
  vendor text,
  model text,
  serial_number text,
  viewer_url text check (viewer_url is null or (viewer_url ~ '^https://' and viewer_url !~ '^https://[^/]*@')),
  status text not null default 'active' check (status in ('active','disabled','maintenance')),
  connection_status text not null default 'unknown' check (connection_status in ('unknown','online','offline','error','unsupported')),
  last_checked_at timestamptz,
  last_error text,
  allowed_role_ids uuid[] not null default '{}',
  notice_displayed boolean not null default false,   -- physical notice / policy confirmed by the admin
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cameras_touch before update on cameras for each row execute function bos_touch_updated_at();

create table camera_events (
  id bigserial primary key,
  camera_id uuid not null references cameras(id) on delete cascade,
  kind text not null check (kind in ('created','updated','viewed','status_check','disabled','enabled')),
  detail text,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index camera_events_idx on camera_events (camera_id, occurred_at desc);

alter table location_consents enable row level security;
alter table employee_locations enable row level security;
alter table location_access_log enable row level security;
alter table cameras enable row level security;
alter table camera_events enable row level security;
grant all on location_consents, employee_locations, location_access_log, cameras, camera_events to service_role;
grant usage, select on sequence location_access_log_id_seq, camera_events_id_seq to service_role;

-- Location and camera permissions are separate from general HR.
insert into permissions (key, module, action, description)
select m || '.' || a::text, m, a, initcap(m) || ' — ' || replace(a::text, '_', ' ')
from unnest(array['location','cameras']) as m, unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'::permission_scope
from roles r join permissions p on p.module in ('location','cameras')
where r.key = 'super_admin'
   or (r.key = 'admin' and p.module = 'cameras')
   or (r.key = 'admin' and p.module = 'location' and p.action::text in ('read','manage'))
on conflict (role_id, permission_id) do nothing;
