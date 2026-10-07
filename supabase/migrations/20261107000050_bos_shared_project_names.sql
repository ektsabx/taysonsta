-- One Supabase project for Yolias and Yolias Admin (owner decision,
-- 2026-10-07): four Admin tables had the same names as Yolias tables, so the
-- Admin's are now bos_conversations, bos_invoices, bos_notifications and
-- bos_payments (the earlier migrations were updated to create them with these
-- names). This migration renames them in a database that already has the old
-- names — with their indexes, constraints and triggers — and rewrites the
-- functions that used the old names. It does nothing where the tables already
-- have the new names, or where the old name is Yolias's table.
do $$
declare
  t record;
  r record;
  def text;
  moved boolean := false;
begin
  for t in select * from (values
    ('conversations', 'customer_id'),
    ('invoices', 'invoice_number'),
    ('notifications', 'event_type'),
    ('payments', 'payment_number')
  ) v(name, marker) loop
    if to_regclass('public.bos_' || t.name) is null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t.name and column_name = t.marker
    ) then
      execute format('alter table public.%I rename to %I', t.name, 'bos_' || t.name);
      for r in select c.relname from pg_index i join pg_class c on c.oid = i.indexrelid
               where i.indrelid = ('public.bos_' || t.name)::regclass and c.relname like t.name || '\_%' loop
        execute format('alter index public.%I rename to %I', r.relname, 'bos_' || r.relname);
      end loop;
      for r in select conname from pg_constraint
               where conrelid = ('public.bos_' || t.name)::regclass and conname like t.name || '\_%'
                 and conname not in (select relname from pg_class where relnamespace = 'public'::regnamespace) loop
        execute format('alter table public.%I rename constraint %I to %I', 'bos_' || t.name, r.conname, 'bos_' || r.conname);
      end loop;
      for r in select tgname from pg_trigger
               where tgrelid = ('public.bos_' || t.name)::regclass and not tgisinternal and tgname like t.name || '\_%' loop
        execute format('alter trigger %I on public.%I rename to %I', r.tgname, 'bos_' || t.name, 'bos_' || r.tgname);
      end loop;
      moved := true;
    end if;
  end loop;

  if not moved then return; end if;

  -- Function bodies refer to tables by name: rewrite the ones that used the
  -- old names (not inside quotes, so permission and module keys stay).
  for r in
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.prosrc ~ '(^|[^\w.''"])(conversations|invoices|notifications|payments)\M'
  loop
    def := pg_get_functiondef(r.oid);
    def := regexp_replace(def, '(^|[^\w.''"])(public\.)?(conversations|invoices|notifications|payments)\M(?![''"])', '\1\2bos_\3', 'g');
    execute def;
  end loop;
end $$;
