insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261127000000', 'sales_emails', '{}')
on conflict (version) do nothing;
