-- Master upgrade Phase 5 (docs/bos/30 §3.5, §8; doc 31): central document &
-- email templates with immutable versions, and generated documents that are
-- frozen at issue (the sent/signed copy never changes).

create table document_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]{3,60}$'),
  name text not null,
  doc_type text not null check (doc_type in ('proposal','client_contract','invoice','email','job_offer','employment_contract','nda_ip','maintenance_agreement','license_certificate','handover_certificate','hr_document','report')),
  language text not null check (language in ('ar','en')),
  module text not null default 'general',
  description text,
  is_active boolean not null default true,
  is_system boolean not null default false,
  edit_role_keys text[] not null default '{}',        -- empty = anyone with documents.manage
  current_version_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index document_templates_type_idx on document_templates (doc_type, language) where is_active;
create trigger document_templates_touch before update on document_templates for each row execute function bos_touch_updated_at();

create table document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references document_templates(id) on delete cascade,
  version int not null,
  subject text,                                        -- email templates
  body text not null,                                  -- document markup with {{variables}}
  style jsonb not null default '{"primary":"#e51f26","accent":"#111827","fontSize":11,"showLogo":true}'::jsonb,
  header_note text,                                    -- extra header line (optional)
  footer_note text,
  change_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);
alter table document_templates add constraint document_templates_current_version_fk foreign key (current_version_id) references document_template_versions(id) on delete set null;

-- Versions are immutable: a change is always a new version.
create or replace function public.bos_template_version_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Template versions are immutable — create a new version' using errcode = 'P0001';
end $$;
create trigger document_template_versions_no_update before update or delete on document_template_versions
  for each row when (pg_trigger_depth() = 0) execute function bos_template_version_immutable();

insert into document_sequences (key, prefix, padding) values ('document', 'DOC-', 6) on conflict (key) do nothing;

create table generated_documents (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default bos_next_number('document'),
  template_id uuid references document_templates(id) on delete set null,
  template_version_id uuid references document_template_versions(id) on delete set null,
  doc_type text not null,
  language text not null check (language in ('ar','en')),
  entity_type text not null,
  entity_id uuid not null,
  reference text,                                       -- the record's own number (INV-…, CT-…)
  title text not null,
  data_snapshot jsonb not null,                         -- resolved variables at issue time
  markup text not null,                                 -- rendered markup (frozen)
  rendered_html text not null,
  style jsonb not null,
  content_hash text not null,                           -- sha256 of markup + frame
  docx_path text,
  status text not null default 'issued' check (status in ('issued','sent','signed','void')),
  sent_at timestamptz,
  sent_to text[],
  void_reason text,
  voided_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index generated_documents_entity_idx on generated_documents (entity_type, entity_id, created_at desc);
create index generated_documents_type_idx on generated_documents (doc_type, created_at desc);

-- Issued documents are frozen: only status / delivery fields may change, and
-- nothing is ever deleted (void instead).
create or replace function public.bos_generated_document_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Generated documents cannot be deleted — void them instead' using errcode = 'P0001';
  end if;
  if new.markup is distinct from old.markup or new.rendered_html is distinct from old.rendered_html
     or new.data_snapshot is distinct from old.data_snapshot or new.content_hash is distinct from old.content_hash
     or new.template_version_id is distinct from old.template_version_id or new.title is distinct from old.title
     or new.number is distinct from old.number or new.entity_id is distinct from old.entity_id or new.language is distinct from old.language
     or (old.docx_path is not null and new.docx_path is distinct from old.docx_path) then
    raise exception 'Issued documents are immutable' using errcode = 'P0001';
  end if;
  if old.status = 'void' then
    raise exception 'A void document cannot change' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger generated_documents_guard before update or delete on generated_documents
  for each row when (pg_trigger_depth() = 0) execute function bos_generated_document_guard();

alter table document_templates enable row level security;
alter table document_template_versions enable row level security;
alter table generated_documents enable row level security;
grant all on document_templates, document_template_versions, generated_documents to service_role;

-- Permissions: documents module.
insert into permissions (key, module, action, description)
select 'documents.' || a::text, 'documents', a, 'Documents & templates — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'all'
from roles r join permissions p on p.module = 'documents'
where r.key in ('super_admin','admin')
   or (r.key in ('executive','finance','hr','sales_manager','business_development','account_manager','project_manager') and p.action::text in ('read','create','export'))
on conflict (role_id, permission_id) do nothing;
