-- Audit (2026-11-03): a mailbox's daily count is incremented in one
-- statement, so two worker runs at the same time can't both read the old
-- number and let a mailbox go over its daily limit.
create or replace function public.mailbox_count_sent(p_mailbox uuid, p_day date)
returns int
language sql
security definer
set search_path = public
as $$
  update public.mailboxes
     set sent_today = case when sent_day = p_day then sent_today + 1 else 1 end,
         sent_day = p_day
   where id = p_mailbox
  returning sent_today;
$$;
revoke all on function public.mailbox_count_sent(uuid, date) from public, anon, authenticated;
grant execute on function public.mailbox_count_sent(uuid, date) to service_role;
