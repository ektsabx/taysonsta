-- Master upgrade Phase 7 (docs/bos/30 §10.2): notifications for the inbox.
insert into notification_templates (event_type, language, title, body, priority) values
  ('conversation.created', 'ar', 'محادثة دعم جديدة: {{payload.title}}', null, 'high'),
  ('conversation.created', 'en', 'New support conversation: {{payload.title}}', null, 'high'),
  ('conversation.customer_message', 'ar', 'رد جديد من العميل: {{payload.title}}', '{{summary}}', 'high'),
  ('conversation.customer_message', 'en', 'New customer reply: {{payload.title}}', '{{summary}}', 'high'),
  ('conversation.assigned', 'ar', 'أُسندت إليك محادثة: {{payload.title}}', null, 'high'),
  ('conversation.assigned', 'en', 'Conversation assigned to you: {{payload.title}}', null, 'high'),
  ('conversation.escalated', 'ar', 'تصعيد محادثة: {{payload.title}}', '{{payload.reason}}', 'urgent'),
  ('conversation.escalated', 'en', 'Conversation escalated: {{payload.title}}', '{{payload.reason}}', 'urgent')
on conflict (event_type, language) do nothing;

insert into notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select v.event_type, 'relation', v.relation, '{in_app}', true
from (values ('conversation.customer_message', 'assignee'), ('conversation.assigned', 'assignee'), ('conversation.created', 'assignee')) as v(event_type, relation)
where not exists (select 1 from notification_subscriptions s where s.event_type = v.event_type and s.relation = v.relation);
