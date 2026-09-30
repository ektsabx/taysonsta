-- Master upgrade Phase 6 (docs/bos/30 §9.3): WhatsApp and SMS delivery
-- channels are tracked like email/push (sent once Phase 9 connects them).
alter table notification_deliveries drop constraint if exists notification_deliveries_channel_check;
alter table notification_deliveries add constraint notification_deliveries_channel_check check (channel in ('email','push','whatsapp','sms'));
create index if not exists notification_deliveries_queue_idx on notification_deliveries (status, next_attempt_at) where status in ('queued','failed');
