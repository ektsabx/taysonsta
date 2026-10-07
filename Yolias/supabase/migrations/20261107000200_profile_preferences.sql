-- Account preferences (owner request, 2026-10-07):
-- 1) Theme: Light or Dark only, dark by default. The device's system setting
--    no longer decides; accounts on "system" become dark.
-- 2) Time zone: detected from the browser at onboarding and saved; any IANA
--    zone is accepted (validated by the app), so it is never forced to Riyadh.
update public.profiles set theme = 'dark' where theme not in ('light', 'dark');
alter table public.profiles alter column theme set default 'dark';
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check check (theme in ('light', 'dark'));
alter table public.profiles add constraint profiles_timezone_check check (char_length(timezone) between 1 and 64);
