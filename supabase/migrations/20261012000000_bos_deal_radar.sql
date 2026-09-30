-- Master upgrade Phase 13 (docs/bos/30 §17; doc 31): Deal Radar — risks,
-- blockers and delay reasons on deals. The radar itself is computed from the
-- existing CRM (deals, stages, activities, proposals, contracts). Additive.

create table deal_risks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  kind text not null check (kind in ('risk','blocker','delay_reason')),
  text text not null check (length(text) between 2 and 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index deal_risks_deal_idx on deal_risks (deal_id) where resolved_at is null;
alter table deal_risks enable row level security;
grant all on deal_risks to service_role;

insert into notification_templates (event_type, language, title, body, priority) values
  ('deal.radar_nudge', 'ar', 'متابعة مطلوبة للصفقة: {{payload.title}}', '{{payload.message}}', 'high'),
  ('deal.radar_nudge', 'en', 'Follow-up needed on deal: {{payload.title}}', '{{payload.message}}', 'high')
on conflict (event_type, language) do nothing;
