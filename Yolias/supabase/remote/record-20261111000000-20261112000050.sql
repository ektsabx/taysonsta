insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261111000000', 'acquisition_workspace', '{}'),
  ('20261112000000', 'round2', '{}'),
  ('20261112000050', 'support_email', '{}')
on conflict (version) do nothing;
