insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261130000000', 'meetings', '{}')
on conflict (version) do nothing;
