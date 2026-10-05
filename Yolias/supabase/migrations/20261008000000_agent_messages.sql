-- Saved Yolias AI conversations (D-115): one conversation per search
-- (strategy), shown under the search result. The user's turns are written
-- with the user's own client (RLS); the assistant's by server code only, so a
-- browser can never forge an assistant reply.

create table public.agent_messages (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) between 1 and 20000),
  -- Assistant turns: tool iterations and cost, for support and the admin.
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index agent_messages_strategy_idx on public.agent_messages (strategy_id, id);

alter table public.agent_messages enable row level security;
create policy "members read conversations" on public.agent_messages
  for select using (public.is_workspace_member(workspace_id));
create policy "members add their own turns" on public.agent_messages
  for insert with check (
    role = 'user' and user_id = auth.uid() and public.is_workspace_member(workspace_id)
    and exists (select 1 from public.strategies s where s.id = strategy_id and s.workspace_id = agent_messages.workspace_id)
  );
grant select, insert on public.agent_messages to authenticated;
