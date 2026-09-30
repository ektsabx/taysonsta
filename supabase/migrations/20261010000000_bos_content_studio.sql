-- Master upgrade Phase 11 (docs/bos/30 §13; doc 31): Content Studio — ideas
-- through an editable lifecycle, tasks, AI writing drafts (never published
-- automatically), links to social posts for analytics. Additive only.

insert into document_sequences (key, prefix, padding) values ('content_item', 'CI-', 6) on conflict (key) do nothing;

-- Editable lifecycle. Core stages (is_core) can be renamed/reordered but not
-- removed; `gate` marks the approval stage and the stages that require it.
create table content_stages (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null,
  sort_order int not null,
  is_core boolean not null default false,
  requires_approval boolean not null default false,  -- entering this stage needs an approved item
  is_review boolean not null default false,          -- items here wait for an approver
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into content_stages (key, name, sort_order, is_core, requires_approval, is_review) values
  ('idea', 'فكرة', 10, true, false, false),
  ('brief', 'ملخص (Brief)', 20, false, false, false),
  ('script', 'سكريبت', 30, false, false, false),
  ('review', 'مراجعة', 40, true, false, true),
  ('approved', 'معتمد', 50, true, true, false),
  ('production', 'إنتاج', 60, false, true, false),
  ('editing', 'مونتاج', 70, false, true, false),
  ('ready', 'جاهز للنشر', 80, true, true, false),
  ('scheduled', 'مجدول', 90, false, true, false),
  ('published', 'منشور', 100, true, true, false),
  ('analyzed', 'تم التحليل', 110, false, true, false),
  ('archived', 'مؤرشف', 120, true, false, false)
on conflict (key) do nothing;

create table content_items (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default bos_next_number('content_item'),
  title text not null,
  description text,
  goal text,
  audience text,
  platforms text[] not null default '{}',
  content_type text not null default 'post' check (content_type in ('post','carousel','short_video','long_video','story','article','live','other')),
  hook text,
  key_message text,
  cta text,
  topic text,
  tags text[] not null default '{}',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  stage text not null default 'idea' references content_stages(key) on update cascade,
  owner_id uuid references auth.users(id) on delete set null,
  deadline date,
  publish_date timestamptz,
  script text,
  final_version text,
  video_length_sec int check (video_length_sec is null or video_length_sec between 1 and 36000),
  notes text,
  published_links text[] not null default '{}',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  review_note text,
  branch_id uuid references branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_stage_idx on content_items (stage, deadline);
create index content_items_owner_idx on content_items (owner_id);
create trigger content_items_touch before update on content_items for each row execute function bos_touch_updated_at();

create table content_tasks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references content_items(id) on delete cascade,
  title text not null,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  done_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_tasks_item_idx on content_tasks (item_id);

-- AI drafts: saved for editing/review; accepting copies into the item field.
create table content_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references content_items(id) on delete cascade,   -- null = ideas generated before an item exists
  kind text not null check (kind in ('ideas','video_ideas','hooks','script','captions','titles','descriptions','ctas','hashtags','variants','rewrite','angles','insights')),
  instructions text,
  output text not null,
  provider text,
  model text,
  status text not null default 'draft' check (status in ('draft','accepted','discarded')),
  accepted_into text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_ai_drafts_item_idx on content_ai_drafts (item_id, created_at desc);

-- Social posts already carry content_id (Phase 10); make it a real link.
alter table social_posts add constraint social_posts_content_fk foreign key (content_id) references content_items(id) on delete set null;
create index social_posts_content_idx on social_posts (content_id) where content_id is not null;

alter table content_stages enable row level security;
alter table content_items enable row level security;
alter table content_tasks enable row level security;
alter table content_ai_drafts enable row level security;
grant all on content_stages, content_items, content_tasks, content_ai_drafts to service_role;

insert into permissions (key, module, action, description)
select 'content.' || a::text, 'content', a, 'Content studio — ' || replace(a::text, '_', ' ')
from unnest(enum_range(null::permission_action)) as a
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, (case when r.key in ('super_admin','admin','executive','sales_manager') then 'all' else 'own' end)::permission_scope
from roles r join permissions p on p.module = 'content'
where (r.key in ('super_admin','admin'))
   or (r.key = 'sales_manager' and p.action::text in ('read','create','update','approve','manage','export','assign'))
   or (r.key in ('designer','developer') and p.action::text in ('read','create','update'))
   or (r.key in ('executive') and p.action::text in ('read','export'))
   or (r.key in ('business_development','account_manager') and p.action::text in ('read','create'))
on conflict (role_id, permission_id) do nothing;

insert into notification_templates (event_type, language, title, body, priority) values
  ('content.stage_changed', 'ar', 'المحتوى «{{payload.title}}» انتقل إلى: {{payload.stage}}', null, 'normal'),
  ('content.stage_changed', 'en', 'Content “{{payload.title}}” moved to: {{payload.stage}}', null, 'normal'),
  ('content.review_requested', 'ar', 'محتوى بانتظار المراجعة: {{payload.title}}', null, 'normal'),
  ('content.review_requested', 'en', 'Content awaiting review: {{payload.title}}', null, 'normal'),
  ('content.task_assigned', 'ar', 'مهمة محتوى: {{payload.task}}', '{{payload.title}}', 'normal'),
  ('content.task_assigned', 'en', 'Content task: {{payload.task}}', '{{payload.title}}', 'normal')
on conflict (event_type, language) do nothing;

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select v.e, 'relation', v.r, '{in_app}', true
from (values ('content.stage_changed','owner'), ('content.task_assigned','assignee')) as v(e, r)
where not exists (select 1 from notification_subscriptions s where s.event_type = v.e and s.relation = v.r);
