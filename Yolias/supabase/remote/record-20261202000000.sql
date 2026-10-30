insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261202000000', 'contacts_shown', '{}')
on conflict (version) do nothing;
