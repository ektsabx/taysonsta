-- Phone number on the account (2026-10-12).
-- Kept apart from public.profiles on purpose: teammates can read each
-- other's profiles ("read teammates"), but a phone number is visible only to
-- its owner (and to Yolias staff through server code). Stored in E.164
-- (+ country code and number), validated on the server. Additive only.

create table if not exists public.user_phones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz not null default now()
);

alter table public.user_phones enable row level security;
drop policy if exists "own phone read" on public.user_phones;
drop policy if exists "own phone insert" on public.user_phones;
drop policy if exists "own phone update" on public.user_phones;
drop policy if exists "own phone delete" on public.user_phones;
create policy "own phone read" on public.user_phones for select using (user_id = auth.uid());
create policy "own phone insert" on public.user_phones for insert with check (user_id = auth.uid());
create policy "own phone update" on public.user_phones for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own phone delete" on public.user_phones for delete using (user_id = auth.uid());
grant select, insert, update, delete on public.user_phones to authenticated;

drop trigger if exists user_phones_updated_at on public.user_phones;
create trigger user_phones_updated_at before update on public.user_phones
  for each row execute function public.set_updated_at();
