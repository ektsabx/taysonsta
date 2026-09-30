-- Taysonsta BOS — Phase 6: internal communication & knowledge.
-- See docs/bos/14-communication.md and 15-knowledge-base.md.

create type channel_kind as enum ('direct','team','project','entity');
create type kb_kind as enum ('article','sop','playbook','documentation','policy','onboarding_guide');
create type playbook_section as enum ('outreach_templates','discovery_questions','objection_handling','pricing_rules','qualification_framework','follow_up_sequences','proposal_templates','closing_process');

create table channels (
  id uuid primary key default gen_random_uuid(),
  kind channel_kind not null,
  name text not null,
  description text,
  team_id uuid references teams(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  direct_key text unique,
  is_private boolean not null default true,
  client_visible boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index channels_project_idx on channels (project_id) where kind = 'project' and not client_visible;
create unique index channels_project_client_idx on channels (project_id) where kind = 'project' and client_visible;
create index channels_client_idx on channels (client_id);
create index channels_deal_idx on channels (deal_id);

create table channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index channel_members_user_idx on channel_members (user_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_contact_id uuid references contacts(id) on delete set null,
  body text not null check (length(body) between 1 and 10000),
  parent_id uuid references messages(id) on delete cascade,
  is_system boolean not null default false,
  event_id bigint references activity_events(id) on delete set null,
  linked_entity_type text,
  linked_entity_id uuid,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', coalesce(body, ''))) stored
);
create index messages_channel_idx on messages (channel_id, created_at desc);
create index messages_parent_idx on messages (parent_id);
create index messages_search_idx on messages using gin (search);

create table message_mentions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (message_id, user_id)
);
create index message_mentions_user_idx on message_mentions (user_id);

create table kb_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  sort_order integer not null default 0
);

insert into kb_categories (key, name, sort_order) values
  ('sales', 'Sales', 1), ('product', 'Product', 2), ('development', 'Development', 3), ('operations', 'Operations', 4),
  ('finance', 'Finance', 5), ('hr', 'HR', 6), ('company', 'Company', 7), ('client_delivery', 'Client Delivery', 8);

create table kb_articles (
  id uuid primary key default gen_random_uuid(),
  kind kb_kind not null default 'article',
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  content text not null default '' check (length(content) <= 200000),
  category_id uuid references kb_categories(id) on delete set null,
  tags text[] not null default '{}',
  author_id uuid references auth.users(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  allowed_role_ids uuid[],
  playbook_section playbook_section,
  required_documents text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) stored,
  check (kind <> 'playbook' or playbook_section is not null)
);
create index kb_articles_search_idx on kb_articles using gin (search);
create index kb_articles_kind_idx on kb_articles (kind, status);
create index kb_articles_title_trgm_idx on kb_articles using gin (title extensions.gin_trgm_ops);

create table kb_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references kb_articles(id) on delete cascade,
  version integer not null,
  title text not null,
  content text not null,
  edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (article_id, version)
);

create table sop_steps (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references kb_articles(id) on delete cascade,
  kind text not null default 'step' check (kind in ('step','checklist')),
  sort_order integer not null default 0,
  title text not null,
  description text
);
create index sop_steps_article_idx on sop_steps (article_id, kind, sort_order);

