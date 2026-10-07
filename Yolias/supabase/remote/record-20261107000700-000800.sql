-- Records the two Yolias migrations applied by hand on the shared production
-- project (db push refuses there because the Admin's migrations share the table).
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261107000700', 'workspace_activity', '{}'), ('20261107000800', 'prospect_definition_and_web_discovery', '{}')
on conflict (version) do nothing;
