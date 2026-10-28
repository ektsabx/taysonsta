insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261124000000', 'lead_unsubscribe', '{}')
on conflict (version) do nothing;
