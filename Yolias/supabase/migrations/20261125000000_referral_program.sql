-- Referral program (owner, 2026-10-28): every workspace has an invite link
-- (www.yolias.com/i/<code>). When someone opens it and creates a new Yolias
-- account, the inviting workspace gets prospects (50 by default) that never
-- expire, as a usage_ledger grant. Separate from the affiliate program
-- (Yolias Partners, cash commission). The reward and a monthly cap are in
-- site_settings "referral_program" (Yolias Admin). Rows are written by the
-- server only; members read their workspace's referrals.

alter table public.workspaces
  add column if not exists referral_code text;

update public.workspaces set referral_code = substr(md5(gen_random_uuid()::text), 1, 10) where referral_code is null;

alter table public.workspaces
  alter column referral_code set default substr(md5(gen_random_uuid()::text), 1, 10),
  alter column referral_code set not null;

create unique index if not exists workspaces_referral_code_key on public.workspaces (referral_code);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  referred_workspace_id uuid references public.workspaces(id) on delete set null,
  -- rewarded: prospects granted; capped: over the monthly cap, nothing granted; rejected: not counted (reason).
  status text not null check (status in ('rewarded', 'capped', 'rejected')),
  reason text,
  prospects int not null default 0 check (prospects >= 0),
  signup_ip text,
  created_at timestamptz not null default now()
);

-- An account is referred once, ever.
create unique index if not exists referrals_referred_user_key on public.referrals (referred_user_id);
create index if not exists referrals_referrer_idx on public.referrals (referrer_workspace_id, created_at desc);

alter table public.referrals enable row level security;
drop policy if exists "members read their referrals" on public.referrals;
create policy "members read their referrals" on public.referrals for select using (public.is_workspace_member(referrer_workspace_id));
grant select on public.referrals to authenticated;

insert into public.site_settings (key, value)
values ('referral_program', '{"enabled": true, "prospects": 50, "monthly_cap": 20}'::jsonb)
on conflict (key) do nothing;
