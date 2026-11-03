insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261223000000', 'admin_llm_ops', '{}')
on conflict (version) do nothing;
