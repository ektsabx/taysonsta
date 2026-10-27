insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261123000000', 'seo_control_center', '{}')
on conflict (version) do nothing;
