-- HR & Workforce demo data (LOCAL demo only — docs/bos/28). Idempotent:
-- safe to re-run. Uses the seeded staff from seed-bos.sql.
begin;

-- Employee categories
insert into employee_categories (name, description, sort_order) values
  ('إداري', 'الوظائف الإدارية والمساندة', 10),
  ('فني / تنفيذي', 'فرق التنفيذ والتسليم', 20),
  ('مبيعات', 'فرق المبيعات وتطوير الأعمال', 30)
on conflict (name) do nothing;

update employees e set category_id = c.id,
  work_location = coalesce(e.work_location, 'القاهرة — المقر الرئيسي')
from departments d, employee_categories c
where d.id = e.department_id
  and c.name = case d.name when 'Sales' then 'مبيعات' when 'Delivery' then 'فني / تنفيذي' else 'إداري' end
  and e.category_id is null;

-- Schedules: the spec example (Sat & Fri off, Sun–Thu 09:00–17:00), shifts, night, flexible
insert into work_schedules (name, schedule_type, work_days, start_time, end_time, break_minutes, timezone, grace_minutes, half_day_minutes, overtime_after_minutes, is_default, description)
select v.name, v.type, v.days::smallint[], v.st::time, v.en::time, v.brk, 'Africa/Cairo', 15, 240, 0, false, v.descr
from (values
  ('الدوام القياسي 9–5', 'fixed', '{0,1,2,3,4}', '09:00', '17:00', 60, 'السبت والجمعة راحة'),
  ('الوردية الصباحية A', 'shift', '{0,1,2,3,4,6}', '08:00', '16:00', 30, 'فريق الدعم — وردية A'),
  ('الوردية المسائية B', 'shift', '{0,1,2,3,4,6}', '14:00', '22:00', 30, 'فريق الدعم — وردية B'),
  ('وردية ليلية', 'night', '{0,1,2,3,4}', '22:00', '06:00', 30, 'تعبر منتصف الليل'),
  ('دوام مرن 8 ساعات', 'flexible', '{0,1,2,3,4}', '09:00', '17:00', 0, 'أي وقت — 8 ساعات يومياً')
) as v(name, type, days, st, en, brk, descr)
where not exists (select 1 from work_schedules w where w.name = v.name);
update work_schedules set required_minutes = 480 where name = 'دوام مرن 8 ساعات' and required_minutes is null;

-- Support team works shifts: team-level assignment from the start of this month
insert into schedule_assignments (schedule_id, scope, department_id, effective_from, notes, created_by)
select w.id, 'department', d.id, date_trunc('month', current_date)::date, 'Operations — الدوام القياسي', (select id from auth.users where email = 'hr@taysonsta.local')
from work_schedules w, departments d
where w.name = 'الدوام القياسي 9–5' and d.name = 'Operations'
  and not exists (select 1 from schedule_assignments a where a.scope = 'department' and a.department_id = d.id);

-- Public holidays (Egypt, 2026) + a company day
insert into holidays (date, name, kind, country, is_paid) values
  ('2026-10-06', 'عيد القوات المسلحة', 'public', null, true),
  ('2026-12-31', 'يوم الشركة السنوي', 'company', null, true)
on conflict do nothing;

-- Compensation for active employees (EGP) + fixed allowances
insert into employee_compensation (employee_id, effective_from, basic_salary, currency, change_type, reason, approval_status, created_by, decided_at)
select e.id, coalesce(e.start_date, date '2026-01-01'),
       case d.name when 'Sales' then 22000 when 'Delivery' then 26000 when 'Finance' then 24000 when 'HR' then 21000 else 30000 end,
       'EGP', 'initial', 'Demo salary', 'approved', (select id from auth.users where email = 'hr@taysonsta.local'), now()
from employees e left join departments d on d.id = e.department_id
where e.lifecycle_status in ('active', 'on_leave', 'onboarding') and e.email not like 'testhire%'
  and not exists (select 1 from employee_compensation c where c.employee_id = e.id);

insert into employee_salary_components (employee_id, component_id, amount, effective_from, created_by)
select e.id, c.id, case c.key when 'housing' then 10 else 1500 end, date '2026-01-01', (select id from auth.users where email = 'hr@taysonsta.local')
from employees e join salary_components c on c.key in ('housing', 'transportation')
where e.lifecycle_status in ('active', 'on_leave', 'onboarding') and e.email not like 'testhire%'
  and not exists (select 1 from employee_salary_components x where x.employee_id = e.id and x.component_id = c.id);
update salary_components set calc_type = 'percent_of_basic' where key = 'housing' and not exists (select 1 from payroll_runs);

-- Private data (demo values)
insert into employee_private (employee_id, date_of_birth, gender, nationality, address, national_id, bank_name, bank_account_name, bank_account_number, emergency_contact_name, emergency_contact_relation, emergency_contact_phone)
select e.id, date '1994-05-10', case when e.full_name ~ '(Sara|Laila|Mona|Dina|Hana|Nour|Mariam)' then 'female' else 'male' end, 'مصري', 'القاهرة',
       '2940510' || lpad((row_number() over (order by e.full_name))::text, 7, '0'), 'CIB', e.full_name, 'EG' || lpad((row_number() over (order by e.full_name))::text, 12, '0'),
       'جهة اتصال ' || split_part(e.full_name, ' ', 1), 'أخ / أخت', '+20100000000' || (row_number() over (order by e.full_name)) % 10
