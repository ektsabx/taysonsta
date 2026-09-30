-- Taysonsta BOS — Phase 7: client experience (support + client portal).
-- Portal isolation is enforced twice: the server always scopes queries by
-- the caller's client (never a URL/body value), and RLS policies below
-- restrict the `authenticated` role to rows of portal_client_id() (§47, §94).
-- See docs/bos/18-client-portal.md and 19-support.md.

create type ticket_status as enum ('open','in_progress','waiting_for_client','resolved','closed');
create type bug_status as enum ('reported','triaged','in_progress','ready_for_qa','qa','fixed','closed');
create type feature_request_status as enum ('requested','review','approved','rejected','planned','in_development','released');

create table sla_policies (
  id uuid primary key default gen_random_uuid(),
  priority priority_level not null unique,
  first_response_minutes integer not null check (first_response_minutes > 0),
  resolution_minutes integer not null check (resolution_minutes > 0)
);

insert into sla_policies (priority, first_response_minutes, resolution_minutes) values
  ('urgent', 60, 480), ('high', 240, 1440), ('medium', 480, 4320), ('low', 1440, 10080);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default bos_next_number('ticket'),
  client_id uuid not null references clients(id) on delete restrict,
  contact_id uuid references contacts(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  category text not null default 'general',
  priority priority_level not null default 'medium',
  subject text not null check (length(trim(subject)) > 0),
  description text not null,
  assigned_to uuid references auth.users(id) on delete set null,
  status ticket_status not null default 'open',
  source text not null default 'internal' check (source in ('portal','email','internal')),
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_responded_at timestamptz,
  sla_breached_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_contact_id uuid references contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_client_idx on tickets (client_id);
create index tickets_status_idx on tickets (status, priority);
create index tickets_assigned_idx on tickets (assigned_to, status);
create index tickets_subject_trgm_idx on tickets using gin (subject extensions.gin_trgm_ops);

create or replace function public.bos_ticket_sla()
returns trigger
language plpgsql
as $$
declare
  v_sla sla_policies%rowtype;
begin
  if tg_op = 'INSERT' or new.priority is distinct from old.priority then
    select * into v_sla from sla_policies where priority = new.priority;
    if v_sla.id is not null then
      new.first_response_due_at := new.created_at + make_interval(mins => v_sla.first_response_minutes);
      new.resolution_due_at := new.created_at + make_interval(mins => v_sla.resolution_minutes);
    end if;
  end if;
  return new;
end;
$$;

create trigger tickets_sla before insert or update of priority on tickets for each row execute function bos_ticket_sla();

create or replace function public.bos_check_sla_breaches()
returns integer
language plpgsql
as $$
declare
  v_t record;
  v_n integer := 0;
begin
  for v_t in
    select * from tickets
    where sla_breached_at is null and status not in ('resolved','closed')
      and ((first_responded_at is null and first_response_due_at < now()) or resolution_due_at < now())
    for update skip locked
  loop
    update tickets set sla_breached_at = now() where id = v_t.id;
    perform bos_emit('ticket.sla_breached', 'ticket', v_t.id, null, 'SLA breached: ' || v_t.ticket_number || ' ' || v_t.subject,
      jsonb_build_object('ticket_id', v_t.id, 'assignee_user_id', v_t.assigned_to, 'client_id', v_t.client_id, 'priority', v_t.priority),
      jsonb_build_array(jsonb_build_object('type','client','id',v_t.client_id), jsonb_build_object('type','project','id',v_t.project_id)),
      'system', 'internal', 'ticket.sla_breached:' || v_t.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create table bugs (
  id uuid primary key default gen_random_uuid(),
  bug_number text not null unique default bos_next_number('bug'),
  project_id uuid not null references projects(id) on delete restrict,
  ticket_id uuid references tickets(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  environment text not null default 'production' check (environment in ('production','staging','development')),
  severity text not null default 'minor' check (severity in ('critical','major','minor','trivial')),
  priority priority_level not null default 'medium',
  description text,
  steps_to_reproduce text,
  expected_behavior text,
  actual_behavior text,
  assigned_to uuid references auth.users(id) on delete set null,
  reported_by_user_id uuid references auth.users(id) on delete set null,
  reported_by_contact_id uuid references contacts(id) on delete set null,
  status bug_status not null default 'reported',
  qa_status text not null default 'not_tested' check (qa_status in ('not_tested','passed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (environment <> 'production' or coalesce(length(trim(steps_to_reproduce)), 0) > 0)
);
create index bugs_project_idx on bugs (project_id, status);
create index bugs_assigned_idx on bugs (assigned_to, status);

create table feature_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  business_value text,
  priority priority_level not null default 'medium',
  estimated_effort_hours numeric(8,2) check (estimated_effort_hours is null or estimated_effort_hours >= 0),
  cost numeric(14,3) check (cost is null or cost >= 0),
  currency char(3) references currencies(code),
  status feature_request_status not null default 'requested',
  requested_by_contact_id uuid references contacts(id) on delete set null,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cost is null or currency is not null)
);
create index feature_requests_client_idx on feature_requests (client_id);
create index feature_requests_status_idx on feature_requests (status);

-- ---------------------------------------------------------------------------
-- Client portal users & isolation helpers
-- ---------------------------------------------------------------------------

create table client_portal_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete restrict,
  contact_id uuid references contacts(id) on delete set null,
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  last_login_at timestamptz
);
create index client_portal_users_client_idx on client_portal_users (client_id);

create or replace function public.portal_client_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select cpu.client_id
  from client_portal_users cpu
  join clients c on c.id = cpu.client_id
  where cpu.user_id = auth.uid()
    and cpu.status in ('invited','active')
    and c.archived_at is null
  limit 1;
$$;

-- Does the calling portal user's client own this entity?
create or replace function public.portal_owns_entity(p_type text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_client uuid := portal_client_id();
begin
  if v_client is null or p_id is null then
    return false;
  end if;
  return case p_type
    when 'client' then p_id = v_client
    when 'project' then exists (select 1 from projects where id = p_id and client_id = v_client)
    when 'milestone' then exists (select 1 from milestones m join projects p on p.id = m.project_id where m.id = p_id and p.client_id = v_client)
    when 'task' then exists (select 1 from tasks where id = p_id and client_id = v_client)
    when 'change_request' then exists (select 1 from change_requests where id = p_id and client_id = v_client)
    when 'ticket' then exists (select 1 from tickets where id = p_id and client_id = v_client)
    when 'invoice' then exists (select 1 from invoices where id = p_id and client_id = v_client)
    when 'contract' then exists (select 1 from contracts where id = p_id and client_id = v_client)
    when 'proposal' then exists (select 1 from proposals where id = p_id and client_id = v_client)
    when 'deal' then exists (select 1 from deals where id = p_id and client_id = v_client)
    when 'feature_request' then exists (select 1 from feature_requests where id = p_id and client_id = v_client)
    when 'bug' then exists (select 1 from bugs b join projects p on p.id = b.project_id where b.id = p_id and p.client_id = v_client)
    when 'approval' then exists (select 1 from approvals a where a.id = p_id and a.client_visible and portal_owns_entity(a.entity_type, a.entity_id))
    else false
  end;
end;
$$;

revoke all on function public.portal_client_id() from public;
revoke all on function public.portal_owns_entity(text, uuid) from public;
grant execute on function public.portal_client_id() to authenticated, service_role;
grant execute on function public.portal_owns_entity(text, uuid) to authenticated, service_role;

-- Portal users of the proposal's account may also read its published proposal.
create or replace function public.has_proposal_access(target_proposal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from proposal_access pa
    where pa.proposal_id = target_proposal_id and pa.auth_user_id = auth.uid()
  ) or exists (
    select 1 from proposals p
    where p.id = target_proposal_id and p.client_id = portal_client_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- Portal RLS policies (select only; portal mutations go through server
-- actions that re-derive the client from the session).
-- ---------------------------------------------------------------------------

grant select on public.clients, public.contacts, public.projects, public.milestones, public.files, public.approvals,
  public.change_requests, public.invoices, public.invoice_items, public.payments, public.tickets, public.meetings,
  public.comments, public.channels, public.messages, public.feature_requests, public.contracts, public.payment_schedules
to authenticated;

create policy "portal reads own account" on clients for select to authenticated using (id = portal_client_id());
create policy "portal reads own contacts" on contacts for select to authenticated using (client_id = portal_client_id());
create policy "portal reads own projects" on projects for select to authenticated using (client_id = portal_client_id() and archived_at is null);
create policy "portal reads own milestones" on milestones for select to authenticated using (portal_owns_entity('project', project_id));
create policy "portal reads client-visible files" on files for select to authenticated
  using (client_visible and deleted_at is null and is_finalized and portal_owns_entity(entity_type, entity_id));
create policy "portal reads client-visible approvals" on approvals for select to authenticated
  using (client_visible and portal_owns_entity(entity_type, entity_id));
create policy "portal reads own change requests" on change_requests for select to authenticated using (client_id = portal_client_id());
create policy "portal reads own invoices" on invoices for select to authenticated using (client_id = portal_client_id() and status <> 'draft');
create policy "portal reads own invoice items" on invoice_items for select to authenticated using (portal_owns_entity('invoice', invoice_id));
create policy "portal reads own payments" on payments for select to authenticated using (client_id = portal_client_id() and status in ('completed','refunded'));
create policy "portal reads own schedules" on payment_schedules for select to authenticated using (client_id = portal_client_id());
create policy "portal reads own tickets" on tickets for select to authenticated using (client_id = portal_client_id());
create policy "portal reads own meetings" on meetings for select to authenticated using (client_id = portal_client_id());
create policy "portal reads public comments" on comments for select to authenticated
  using (not is_internal and deleted_at is null and portal_owns_entity(entity_type, entity_id));
create policy "portal reads client channels" on channels for select to authenticated
  using (client_visible and client_id = portal_client_id() and archived_at is null);
create policy "portal reads client channel messages" on messages for select to authenticated
  using (deleted_at is null and exists (select 1 from channels c where c.id = channel_id and c.client_visible and c.client_id = portal_client_id()));
create policy "portal reads own feature requests" on feature_requests for select to authenticated using (client_id = portal_client_id());
create policy "portal reads own contracts" on contracts for select to authenticated using (client_id = portal_client_id() and status <> 'draft');

create trigger tickets_touch before update on tickets for each row execute function bos_touch_updated_at();
create trigger bugs_touch before update on bugs for each row execute function bos_touch_updated_at();
create trigger feature_requests_touch before update on feature_requests for each row execute function bos_touch_updated_at();

alter table sla_policies enable row level security;
alter table tickets enable row level security;
alter table bugs enable row level security;
alter table feature_requests enable row level security;
alter table client_portal_users enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
revoke execute on function public.bos_check_sla_breaches() from public, anon, authenticated;
