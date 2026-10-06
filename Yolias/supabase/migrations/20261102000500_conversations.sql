-- Final spec phase 7: Yolias AI conversations, feedback and cost per call.
-- Three kinds of conversation:
--   user       private to its creator,
--   workspace  shared with every member,
--   campaign   the conversation of a search / campaign (was "one per search", D-115).
-- The user's turns are written with their own client (RLS); assistant turns
-- by server code only, so a browser can never forge a reply.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  scope text not null check (scope in ('user', 'workspace', 'campaign')),
  strategy_id uuid references public.strategies(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null default '' check (length(title) <= 200),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_campaign_shape check (scope <> 'campaign' or strategy_id is not null)
);
create unique index conversations_strategy_uq on public.conversations (strategy_id) where scope = 'campaign';
create index conversations_ws_idx on public.conversations (workspace_id, updated_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create or replace function public.can_read_conversation(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_id and public.is_workspace_member(c.workspace_id) and (c.scope <> 'user' or c.user_id = auth.uid())
  );
$$;

alter table public.conversations enable row level security;
create policy "members read conversations" on public.conversations for select
  using (public.is_workspace_member(workspace_id) and (scope <> 'user' or user_id = auth.uid()));
create policy "members start conversations" on public.conversations for insert
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id) and scope in ('user', 'workspace'));
create policy "creators rename or archive" on public.conversations for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert on public.conversations to authenticated;
grant update (title, archived_at) on public.conversations to authenticated;

-- ── Messages belong to a conversation ──
alter table public.agent_messages add column conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.agent_messages alter column strategy_id drop not null;

insert into public.conversations (workspace_id, scope, strategy_id, campaign_id, title, created_at)
select distinct on (m.strategy_id) m.workspace_id, 'campaign', m.strategy_id, c.id, s.title, min(m.created_at) over (partition by m.strategy_id)
from public.agent_messages m
join public.strategies s on s.id = m.strategy_id
left join public.campaigns c on c.strategy_id = m.strategy_id
order by m.strategy_id;
update public.agent_messages m set conversation_id = c.id
from public.conversations c where c.scope = 'campaign' and c.strategy_id = m.strategy_id and m.conversation_id is null;
alter table public.agent_messages alter column conversation_id set not null;
create index agent_messages_conversation_idx on public.agent_messages (conversation_id, id);

drop policy if exists "members read conversations" on public.agent_messages;
drop policy if exists "members add their own turns" on public.agent_messages;
create policy "readers of the conversation read its turns" on public.agent_messages
  for select using (public.can_read_conversation(conversation_id));
create policy "members add their own turns" on public.agent_messages
  for insert with check (
    role = 'user' and user_id = auth.uid() and public.can_read_conversation(conversation_id)
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.workspace_id = agent_messages.workspace_id)
  );

-- ── Feedback on assistant replies (like / dislike) ──
create table public.agent_feedback (
  message_id bigint not null references public.agent_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.agent_feedback enable row level security;
create policy "own feedback" on public.agent_feedback for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.agent_messages m where m.id = message_id and m.role = 'assistant' and public.can_read_conversation(m.conversation_id))
  );
grant select, insert, update, delete on public.agent_feedback to authenticated;

-- ── Cost per call and per tool call ──
alter table public.agent_tool_calls
  add column cost_usd numeric(12, 6),          -- provider calls the tool made; null = none or unpriced
  add column unpriced_calls int not null default 0;
alter table intel.llm_calls add column conversation_id uuid;
create index llm_calls_conversation_idx on intel.llm_calls (conversation_id) where conversation_id is not null;

-- ── Orchestrator routes (D-008 defaults; edited in Yolias Admin) ──
-- research = web research summaries (Gemini first), extract = classification /
-- extraction (the smallest model), agent = reasoning (Claude). A route whose
-- provider has no key is skipped, so the next one serves.
update intel.settings
set value = jsonb_build_object(
  'research', jsonb_build_array(jsonb_build_object('provider', 'gemini', 'model', 'gemini-2.5-pro'), jsonb_build_object('provider', 'anthropic', 'model', 'claude-opus-5-5')),
  'extract', jsonb_build_array(jsonb_build_object('provider', 'anthropic', 'model', 'claude-haiku-4-5-20251001'), jsonb_build_object('provider', 'gemini', 'model', 'gemini-2.5-flash'))
) || value
where key = 'llm_routing';
