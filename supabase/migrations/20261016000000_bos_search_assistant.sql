-- Master upgrade Phase 17 (docs/bos/30 §25–26; doc 31): unified search over
-- more record types with Arabic letter normalisation, and the business AI
-- assistant's conversation history. Additive (bos_search is re-created with
-- the same signature; results are still permission-filtered in the service).

create or replace function public.bos_norm(p text) returns text language sql immutable parallel safe as $$
  select translate(lower(coalesce(p, '')), 'أإآٱىةـًٌٍَُِّْ', 'اااايه')
$$;

create or replace function public.bos_search(p_q text, p_types text[] default null, p_limit integer default 8)
returns table (entity_type text, id uuid, title text, subtitle text, owner_id uuid, client_id uuid, project_id uuid, rank real)
language sql
stable
as $$
  with q as (select trim(p_q) as t, '%' || bos_norm(replace(replace(trim(p_q), '%', ''), '_', '')) || '%' as pat)
  (select 'lead', l.id, l.name, coalesce(l.company_name, l.email), l.assigned_to, l.client_id, null::uuid, greatest(extensions.similarity(l.name, q.t), extensions.similarity(coalesce(l.company_name, ''), q.t))
     from leads l, q where (p_types is null or 'lead' = any(p_types)) and l.archived_at is null
       and (bos_norm(l.name) like q.pat or bos_norm(l.company_name) like q.pat or lower(l.email) like q.pat or lower(l.lead_number) like q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'contact', c.id, c.full_name, coalesce(c.email, c.position), c.created_by, c.client_id, null, extensions.similarity(c.full_name, q.t)
     from contacts c, q where (p_types is null or 'contact' = any(p_types)) and c.archived_at is null
       and (bos_norm(c.full_name) like q.pat or lower(c.email) like q.pat or c.phone like q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'client', c.id, c.name, coalesce(c.company_name, c.email), c.account_manager_id, c.id, null, greatest(extensions.similarity(c.name, q.t), extensions.similarity(coalesce(c.company_name, ''), q.t))
     from clients c, q where (p_types is null or 'client' = any(p_types)) and c.archived_at is null
       and (bos_norm(c.name) like q.pat or bos_norm(c.company_name) like q.pat or lower(c.email) like q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'deal', d.id, d.name, d.deal_number || ' · ' || d.value || ' ' || d.currency, d.assigned_to, d.client_id, null, extensions.similarity(d.name, q.t)
     from deals d, q where (p_types is null or 'deal' = any(p_types)) and d.archived_at is null
       and (bos_norm(d.name) like q.pat or lower(d.deal_number) like q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'project', p.id, p.name, p.project_number, p.pm_id, p.client_id, p.id, extensions.similarity(p.name, q.t)
     from projects p, q where (p_types is null or 'project' = any(p_types)) and p.archived_at is null
       and (bos_norm(p.name) like q.pat or lower(p.project_number) like q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'task', t.id, t.title, t.status::text, t.assigned_to, t.client_id, t.project_id, extensions.similarity(t.title, q.t)
     from tasks t, q where (p_types is null or 'task' = any(p_types)) and t.archived_at is null and bos_norm(t.title) like q.pat
     order by 8 desc limit p_limit)
  union all
  (select 'file', f.id, f.name, coalesce(f.entity_type, 'file'), f.uploaded_by, null, null, extensions.similarity(f.name, q.t)
     from files f, q where (p_types is null or 'file' = any(p_types)) and f.deleted_at is null and f.is_finalized and bos_norm(f.name) like q.pat
     order by 8 desc limit p_limit)
  union all
  (select 'ticket', t.id, t.subject, t.ticket_number || ' · ' || t.status, t.assigned_to, t.client_id, t.project_id, extensions.similarity(t.subject, q.t)
     from tickets t, q where (p_types is null or 'ticket' = any(p_types)) and (bos_norm(t.subject) like q.pat or lower(t.ticket_number) like q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'kb_article', a.id, a.title, a.kind::text, a.author_id, null, null, extensions.similarity(a.title, q.t)
     from kb_articles a, q where (p_types is null or 'kb_article' = any(p_types)) and a.status <> 'archived'
       and (bos_norm(a.title) like q.pat or a.search @@ plainto_tsquery('simple', q.t))
     order by 8 desc limit p_limit)
  union all
  -- Phase 17 additions
  (select 'employee', e.id, e.full_name, coalesce(e.position, e.email), e.user_id, null, null, extensions.similarity(e.full_name, q.t)
     from employees e, q where (p_types is null or 'employee' = any(p_types)) and e.archived_at is null
       and (bos_norm(e.full_name) like q.pat or lower(e.email) like q.pat or lower(e.employee_code) like q.pat or bos_norm(e.position) like q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'invoice', i.id, i.invoice_number, i.status::text || ' · ' || i.total || ' ' || i.currency, i.created_by, i.client_id, i.project_id, extensions.similarity(i.invoice_number, q.t)
     from invoices i, q where (p_types is null or 'invoice' = any(p_types)) and lower(i.invoice_number) like q.pat
     order by 8 desc limit p_limit)
  union all
  (select 'expense', x.id, x.description, x.amount || ' ' || x.currency || ' · ' || x.expense_date, coalesce(x.employee_user_id, x.created_by), x.client_id, x.project_id, extensions.similarity(x.description, q.t)
     from expenses x, q where (p_types is null or 'expense' = any(p_types)) and x.archived_at is null and bos_norm(x.description) like q.pat
     order by 8 desc limit p_limit)
  union all
  (select 'meeting', m.id, m.title, to_char(m.start_at, 'YYYY-MM-DD HH24:MI'), m.organizer_id, m.client_id, m.project_id, extensions.similarity(m.title, q.t)
     from meetings m, q where (p_types is null or 'meeting' = any(p_types)) and bos_norm(m.title) like q.pat
     order by 8 desc limit p_limit)
  union all
  (select 'document', g.id, g.title, g.number || ' · ' || g.status, g.created_by, null, null, extensions.similarity(g.title, q.t)
     from generated_documents g, q where (p_types is null or 'document' = any(p_types)) and g.status <> 'void'
       and (bos_norm(g.title) like q.pat or lower(g.number) like q.pat or lower(coalesce(g.reference, '')) like q.pat)
     order by 8 desc limit p_limit)
  union all
  (select 'conversation', v.id, coalesce(v.subject, v.number), v.number || ' · ' || v.status || ' · ' || coalesce(sc.name, ''), v.assignee_id, v.client_id, null, extensions.similarity(coalesce(v.subject, ''), q.t)
     from conversations v join support_customers sc on sc.id = v.customer_id, q where (p_types is null or 'conversation' = any(p_types))
       and (bos_norm(v.subject) like q.pat or lower(v.number) like q.pat or bos_norm(sc.name) like q.pat or lower(coalesce(sc.email, '')) like q.pat)
     order by 8 desc limit p_limit);
$$;
revoke execute on function public.bos_search(text, text[], integer) from public, anon, authenticated;
grant execute on function public.bos_search(text, text[], integer) to service_role;

-- Business AI assistant: per-user threads (follow-up questions keep context).
create table assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_threads_user_idx on assistant_threads (user_id, updated_at desc);

create table assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references assistant_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  tools jsonb not null default '[]'::jsonb,      -- tools run + their data (sources, last updated)
  provider text,
  created_at timestamptz not null default now()
);
create index assistant_messages_thread_idx on assistant_messages (thread_id, created_at);

alter table assistant_threads enable row level security;
alter table assistant_messages enable row level security;
grant all on assistant_threads, assistant_messages to service_role;
