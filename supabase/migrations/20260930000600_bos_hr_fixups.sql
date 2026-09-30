-- The candidate link is always filled by the bos_link_candidate trigger;
-- keeping the column nullable keeps the public application insert (website
-- API) unchanged at the type level.
alter table career_applications alter column candidate_id drop not null;
