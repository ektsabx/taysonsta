-- Platform alerts (2026-10-12): Gemini spend, errors, payment failures, email
-- volume and database size, checked by the scheduled sweep
-- (services/yolias/alerts.ts). They reuse the notification system: an
-- "platform.alert" event → in-app + email to Super Admins and Admins, once
-- per alert per day (dedupe key). Thresholds live in bos_settings
-- ("platform_alerts"). Additive only.
insert into notification_subscriptions (event_type, subscriber_kind, role_id, channels, user_configurable)
select 'platform.alert', 'role', r.id, array['in_app','email'], false
from roles r
where r.key in ('super_admin', 'admin')
  and not exists (select 1 from notification_subscriptions s where s.event_type = 'platform.alert' and s.role_id = r.id);

insert into notification_templates (event_type, language, title, body, priority) values
  ('platform.alert', 'ar', '{{payload.title_ar}}', '{{payload.detail_ar}}', 'high'),
  ('platform.alert', 'en', '{{payload.title_en}}', '{{payload.detail_en}}', 'high')
on conflict (event_type, language) do nothing;
