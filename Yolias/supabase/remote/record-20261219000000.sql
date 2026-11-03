insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261219000000', 'member_directory', '{}')
on conflict (version) do nothing;
