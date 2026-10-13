-- Support messages reach the staff member by email (owner, 2026-10-13, D-207).
-- The assigned person gets an email (and the in-app notification) for a new
-- conversation, a new customer message or an assignment; while nobody is
-- assigned (e.g. the AI agent is answering), the conversation's support team
-- members get it instead.
alter table public.notification_subscriptions drop constraint if exists notification_subscriptions_relation_check;
alter table public.notification_subscriptions add constraint notification_subscriptions_relation_check
  check (relation in ('assignee','owner','creator','pm','bd','account_manager','manager_of_actor','manager_of_assignee','project_members','approver','employee','previous_assignee','support_team'));

update public.notification_subscriptions set channels = array['in_app','email']::text[]
where subscriber_kind = 'relation' and relation = 'assignee'
  and event_type in ('conversation.customer_message', 'conversation.assigned');

insert into public.notification_subscriptions (event_type, subscriber_kind, relation, channels, user_configurable)
select 'conversation.customer_message', 'relation', 'support_team', array['in_app','email']::text[], true
where not exists (select 1 from public.notification_subscriptions where event_type = 'conversation.customer_message' and relation = 'support_team');

-- The email shows the customer's message, not only who wrote.
update public.notification_templates set body = '{{payload.message}}' where event_type = 'conversation.customer_message';
