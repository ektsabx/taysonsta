insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261214000000', 'campaign_insights', '{}')
on conflict (version) do nothing;
