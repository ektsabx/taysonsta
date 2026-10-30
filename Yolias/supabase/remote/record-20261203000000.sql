insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261203000000', 'step_channels', '{}')
on conflict (version) do nothing;
