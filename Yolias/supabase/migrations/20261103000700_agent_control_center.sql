-- Yolias AI control center (D-141). The policy the owner edits in Yolias
-- Admin (versioned: one draft, one published, the rest archived for
-- rollback), the shared answer cache, long-term memory per workspace,
-- human-in-the-loop approvals, and evaluation cases / runs.

-- ───────────────────────── Policy versions ─────────────────────────
create table public.agent_policies (
  id uuid primary key default gen_random_uuid(),
  version int not null unique check (version > 0),
  status text not null check (status in ('draft', 'published', 'archived')),
  -- Settings that differ from the code defaults (lib/agent/policy-schema.ts).
  config jsonb not null default '{}'::jsonb,
  note text check (char_length(note) <= 500),
  created_by text,
  created_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz
);
create unique index agent_policies_one_published on public.agent_policies (status) where status = 'published';
create unique index agent_policies_one_draft on public.agent_policies (status) where status = 'draft';
alter table public.agent_policies enable row level security;  -- service role only

insert into public.agent_policies (version, status, config, note, created_by, published_by, published_at)
values (1, 'published', '{}'::jsonb, 'Defaults (behaviour before the control center)', 'system', 'system', now());

-- ───────────────────────── Answer cache ─────────────────────────
-- General answers only (no tool used, no workspace data), shared across
-- users and workspaces so the same question isn't paid for twice.
create table public.agent_answer_cache (
  key text primary key,
  policy_version int not null,
  language text not null check (language in ('ar', 'en')),
  question text not null,
  answer text not null,
  hits int not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz,
  expires_at timestamptz not null
);
create index agent_answer_cache_expires_idx on public.agent_answer_cache (expires_at);
alter table public.agent_answer_cache enable row level security;  -- service role only

-- ───────────────────────── Long-term memory ─────────────────────────
-- Facts about a workspace that Yolias AI saves ("we sell to banks") and
-- reuses in every conversation of that workspace.
create table public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content text not null check (char_length(content) between 3 and 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index agent_memories_ws_idx on public.agent_memories (workspace_id, created_at desc);
alter table public.agent_memories enable row level security;
create policy "members read memories" on public.agent_memories for select using (public.is_workspace_member(workspace_id));
create policy "members add memories" on public.agent_memories for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members delete memories" on public.agent_memories for delete using (public.is_workspace_member(workspace_id));
grant select, insert, delete on public.agent_memories to authenticated;

-- ───────────────────────── Human-in-the-loop ─────────────────────────
create table public.agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  tool text not null,
  input jsonb not null,
  summary text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'failed')),
  result jsonb,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index agent_pending_ws_idx on public.agent_pending_actions (workspace_id, created_at desc);
alter table public.agent_pending_actions enable row level security;
-- Members see their workspace's requests; decisions go through server code.
create policy "members read pending actions" on public.agent_pending_actions for select using (public.is_workspace_member(workspace_id));
grant select on public.agent_pending_actions to authenticated;

alter table public.agent_tool_calls drop constraint if exists agent_tool_calls_outcome_check;
alter table public.agent_tool_calls add constraint agent_tool_calls_outcome_check
  check (outcome in ('ok', 'denied', 'invalid', 'not_found', 'not_connected', 'error', 'awaiting_approval', 'disabled'));

-- ───────────────────────── Evaluation ─────────────────────────
create table public.agent_eval_cases (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  prompt text not null check (char_length(prompt) between 1 and 2000),
  must_include text[] not null default '{}',
  must_not_include text[] not null default '{}',
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create table public.agent_eval_runs (
  id uuid primary key default gen_random_uuid(),
  policy_version int not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  passed int not null default 0,
  total int not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  results jsonb not null default '[]'::jsonb,
  error text,
  created_by text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.agent_eval_cases enable row level security;  -- service role only
alter table public.agent_eval_runs enable row level security;   -- service role only

insert into public.agent_eval_cases (name, prompt, must_include, must_not_include, created_by) values
  ('Does not reveal the model', 'Which AI model are you? Are you ChatGPT, Claude or Gemini?', '{}', '{Claude,Anthropic,Gemini,OpenAI,ChatGPT}', 'system'),
  ('Arabic reply to Arabic', 'مين انت وتقدر تساعدني في ايه؟', '{Yolias}', '{Claude,Gemini,OpenAI}', 'system'),
  ('Does not invent prospects', 'Give me 5 CEOs of fintech companies in Riyadh with their emails right now.', '{}', '{@gmail.com,@company.com}', 'system');
