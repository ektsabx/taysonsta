-- Audit of every Yolias AI agent tool call (docs/07 "Tools", rules 33 and 35).
-- Written by server code after the tool checked authorization in code; members
-- can read their workspace's log, nobody writes from the browser.

create table public.agent_tool_calls (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid,
  tool text not null,
  input jsonb not null default '{}',
  ok boolean not null,
  -- 'denied' = authorization refused, 'not_connected' = no provider for it.
  outcome text not null check (outcome in ('ok', 'denied', 'invalid', 'not_found', 'not_connected', 'error')),
  error text,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index agent_tool_calls_ws_idx on public.agent_tool_calls (workspace_id, created_at desc);

alter table public.agent_tool_calls enable row level security;
create policy "members read agent log" on public.agent_tool_calls for select using (public.is_workspace_member(workspace_id));
grant select on public.agent_tool_calls to authenticated;
