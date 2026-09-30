-- Master upgrade Phase 14 (docs/bos/30 §19; doc 31): e-signatures through a
-- provider (DocuSign) or offline signing, for any generated document
-- (contracts, proposals, HR documents, NDAs, handovers …). Additive only.

insert into document_sequences (key, prefix, padding) values ('signature_request', 'SR-', 6) on conflict (key) do nothing;

create table signature_requests (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default bos_next_number('signature_request'),
  document_id uuid not null references generated_documents(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  provider text not null check (provider in ('docusign','offline')),
  connection_id uuid references integration_connections(id) on delete set null,
  external_id text,                                   -- DocuSign envelope id
  signing_order text not null default 'sequential' check (signing_order in ('sequential','parallel')),
  subject text,
  message text,
  status text not null default 'draft' check (status in ('draft','sent','delivered','partially_signed','completed','declined','voided','expired','failed')),
  expires_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  signed_file_id uuid references files(id) on delete set null,
  last_error text,
  last_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index signature_requests_external_idx on signature_requests (provider, external_id) where external_id is not null;
create index signature_requests_entity_idx on signature_requests (entity_type, entity_id);
create trigger signature_requests_touch before update on signature_requests for each row execute function bos_touch_updated_at();

create table signature_signers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references signature_requests(id) on delete cascade,
  recipient_id int not null,
  name text not null,
  email text not null,
  role text not null default 'client' check (role in ('client','company','employee','witness','other')),
  routing_order int not null default 1,
  contact_id uuid references contacts(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'created' check (status in ('created','sent','delivered','signed','declined','voided')),
  delivered_at timestamptz,
  signed_at timestamptz,
  declined_reason text,
  unique (request_id, recipient_id)
);

create table signature_events (
  id bigserial primary key,
  request_id uuid not null references signature_requests(id) on delete cascade,
  event text not null,
  detail text,
  source text not null check (source in ('user','provider','webhook','sweep')),
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index signature_events_request_idx on signature_events (request_id, occurred_at);

alter table signature_requests enable row level security;
alter table signature_signers enable row level security;
alter table signature_events enable row level security;
grant all on signature_requests, signature_signers, signature_events to service_role;
grant usage, select on sequence signature_events_id_seq to service_role;

insert into notification_templates (event_type, language, title, body, priority) values
  ('esign.completed', 'ar', 'اكتمل التوقيع: {{payload.title}}', 'النسخة الموقعة محفوظة مع السجل.', 'high'),
  ('esign.completed', 'en', 'Signing completed: {{payload.title}}', 'The signed copy is stored with the record.', 'high'),
  ('esign.declined', 'ar', 'رُفض التوقيع: {{payload.title}}', '{{payload.reason}}', 'urgent'),
  ('esign.declined', 'en', 'Signature declined: {{payload.title}}', '{{payload.reason}}', 'urgent'),
  ('esign.signer_signed', 'ar', 'وقّع {{payload.signer}}: {{payload.title}}', null, 'normal'),
  ('esign.signer_signed', 'en', '{{payload.signer}} signed: {{payload.title}}', null, 'normal'),
  ('esign.expired', 'ar', 'انتهت مهلة التوقيع: {{payload.title}}', null, 'high'),
  ('esign.expired', 'en', 'Signing expired: {{payload.title}}', null, 'high')
on conflict (event_type, language) do nothing;

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select v.e, 'relation', 'creator', '{in_app}', true
from (values ('esign.completed'), ('esign.declined'), ('esign.signer_signed'), ('esign.expired')) as v(e)
where not exists (select 1 from notification_subscriptions s where s.event_type = v.e and s.relation = 'creator');
