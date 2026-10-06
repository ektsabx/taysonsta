-- Final spec phase 5: the Prospects workspace.
--  * Members save company / local-business results like people (saved_at),
--    and may change nothing else on those rows (column privilege + RLS).
--  * Contact reveal: when a member first revealed a person's contact
--    details (shown masked until then), recorded for the audit trail.
--  * Decision-maker matching: finding the people at a saved company is a
--    background job; its state is shown on the company.

create policy "members save companies" on public.companies for update
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
revoke update on public.companies from authenticated;

alter table public.prospects
  add column revealed_at timestamptz,
  add column revealed_by uuid references auth.users(id) on delete set null;

alter table public.companies
  add column people_status text check (people_status in ('queued', 'running', 'done', 'no_source', 'no_quota', 'failed')),
  add column people_requested_at timestamptz,
  add column people_found int not null default 0;
grant update (saved_at, people_requested_at) on public.companies to authenticated;

create index prospects_saved_idx on public.prospects(workspace_id, saved_at desc) where saved_at is not null;
create index companies_saved_idx on public.companies(workspace_id, kind, saved_at desc) where saved_at is not null;
