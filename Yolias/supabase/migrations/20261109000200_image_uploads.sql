-- Image uploads (2026-10-12, D-182): PNG, JPEG or WebP up to 10 MB for the
-- avatar and bug-report screenshot buckets, enforced by Storage too (the app
-- also checks the real file signature on the server).
update storage.buckets
   set file_size_limit = 10485760, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id in ('avatars', 'bug-screenshots');
