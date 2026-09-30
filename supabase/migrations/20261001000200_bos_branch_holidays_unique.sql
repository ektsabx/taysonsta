-- Branch holidays (docs/bos/30 §3.2): the same date may be a holiday for a
-- single branch and also company-wide/another branch — uniqueness now
-- includes the branch.
drop index if exists holidays_date_country_idx;
create unique index holidays_date_country_idx on holidays (date, coalesce(country, ''), coalesce(branch_id::text, ''));
