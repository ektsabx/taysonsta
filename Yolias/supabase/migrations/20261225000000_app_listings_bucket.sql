-- Integrations (owner, 2026-11-05): screenshots and new add-on versions that
-- Yolias Admin uploads for the Integrations pages. Public read; writes only
-- through the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-listings', 'app-listings', true, 26214400, array['image/png', 'image/jpeg', 'image/webp', 'application/zip', 'application/x-zip-compressed'])
on conflict (id) do nothing;
