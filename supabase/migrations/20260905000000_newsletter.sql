create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;

grant all on public.newsletter_subscribers to service_role;