create table kb_article_reads (
  article_id uuid not null references kb_articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  read_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

-- Structural seed: the SOPs and playbook sections named by the spec (§43,
-- §44) and the policy pages referenced by the employee onboarding checklist.
-- Seeded as drafts: owners must review/complete content before publishing.
insert into kb_articles (kind, slug, title, content, category_id, status)
select 'sop', s.slug, s.title, s.body, (select id from kb_categories where key = s.cat), 'draft'
from (values
  ('sop-qualify-a-lead', 'How to qualify a lead', 'sales', 'Qualification uses four 0–25 scores in the BOS lead record (budget, fit, intent, engagement). A lead with a total score at or above the company threshold (Settings → Pipeline) can move to Qualified.'),
  ('sop-run-discovery', 'How to run discovery', 'sales', 'Schedule the discovery meeting from the lead or deal page so it appears on the timeline and calendar. Record the outcome and next action after the call; the BOS creates the follow-up task.'),
  ('sop-prepare-proposal', 'How to prepare proposal', 'sales', 'Create the proposal from the deal so client, pricing and payment terms are pre-filled. Submit for internal review when required, then publish to send it to the client.'),
  ('sop-close-a-deal', 'How to close a deal', 'sales', 'A deal can be marked Won once payment terms total 100% (and a signed contract exists if the company requires it). Marking Won automatically creates the project, payment schedule, first invoice, commission and client onboarding.'),
  ('sop-handoff-a-project', 'How to handoff a project', 'client_delivery', 'After Deal Won the PM reviews the auto-created project, milestones and tasks, confirms the team, and schedules the kickoff meeting.'),
  ('sop-onboard-a-client', 'How to onboard a client', 'client_delivery', 'Work through the client onboarding checklist on the account page. Items such as contract signed, initial payment, project created and team assigned complete automatically.'),
  ('sop-handle-change-requests', 'How to handle change requests', 'client_delivery', 'Log every out-of-scope request as a change request on the project. Move it through Assessment and Proposal, request client approval, and add approved requests to the project so budget, timeline and scope update.'),
  ('sop-launch-a-project', 'How to launch a project', 'client_delivery', 'Launch requires QA passed and client review complete. Request final delivery approval from the client through the portal before launch.'),
  ('sop-close-a-project', 'How to close a project', 'client_delivery', 'A project completes when required tasks are done, QA has no open critical/major bugs, the client approved final delivery and final payment is received (unless company settings allow otherwise). Completion starts the support period and an upsell review.')
) as s(slug, title, cat, body);

insert into sop_steps (article_id, kind, sort_order, title)
select a.id, 'step', x.ord, x.title
from kb_articles a
join (values
  ('sop-qualify-a-lead', 1, 'Review company, budget and timeline'), ('sop-qualify-a-lead', 2, 'Score budget, fit, intent and engagement'),
  ('sop-qualify-a-lead', 3, 'Confirm decision maker'), ('sop-qualify-a-lead', 4, 'Move the lead to Qualified or Lost with a reason'),
  ('sop-run-discovery', 1, 'Schedule the meeting from the lead/deal'), ('sop-run-discovery', 2, 'Use the discovery questions playbook'),
  ('sop-run-discovery', 3, 'Record outcome and next action'), ('sop-run-discovery', 4, 'Complete the follow-up task'),
  ('sop-prepare-proposal', 1, 'Create proposal from the deal'), ('sop-prepare-proposal', 2, 'Complete scope, deliverables, timeline and pricing'),
  ('sop-prepare-proposal', 3, 'Check payment schedule totals 100%'), ('sop-prepare-proposal', 4, 'Submit for internal review'), ('sop-prepare-proposal', 5, 'Publish and create client access'),
  ('sop-close-a-deal', 1, 'Confirm accepted proposal'), ('sop-close-a-deal', 2, 'Record contract signature'), ('sop-close-a-deal', 3, 'Mark the deal Won'),
  ('sop-handoff-a-project', 1, 'Review project, milestones and tasks'), ('sop-handoff-a-project', 2, 'Confirm team members'), ('sop-handoff-a-project', 3, 'Schedule kickoff'),
  ('sop-onboard-a-client', 1, 'Collect client information'), ('sop-onboard-a-client', 2, 'Request assets'), ('sop-onboard-a-client', 3, 'Confirm scope'), ('sop-onboard-a-client', 4, 'Start the project'),
  ('sop-handle-change-requests', 1, 'Log the change request'), ('sop-handle-change-requests', 2, 'Assess impact, cost and timeline'), ('sop-handle-change-requests', 3, 'Request client approval'), ('sop-handle-change-requests', 4, 'Add to project'),
  ('sop-launch-a-project', 1, 'Confirm QA passed'), ('sop-launch-a-project', 2, 'Complete client review'), ('sop-launch-a-project', 3, 'Request final delivery approval'), ('sop-launch-a-project', 4, 'Launch'),
  ('sop-close-a-project', 1, 'Verify completion gate'), ('sop-close-a-project', 2, 'Complete project'), ('sop-close-a-project', 3, 'Send satisfaction request'), ('sop-close-a-project', 4, 'Review upsell opportunity')
) as x(slug, ord, title) on x.slug = a.slug;

insert into kb_articles (kind, slug, title, content, category_id, status, playbook_section)
select 'playbook', 'playbook-' || replace(s.section, '_', '-'), s.title, '', (select id from kb_categories where key = 'sales'), 'draft', s.section::playbook_section
from (values
  ('outreach_templates', 'Outreach templates'), ('discovery_questions', 'Discovery questions'), ('objection_handling', 'Objection handling'),
  ('pricing_rules', 'Pricing rules'), ('qualification_framework', 'Qualification framework'), ('follow_up_sequences', 'Follow-up sequences'),
  ('proposal_templates', 'Proposal templates'), ('closing_process', 'Closing process')
) as s(section, title);

insert into kb_articles (kind, slug, title, content, category_id, status)
select s.kind::kb_kind, s.slug, s.title, '', (select id from kb_categories where key = s.cat), 'draft'
from (values
  ('onboarding_guide', 'company-introduction', 'Company introduction', 'company'),
  ('policy', 'company-policies', 'Company policies', 'hr'),
  ('policy', 'security-guidelines', 'Security guidelines', 'operations'),
  ('policy', 'communication-guidelines', 'Communication guidelines', 'company')
) as s(kind, slug, title, cat);

insert into kb_article_versions (article_id, version, title, content)
select id, 1, title, content from kb_articles;

create trigger kb_articles_touch before update on kb_articles for each row execute function bos_touch_updated_at();

alter table channels enable row level security;
alter table channel_members enable row level security;
alter table messages enable row level security;
alter table message_mentions enable row level security;
alter table kb_categories enable row level security;
alter table kb_articles enable row level security;
alter table kb_article_versions enable row level security;
alter table sop_steps enable row level security;
alter table kb_article_reads enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
