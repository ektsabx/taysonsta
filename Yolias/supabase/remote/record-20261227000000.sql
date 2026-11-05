insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261227000000', 'tags_files_mailboxes', '{}') on conflict (version) do nothing;
