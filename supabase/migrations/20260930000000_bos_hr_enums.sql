-- HR & Workforce (docs/bos/28, 29): new enum values. Kept in their own
-- migration because a value added by ALTER TYPE cannot be used in the same
-- transaction. Additive only — existing rows keep their values.

alter type employee_lifecycle_status add value if not exists 'terminated' after 'offboarding';
alter type attendance_status add value if not exists 'day_off';

alter type approval_type add value if not exists 'payroll';
alter type approval_type add value if not exists 'loan';
alter type approval_type add value if not exists 'bonus';
alter type approval_type add value if not exists 'hr_request';
alter type approval_type add value if not exists 'job_offer';
alter type approval_type add value if not exists 'salary_adjustment';
