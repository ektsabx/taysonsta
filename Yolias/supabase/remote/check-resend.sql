-- Read only: is the Resend connection copied to Yolias (D-251)? Provider and timestamps only, never the key.
select provider, updated_at
from public.integration_keys
where provider in ('resend', 'resend_webhook', 'turnstile');
