insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261220000000', 'mailbox_counter', '{}')
on conflict (version) do nothing;