from employees e
where e.email not like 'testhire%' and not exists (select 1 from employee_private p where p.employee_id = e.id);

-- Employee file: documents (metadata; files are uploaded from the UI)
insert into employee_documents (employee_id, document_type_id, title, document_number, issue_date, expiry_date, status, uploaded_by)
select e.id, t.id, t.name || ' — ' || e.full_name,
       case t.key when 'national_id' then 'NID-' || substr(e.id::text, 1, 6) else null end,
       date '2024-01-15', case t.key when 'national_id' then current_date + 20 else null end,
       'pending_verification', (select id from auth.users where email = 'hr@taysonsta.local')
from employees e join document_types t on t.key in ('national_id', 'cv')
where e.email in ('sara@taysonsta.local', 'ahmed@taysonsta.local', 'nour@taysonsta.local')
  and not exists (select 1 from employee_documents d where d.employee_id = e.id and d.document_type_id = t.id);

-- Employee contracts: one expiring soon (alert), one open-ended
insert into employee_contracts (contract_number, employee_id, contract_type, title, version, start_date, end_date, status, signature_status, employee_signed_at, company_signed_at, position_title, basic_salary, currency, notice_period_days, created_by)
select 'EC-DEMO-' || substr(e.id::text, 1, 4), e.id, 'employment', 'عقد عمل — ' || e.full_name, 1, coalesce(e.start_date, date '2025-11-01'),
       case when e.email = 'sara@taysonsta.local' then current_date + 25 else null end,
       'active', 'signed', now(), now(), e.position, 22000, 'EGP', 30, (select id from auth.users where email = 'hr@taysonsta.local')
from employees e
where e.email in ('sara@taysonsta.local', 'ahmed@taysonsta.local')
  and not exists (select 1 from employee_contracts k where k.employee_id = e.id);

-- Loan (30,000 EGP / 10 installments — spec example) and a bonus
insert into employee_loans (loan_number, employee_id, user_id, loan_type, amount, currency, installments, installment_amount, start_period, reason, status, requested_by, decided_at, disbursed_at, disbursement_reference)
select 'LN-DEMO-1', e.id, e.user_id, 'loan', 30000, 'EGP', 10, 3000, date_trunc('month', current_date)::date, 'قرض شخصي', 'active', e.user_id, now(), now(), 'TRX-DEMO'
from employees e where e.email = 'ahmed@taysonsta.local'
  and not exists (select 1 from employee_loans l where l.loan_number = 'LN-DEMO-1');
insert into loan_installments (loan_id, seq, due_period, amount)
select l.id, g, (date_trunc('month', current_date) + make_interval(months => g - 1))::date, 3000
from employee_loans l cross join generate_series(1, 10) g
where l.loan_number = 'LN-DEMO-1' and not exists (select 1 from loan_installments i where i.loan_id = l.id);

insert into employee_bonuses (employee_id, user_id, bonus_type, title, amount, currency, reason, pay_period, status, requested_by, decided_at)
select e.id, e.user_id, 'performance', 'مكافأة أداء الربع الثالث', 2500, 'EGP', 'تحقيق المستهدف', date_trunc('month', current_date)::date, 'approved', (select id from auth.users where email = 'sales.manager@taysonsta.local'), now()
from employees e where e.email = 'sara@taysonsta.local'
  and not exists (select 1 from employee_bonuses b where b.employee_id = e.id and b.title = 'مكافأة أداء الربع الثالث');

-- Recruitment: three applications for the first published job (candidates are linked by trigger)
insert into career_applications (job_id, first_name, last_name, phone, email, instagram_handle, country, age, education_status, years_experience, bio, why_fit, expected_salary, source, status)
select j.id, v.fn, v.ln, v.phone, v.email, '—', 'Egypt', v.age, 'Bachelor', v.exp, 'Demo applicant', 'Demo', v.sal, v.src, v.st
from (select id from career_jobs where is_published order by created_at limit 1) j
cross join (values
  ('Omar', 'Khaled', '+201011111111', 'omar.khaled@example.test', 27, 4, '25000', 'website', 'new'),
  ('Yasmin', 'Adel', '+201022222222', 'yasmin.adel@example.test', 25, 3, '22000', 'linkedin', 'interview'),
  ('Mahmoud', 'Saeed', '+201033333333', 'mahmoud.saeed@example.test', 30, 6, '30000', 'referral', 'in_review')
) as v(fn, ln, phone, email, age, exp, sal, src, st)
where not exists (select 1 from career_applications a where lower(a.email) = v.email);

-- A review cycle
insert into review_cycles (name, cycle_type, period_start, period_end, status, self_assessment, peer_feedback)
select 'تقييم النصف الثاني 2026', 'semi_annual', date '2026-07-01', date '2026-12-31', 'draft', true, true
where not exists (select 1 from review_cycles where name = 'تقييم النصف الثاني 2026');

commit;
