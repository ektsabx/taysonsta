-- Master upgrade Phase 15 (docs/bos/30 §21–22; doc 31): the device register
-- becomes the single asset & inventory source (office equipment, software
-- licences, loanable items, spare parts/stock, maintenance, event log), and
-- time entries gain approval. Additive only — existing devices/entries keep
-- their meaning.

alter type device_type add value if not exists 'office_equipment';
alter type device_type add value if not exists 'software_license';
alter type device_type add value if not exists 'loanable';
alter type device_type add value if not exists 'spare_part';
alter type device_status add value if not exists 'purchased' before 'in_stock';

alter table devices add column if not exists name text;
alter table devices add column if not exists purchase_value numeric(14,2) check (purchase_value is null or purchase_value >= 0);
alter table devices add column if not exists currency char(3);
alter table devices add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table devices add column if not exists quantity int not null default 1 check (quantity >= 0);          -- stock / spare parts
alter table devices add column if not exists min_quantity int check (min_quantity is null or min_quantity >= 0);
alter table devices add column if not exists license_seats int check (license_seats is null or license_seats >= 1);
alter table devices add column if not exists license_expiry date;
alter table devices add column if not exists license_account text;                                            -- vendor account / order reference (never a key or password)
alter table devices add column if not exists next_maintenance_date date;

-- Everything that happens to an asset (the transfer log §21).
create table asset_events (
  id bigserial primary key,
  device_id uuid not null references devices(id) on delete cascade,
  kind text not null check (kind in ('purchased','available','assigned','returned','seat_assigned','seat_released','branch_transfer','maintenance_opened','maintenance_closed','retired','lost','stock_in','stock_out','note')),
  detail text,
  employee_id uuid references employees(id) on delete set null,
  from_branch_id uuid references branches(id) on delete set null,
  to_branch_id uuid references branches(id) on delete set null,
  quantity int,
  cost numeric(14,2),
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index asset_events_device_idx on asset_events (device_id, occurred_at desc);

create table asset_maintenance (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  description text not null,
  vendor_id uuid references vendors(id) on delete set null,
  cost numeric(14,2) check (cost is null or cost >= 0),
  currency char(3),
  status text not null default 'open' check (status in ('open','closed')),
  previous_status text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  result text
);
create index asset_maintenance_device_idx on asset_maintenance (device_id, opened_at desc);
create unique index asset_maintenance_open_idx on asset_maintenance (device_id) where status = 'open';

alter table asset_events enable row level security;
alter table asset_maintenance enable row level security;
grant all on asset_events, asset_maintenance to service_role;
grant usage, select on sequence asset_events_id_seq to service_role;

-- Time entries: approval when required (§22). Existing entries need none.
alter table time_entries add column if not exists approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected'));
alter table time_entries add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table time_entries add column if not exists approved_at timestamptz;
alter table time_entries add column if not exists rejection_reason text;
create index if not exists time_entries_pending_idx on time_entries (approval_status) where approval_status = 'pending';

insert into notification_templates (event_type, language, title, body, priority) values
  ('time.approval_requested', 'ar', 'ساعات بانتظار الاعتماد: {{payload.who}}', '{{payload.hours}} ساعة — {{payload.project}}', 'normal'),
  ('time.approval_requested', 'en', 'Hours awaiting approval: {{payload.who}}', '{{payload.hours}} h — {{payload.project}}', 'normal'),
  ('time.reviewed', 'ar', 'نتيجة اعتماد ساعاتك: {{payload.result}}', '{{payload.reason}}', 'normal'),
  ('time.reviewed', 'en', 'Your hours were {{payload.result}}', '{{payload.reason}}', 'normal'),
  ('asset.alert', 'ar', 'تنبيه أصول: {{payload.title}}', '{{payload.detail}}', 'normal'),
  ('asset.alert', 'en', 'Asset alert: {{payload.title}}', '{{payload.detail}}', 'normal')
on conflict (event_type, language) do nothing;
