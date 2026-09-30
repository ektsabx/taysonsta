insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 209715200)
on conflict (id) do nothing;

create policy "public read media bucket" on storage.objects for select using (bucket_id = 'media');
create policy "service role manage media bucket" on storage.objects for all using (bucket_id = 'media' and auth.role() = 'service_role');
