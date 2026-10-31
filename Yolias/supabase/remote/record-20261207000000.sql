insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261207000000', 'campaign_centric', '{}')
on conflict (version) do nothing;
