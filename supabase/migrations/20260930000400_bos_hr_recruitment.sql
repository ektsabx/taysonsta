-- HR & Workforce — recruitment inside Team (docs/bos/28 §20–22, §36).
-- Extends the existing careers tables in place (IDs and rows preserved);
-- the public website and POST /api/careers/applications are unchanged —
-- candidates are linked by trigger.

-- ---------------------------------------------------------------------------
-- Job openings
-- ---------------------------------------------------------------------------

alter table career_jobs
  add column department_id uuid references departments(id) on delete set null,
  add column team_id uuid references teams(id) on delete set null,
  add column hiring_manager_id uuid references auth.users(id) on delete set null,
  add column openings integer not null default 1 check (openings > 0),
  add column status text not null default 'open' check (status in ('draft','open','on_hold','closed','filled')),
  add column closes_at date,
  add column salary_min numeric(14,3),
  add column salary_max numeric(14,3),
  add column salary_currency char(3) references currencies(code),
  add column created_by uuid references auth.users(id) on delete set null;

update career_jobs set status = case when is_published then 'open' else 'draft' end;

-- ---------------------------------------------------------------------------
-- Candidates (people) ← applications (person × job)
-- ---------------------------------------------------------------------------

create table candidates (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  country text,
  source text not null default 'website' check (source in ('website','referral','linkedin','agency','manual','other')),
  current_title text,
  years_experience numeric(4,1),
  expected_salary text,
  tags text[] not null default '{}',
  notes text,
  status text not null default 'active' check (status in ('active','hired','archived','blacklisted')),
  employee_id uuid references employees(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index candidates_email_idx on candidates (lower(email));

alter table career_applications
  add column candidate_id uuid references candidates(id) on delete restrict,
  add column source text not null default 'website' check (source in ('website','referral','linkedin','agency','manual','other')),
  add column rating numeric(2,1) check (rating is null or rating between 1 and 5),
  add column rejection_reason text,
  add column stage_changed_at timestamptz;

alter table career_applications drop constraint career_applications_status_check;
alter table career_applications add constraint career_applications_status_check
  check (status in ('new','in_review','contacted','interview','evaluation','accepted','offer','offer_accepted','hired','rejected','withdrawn'));

create or replace function public.bos_link_candidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if new.candidate_id is null then
    select id into v_id from candidates where lower(email) = lower(new.email);
    if v_id is null then
      insert into candidates (first_name, last_name, email, phone, country, source, years_experience, expected_salary)
      values (new.first_name, new.last_name, new.email, new.phone, new.country, coalesce(new.source, 'website'), new.years_experience, new.expected_salary)
      returning id into v_id;
    else
      update candidates set phone = coalesce(new.phone, phone), country = coalesce(new.country, country),
             years_experience = coalesce(new.years_experience, years_experience), expected_salary = coalesce(new.expected_salary, expected_salary), updated_at = now()
       where id = v_id;
    end if;
    new.candidate_id := v_id;
  end if;
  if new.stage_changed_at is null then new.stage_changed_at := coalesce(new.created_at, now()); end if;
  return new;
end;
$$;
create trigger career_applications_link_candidate before insert on career_applications for each row execute function bos_link_candidate();

-- Backfill existing applications (one candidate per e-mail).
insert into candidates (first_name, last_name, email, phone, country, years_experience, expected_salary, created_at)
select distinct on (lower(a.email)) a.first_name, a.last_name, a.email, a.phone, a.country, a.years_experience, a.expected_salary, a.created_at
from career_applications a
where not exists (select 1 from candidates c where lower(c.email) = lower(a.email))
order by lower(a.email), a.created_at desc;
update career_applications a set candidate_id = c.id, stage_changed_at = coalesce(a.stage_changed_at, a.updated_at)
from candidates c where lower(c.email) = lower(a.email) and a.candidate_id is null;
alter table career_applications alter column candidate_id set not null;

-- ---------------------------------------------------------------------------
-- Interviews: scheduling (BOS meetings / calendar) + structured feedback
-- ---------------------------------------------------------------------------

alter table career_interviews
  add column interviewer_user_id uuid references auth.users(id) on delete set null,
  add column duration_minutes integer not null default 60 check (duration_minutes between 5 and 600),
  add column meeting_link text,
  add column location text,
  add column status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  add column meeting_id uuid references meetings(id) on delete set null;

update career_interviews set status = case when outcome in ('passed','failed') then 'completed' else 'scheduled' end;

create table interview_feedback (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references career_interviews(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  recommendation text not null check (recommendation in ('strong_yes','yes','no','strong_no')),
  strengths text,
  concerns text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, reviewer_user_id)
);

-- ---------------------------------------------------------------------------
-- Job offers (§22)
-- ---------------------------------------------------------------------------

create table job_offers (
  id uuid primary key default gen_random_uuid(),
  offer_number text unique,
  application_id uuid not null references career_applications(id) on delete restrict,
  candidate_id uuid not null references candidates(id) on delete restrict,
  job_id uuid not null references career_jobs(id) on delete restrict,
  position_title text not null,
  department_id uuid references departments(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  manager_employee_id uuid references employees(id) on delete set null,
  employment_type employment_type not null default 'full_time',
  start_date date not null,
  basic_salary numeric(14,3) not null check (basic_salary >= 0),
  currency char(3) not null references currencies(code),
  allowances jsonb not null default '[]'::jsonb,
  probation_months integer not null default 3 check (probation_months between 0 and 12),
  expires_at date not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','withdrawn')),
  sent_at timestamptz,
  responded_at timestamptz,
  response_note text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index job_offers_live_idx on job_offers (application_id) where status in ('draft','sent','accepted');

create trigger candidates_touch before update on candidates for each row execute function bos_touch_updated_at();
create trigger interview_feedback_touch before update on interview_feedback for each row execute function bos_touch_updated_at();
create trigger job_offers_touch before update on job_offers for each row execute function bos_touch_updated_at();

alter table candidates enable row level security;
alter table interview_feedback enable row level security;
alter table job_offers enable row level security;

grant all on all tables in schema public to service_role;
revoke execute on function public.bos_link_candidate() from public, anon, authenticated;
