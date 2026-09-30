alter table bookings add column service text not null default 'saas';
create index bookings_service_idx on bookings (service);
