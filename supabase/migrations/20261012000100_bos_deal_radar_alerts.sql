-- Phase 13 / doc 30 §20: "deal near closing / needs attention → Deal Radar alert" to the deal owner (daily sweep).
insert into notification_templates (event_type, language, title, body, priority) values
  ('deal.radar_alert', 'ar', 'رادار الصفقات: {{payload.title}}', '{{payload.reason}}', 'high'),
  ('deal.radar_alert', 'en', 'Deal Radar: {{payload.title}}', '{{payload.reason}}', 'high')
on conflict (event_type, language) do nothing;

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select 'deal.radar_alert', 'relation', 'owner', '{in_app}', true
where not exists (select 1 from notification_subscriptions s where s.event_type = 'deal.radar_alert' and s.relation = 'owner');
