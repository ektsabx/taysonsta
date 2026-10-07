-- Master upgrade Phase 3 (docs/bos/30 §6, doc 31): invitation tracking,
-- Google sign-in audit and page-level restrictions. No passwords or OAuth
-- secrets are stored here (Google client secret lives in Supabase Auth).

create table user_invitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  email text not null,
  status text not null default 'sent' check (status in ('sent','accepted','revoked')),
  sent_count int not null default 1,
  last_sent_at timestamptz not null default now(),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index user_invitations_employee_idx on user_invitations (employee_id, created_at desc);
create unique index user_invitations_open_idx on user_invitations (lower(email)) where status = 'sent';

-- Existing logins that never signed in count as open invitations.
insert into user_invitations (user_id, employee_id, email, status, last_sent_at, created_at)
select u.id, e.id, lower(u.email), case when u.last_sign_in_at is null then 'sent' else 'accepted' end,
       coalesce(u.invited_at, u.created_at), coalesce(u.invited_at, u.created_at)
from employees e join auth.users u on u.id = e.user_id
where u.email is not null
on conflict do nothing;

-- Sign-in method on the login history (password / google).
alter table login_history add column if not exists method text not null default 'password' check (method in ('password','google','magic_link'));

alter table user_invitations enable row level security;
grant all on user_invitations to service_role;
