-- Open sources and verification (D-248). MillionVerifier verifies emails
-- (email.verify); it stays off until its key is saved in Yolias Admin →
-- Settings → Integrations, which also switches it on. The price per check is
-- set in Admin → Providers (unpriced until then, D-114).
insert into intel.providers (id, name, enabled, priority, capabilities, pricing, license_scope, storage_allowed, display_allowed, customer_facing_allowed, redistribution_allowed, derived_data_allowed, notes)
values ('millionverifier', 'MillionVerifier', false, 50, '{email.verify}', '{}', 'yolias_shared', true, true, true, true, true,
        'Email verification. Key from Settings → Integrations → MillionVerifier.')
on conflict (id) do nothing;
