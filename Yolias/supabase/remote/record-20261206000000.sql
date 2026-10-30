insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261206000000', 'meeting_types', '{}')
on conflict (version) do nothing;
