-- Guest emails (confirmation, reminders, rebook, cancel) go out in the
-- language the guest booked in: the booking page's language, or the language
-- of the campaign email the lead replied to.
alter table public.sales_meetings add column if not exists guest_locale text not null default 'en' check (guest_locale in ('en', 'ar'));

-- Disconnecting Google Calendar drops the token but keeps the row (marked
-- disconnected) so a later reconnect of the same Google account reuses the
-- "Yolias meetings" calendar instead of creating a second one.
create or replace function public.disconnect_calendar(p_user uuid) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  select token_secret_id into v_id from public.calendar_connections where user_id = p_user for update;
  update public.calendar_connections set status = 'disconnected', token_secret_id = null, error = null where user_id = p_user;
  if v_id is not null then delete from vault.secrets where id = v_id; end if;
end $$;

revoke execute on function public.disconnect_calendar(uuid) from public, anon, authenticated;
