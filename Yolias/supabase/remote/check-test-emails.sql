select created_at, status, error, to_email, subject
from public.email_log
where source = 'test'
order by created_at desc
limit 10;
