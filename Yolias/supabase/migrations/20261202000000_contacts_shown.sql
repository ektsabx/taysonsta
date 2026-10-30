-- Contacts are shown as soon as Yolias delivers a person (owner, 2026-10-30,
-- D-268): no "Reveal" step. Revealing never cost a prospect, so nothing about
-- usage changes; existing people are marked shown, new ones on insert.
update public.prospects set revealed_at = coalesce(saved_at, created_at, now()) where revealed_at is null;

create or replace function public.prospects_shown() returns trigger
language plpgsql set search_path = public as $$
begin
  new.revealed_at := coalesce(new.revealed_at, now());
  return new;
end $$;
drop trigger if exists prospects_shown on public.prospects;
create trigger prospects_shown before insert on public.prospects
  for each row execute function public.prospects_shown();
