insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261201000000', 'campaign_goals', '{}')
on conflict (version) do nothing;
