-- Final spec phase 9: content management for the Yolias website (Help
-- Center, Docs, Blog, legal pages), edited in Yolias Admin. One row per page
-- with both languages. The site shows published rows; "hidden" removes a
-- page; pages not in the table fall back to the content shipped in code.
create table public.content_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('help', 'docs', 'blog', 'legal')),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  -- help: {collection}; docs: {group}; blog: {date, category: {en, ar}}
  meta jsonb not null default '{}'::jsonb,
  -- {en: {title, summary, blocks}, ar: {title, summary, blocks}}
  doc jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  sort int not null default 0,
  updated_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);
create trigger content_entries_updated_at before update on public.content_entries
  for each row execute function public.set_updated_at();
alter table public.content_entries enable row level security;
create policy "anyone reads published content" on public.content_entries for select using (status in ('published', 'hidden'));
grant select on public.content_entries to anon, authenticated;
