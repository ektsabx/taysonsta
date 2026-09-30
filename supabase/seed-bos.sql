-- Taysonsta BOS — development/demo seed data (§92).
-- LOCAL ONLY. Run with: npm run seed:bos   (refuses non-local databases)
-- All users share the dev password: Taysonsta!2026
-- Business records are created through the same SQL lifecycle functions the
-- app uses (bos_process_deal_won, bos_record_payment, bos_clock_in …) so the
-- timeline, status history, audit log and notifications are realistic.

begin;

-- ---------------------------------------------------------------------------
-- Staff users (one per major role)
-- ---------------------------------------------------------------------------
create temporary table seed_users (email text, full_name text, role_key text, position text, dept text) on commit drop;
insert into seed_users values
  ('admin@taysonsta.local', 'Youssef Admin', 'super_admin', 'Founder / Super Admin', 'Operations'),
  ('exec@taysonsta.local', 'Mona Executive', 'executive', 'CEO', 'Operations'),
  ('sales.manager@taysonsta.local', 'Karim Sales Manager', 'sales_manager', 'Sales Manager', 'Sales'),
  ('ahmed@taysonsta.local', 'Ahmed Mohamed', 'business_development', 'Business Development Executive', 'Sales'),
  ('sara@taysonsta.local', 'Sara Hassan', 'business_development', 'Business Development Executive', 'Sales'),
  ('am@taysonsta.local', 'Laila Account Manager', 'account_manager', 'Account Manager', 'Sales'),
  ('omar@taysonsta.local', 'Omar Project Manager', 'project_manager', 'Project Manager', 'Delivery'),
  ('nour@taysonsta.local', 'Nour Designer', 'designer', 'Product Designer', 'Delivery'),
  ('youssef.dev@taysonsta.local', 'Youssef Developer', 'developer', 'Full-stack Developer', 'Delivery'),
  ('hana@taysonsta.local', 'Hana QA', 'qa', 'QA Engineer', 'Delivery'),
  ('finance@taysonsta.local', 'Tarek Finance', 'finance', 'Finance Manager', 'Finance'),
  ('hr@taysonsta.local', 'Dina HR', 'hr', 'HR Manager', 'HR'),
  ('support@taysonsta.local', 'Mostafa Support', 'support', 'Support Specialist', 'Operations');

insert into departments (name) select distinct dept from seed_users on conflict (name) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', su.email,
       crypt('Taysonsta!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
       jsonb_build_object('full_name', su.full_name), now() - interval '120 days', now(), '', '', '', ''
from seed_users su
where not exists (select 1 from auth.users u where u.email = su.email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u join seed_users su on su.email = u.email
where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into employees (user_id, full_name, email, position, department_id, lifecycle_status, work_schedule_id, start_date, country, timezone, hourly_cost, cost_currency, mfa_status)
select u.id, su.full_name, su.email, su.position, d.id, 'active', (select id from work_schedules where is_default),
       current_date - 120, 'Egypt', 'Africa/Cairo',
       case su.role_key when 'developer' then 18 when 'designer' then 15 when 'qa' then 12 when 'project_manager' then 20 else 14 end, 'USD',
       case when su.role_key in ('super_admin','finance') then 'enabled'::mfa_status else 'not_configured'::mfa_status end
from seed_users su
join auth.users u on u.email = su.email
join departments d on d.name = su.dept
on conflict (user_id) do nothing;

insert into user_roles (user_id, role_id)
select u.id, r.id from seed_users su join auth.users u on u.email = su.email join roles r on r.key = su.role_key
on conflict do nothing;

-- Managers & teams
update departments set manager_user_id = (select id from auth.users where email = 'sales.manager@taysonsta.local') where name = 'Sales';
update departments set manager_user_id = (select id from auth.users where email = 'omar@taysonsta.local') where name = 'Delivery';
insert into teams (name, department_id, lead_user_id)
select 'Sales Team', d.id, (select id from auth.users where email = 'sales.manager@taysonsta.local') from departments d where d.name = 'Sales'
on conflict do nothing;
update employees set team_id = (select id from teams where name = 'Sales Team'),
       manager_id = (select id from employees where email = 'sales.manager@taysonsta.local')
 where email in ('ahmed@taysonsta.local', 'sara@taysonsta.local', 'am@taysonsta.local');
update employees set manager_id = (select id from employees where email = 'omar@taysonsta.local')
 where email in ('nour@taysonsta.local', 'youssef.dev@taysonsta.local', 'hana@taysonsta.local');
update employees set manager_id = (select id from employees where email = 'exec@taysonsta.local')
 where email in ('sales.manager@taysonsta.local', 'omar@taysonsta.local', 'finance@taysonsta.local', 'hr@taysonsta.local', 'support@taysonsta.local');

update bos_settings set value = value || jsonb_build_object('senior_pm_user_ids', jsonb_build_array((select id from auth.users where email = 'omar@taysonsta.local')))
 where key = 'delivery';

-- Exchange rates to USD (base currency)
insert into exchange_rates (base, quote, rate, effective_date, source) values
  ('SAR', 'USD', 0.26667, current_date - 180, 'seed'),
  ('AED', 'USD', 0.27229, current_date - 180, 'seed'),
  ('EGP', 'USD', 0.02050, current_date - 180, 'seed'),
  ('EUR', 'USD', 1.08000, current_date - 180, 'seed'),
  ('KWD', 'USD', 3.26000, current_date - 180, 'seed'),
  ('QAR', 'USD', 0.27473, current_date - 180, 'seed')
on conflict do nothing;

-- Products & services
insert into products (kind, name, default_price, currency, category) values
  ('service', 'Digital Product Build (MVP)', 25000, 'USD', 'Build'),
  ('service', 'E-commerce Store', 12000, 'USD', 'Build'),
  ('service', 'Growth & Marketing Retainer', 3000, 'USD', 'Growth'),
  ('service', 'UX/UI Design Sprint', 6000, 'USD', 'Design'),
  ('product', 'Booking SaaS License', 1200, 'USD', 'SaaS')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Accounts, contacts, leads, deals
-- ---------------------------------------------------------------------------
do $$
declare
  v_ahmed uuid := (select id from auth.users where email = 'ahmed@taysonsta.local');
  v_sara uuid := (select id from auth.users where email = 'sara@taysonsta.local');
  v_am uuid := (select id from auth.users where email = 'am@taysonsta.local');
  v_fin uuid := (select id from auth.users where email = 'finance@taysonsta.local');
  v_lead_pipeline uuid := (select id from pipelines where entity = 'lead' and is_default);
  v_deal_pipeline uuid := (select id from pipelines where entity = 'deal' and is_default);
  v_src_linkedin uuid := (select id from lead_sources where name = 'LinkedIn');
  v_src_ref uuid := (select id from lead_sources where name = 'Referral');
  v_src_web uuid := (select id from lead_sources where name = 'Website');
  v_mvp uuid := (select id from products where name = 'Digital Product Build (MVP)');
  v_shop uuid := (select id from products where name = 'E-commerce Store');
  v_growth uuid := (select id from products where name = 'Growth & Marketing Retainer');
  v_client uuid;
  v_contact uuid;
  v_lead uuid;
  v_deal uuid;
  v_project uuid;
  v_inv uuid;
  r record;
  i integer := 0;
  stage_key text;
  v_prev text;
begin
  -- Leads across every stage of the lead pipeline (for funnels and reports)
  for r in select * from (values
    ('Fatima Al-Otaibi', 'Otaibi Fashion', 'fatima@otaibi-fashion.test', 'Saudi Arabia', 'Fashion', 'new', v_ahmed, 18000, 'SAR', 10, 12, 8, 5),
    ('Khaled Mansour', 'Mansour Logistics', 'khaled@mansour-log.test', 'UAE', 'Logistics', 'contacted', v_ahmed, 30000, 'AED', 15, 15, 10, 8),
    ('Rania Farouk', 'Farouk Clinics', 'rania@faroukclinics.test', 'Egypt', 'Healthcare', 'replied', v_sara, 400000, 'EGP', 12, 18, 14, 12),
    ('Abdullah Al-Sabah', 'Sabah Foods', 'abdullah@sabahfoods.test', 'Kuwait', 'F&B', 'qualified', v_ahmed, 9000, 'KWD', 20, 20, 18, 15),
    ('Markus Weber', 'Weber GmbH', 'markus@weber.test', 'Germany', 'Manufacturing', 'meeting', v_sara, 40000, 'EUR', 22, 20, 20, 18),
    ('Hessa Al-Thani', 'Thani Beauty', 'hessa@thanibeauty.test', 'Qatar', 'Beauty', 'proposal', v_ahmed, 60000, 'QAR', 22, 22, 22, 20),
    ('Youssef Nabil', 'Nabil Academy', 'youssef@nabilacademy.test', 'Egypt', 'Education', 'negotiation', v_sara, 15000, 'USD', 24, 22, 23, 21),
    ('Omar Saleh', 'Saleh Motors', 'omar@salehmotors.test', 'Saudi Arabia', 'Automotive', 'lost', v_ahmed, 50000, 'SAR', 8, 10, 5, 3),
    ('Mariam Adel', 'Adel Interiors', 'mariam@adelinteriors.test', 'Egypt', 'Interior design', 'new', null, 8000, 'USD', 5, 10, 6, 2),
    ('Salem Al-Mazrouei', 'Mazrouei Holdings', 'salem@mazrouei.test', 'UAE', 'Investment', 'qualified', v_sara, 25000, 'USD', 23, 20, 20, 19)
  ) as t(name, company, email, country, industry, stage, owner, budget, cur, b, f, it, e)
  loop
    i := i + 1;
    insert into leads (name, company_name, contact_name, email, country, industry, source_id, estimated_budget, budget_currency,
                       assigned_to, stage_id, budget_score, fit_score, intent_score, engagement_score, priority, created_by, created_at,
                       lost_reason, product_interest_id)
    values (r.company, r.company, r.name, r.email, r.country, r.industry,
            case i % 3 when 0 then v_src_web when 1 then v_src_linkedin else v_src_ref end,
            r.budget, r.cur, r.owner,
            (select id from pipeline_stages where pipeline_id = v_lead_pipeline and key = r.stage),
            r.b, r.f, r.it, r.e, case when r.b + r.f + r.it + r.e > 70 then 'high'::priority_level else 'medium'::priority_level end,
            coalesce(r.owner, v_ahmed), now() - make_interval(days => 40 - i * 3),
            case when r.stage = 'lost' then 'Budget moved to next year' end,
            case when i % 2 = 0 then v_mvp else v_shop end)
    returning id into v_lead;

    -- status history + events that walk the lead through its stages
    v_prev := null;
    for stage_key in select unnest(case when r.stage = 'lost' then array['new','contacted','lost']
                                        else (array['new','contacted','replied','qualified','meeting','proposal','negotiation'])[1:array_position(array['new','contacted','replied','qualified','meeting','proposal','negotiation'], r.stage)] end) loop
      perform bos_status('lead', v_lead, v_prev, stage_key, r.owner, case when stage_key = 'lost' then 'Budget moved to next year' end);
      perform bos_emit(case stage_key when 'new' then 'lead.created' when 'contacted' then 'lead.contacted' when 'replied' then 'lead.replied'
                                      when 'qualified' then 'lead.qualified' when 'lost' then 'lead.lost' else 'lead.stage_changed' end,
        'lead', v_lead, r.owner, case when v_prev is null then 'Lead created: ' || r.company else initcap(v_prev) || ' → ' || initcap(stage_key) end,
        '{}'::jsonb, '[]'::jsonb, 'user', 'internal', null);
      v_prev := stage_key;
    end loop;

    insert into activities (type, title, direction, lead_id, assigned_to, status, completed_at, created_by, created_at)
    values ('linkedin', 'LinkedIn outreach', 'outbound', v_lead, coalesce(r.owner, v_ahmed), 'completed', now() - make_interval(days => 38 - i * 3), coalesce(r.owner, v_ahmed), now() - make_interval(days => 38 - i * 3));
    if r.stage not in ('new', 'lost') then
      insert into activities (type, title, direction, lead_id, assigned_to, status, due_at, created_by)
      values ('follow_up', 'Follow up on requirements', null, v_lead, r.owner, 'pending', now() + make_interval(days => (i % 4) - 1), r.owner);
    end if;
  end loop;

  -- ===== Account 1: Nabil Academy — full lifecycle: won, paid deposit, project in progress =====
  insert into clients (name, company_name, email, phone, country, industry, account_manager_id, account_status, created_by, crm_stage)
  values ('Youssef Nabil', 'Nabil Academy', 'accounts@nabilacademy.test', '+20100000001', 'Egypt', 'Education', v_am, 'active', v_sara, 'project')
  returning id into v_client;
  insert into contacts (client_id, full_name, position, email, phone, whatsapp, is_decision_maker, created_by)
  values (v_client, 'Youssef Nabil', 'Founder', 'youssef.contact@nabilacademy.test', '+20100000001', '+20100000001', true, v_sara)
  returning id into v_contact;
  update clients set primary_contact_id = v_contact where id = v_client;
  update leads set client_id = v_client, contact_id = v_contact where email = 'youssef@nabilacademy.test';

  insert into deals (name, client_id, contact_id, lead_id, source_id, pipeline_id, stage_id, value, currency, probability, expected_close_date,
                     assigned_to, payment_terms, scope, created_by, created_at)
  values ('Nabil Academy — Learning Platform MVP', v_client, v_contact, (select id from leads where email = 'youssef@nabilacademy.test'), v_src_ref,
          v_deal_pipeline, (select id from pipeline_stages where pipeline_id = v_deal_pipeline and key = 'contract'), 25000, 'USD', 80, current_date + 5,
          v_sara, '[{"label":"Deposit","percent":40,"trigger":"on_signing"},{"label":"Design approval","percent":30,"trigger":"on_milestone","due_offset_days":15},{"label":"Launch","percent":30,"trigger":"on_completion","due_offset_days":45}]',
          'Online learning platform: course catalogue, payments, student dashboard, admin panel.', v_sara, now() - interval '20 days')
  returning id into v_deal;
  insert into deal_products (deal_id, product_id, quantity, unit_price) values (v_deal, v_mvp, 1, 25000);
  update leads set converted_deal_id = v_deal, converted_at = now() - interval '20 days' where email = 'youssef@nabilacademy.test';

  insert into contracts (title, client_id, deal_id, value, currency, start_date, end_date, status, sent_at, signed_at, created_by)
  values ('MVP Development Agreement', v_client, v_deal, 25000, 'USD', current_date - 10, current_date + 60, 'signed', now() - interval '12 days', now() - interval '10 days', v_sara);

  v_project := bos_process_deal_won(v_deal, v_sara);
  select id into v_inv from invoices where deal_id = v_deal order by created_at limit 1;
  update invoices set status = 'sent', sent_at = now() - interval '9 days' where id = v_inv;
  perform bos_record_payment(jsonb_build_object('invoice_id', v_inv, 'amount', 10000, 'currency', 'USD', 'method', 'bank_transfer',
                              'reference', 'NBL-TRX-001', 'idempotency_key', 'seed-nabil-1', 'payment_date', current_date - 8), v_fin);
  update projects set status = 'design' where id = v_project;
  perform bos_status('project', v_project, 'planning', 'design', (select id from auth.users where email = 'omar@taysonsta.local'), null);
  update tasks set status = 'completed', completed_at = now() - interval '5 days'
   where project_id = v_project and milestone_id = (select id from milestones where project_id = v_project and sort_order = 1);
  update milestones set status = 'completed', completed_at = now() - interval '5 days', progress = 100 where project_id = v_project and sort_order = 1;
  update milestones set status = 'in_progress' where project_id = v_project and sort_order = 2;
  update tasks set status = 'in_progress' where project_id = v_project and milestone_id = (select id from milestones where project_id = v_project and sort_order = 2) and sort_order = 1;

  -- ===== Account 2: Thani Beauty — open deal at proposal stage =====
  insert into clients (name, company_name, email, country, industry, account_status, created_by, crm_stage)
  values ('Hessa Al-Thani', 'Thani Beauty', 'hello@thanibeauty.test', 'Qatar', 'Beauty', 'prospect', v_ahmed, 'proposal_sent')
  returning id into v_client;
  insert into contacts (client_id, full_name, position, email, is_decision_maker, created_by)
  values (v_client, 'Hessa Al-Thani', 'CEO', 'hessa.contact@thanibeauty.test', true, v_ahmed) returning id into v_contact;
  update clients set primary_contact_id = v_contact where id = v_client;
  insert into deals (name, client_id, contact_id, pipeline_id, stage_id, value, currency, probability, expected_close_date, assigned_to, payment_terms, created_by)
  values ('Thani Beauty — E-commerce Store', v_client, v_contact, v_deal_pipeline, (select id from pipeline_stages where pipeline_id = v_deal_pipeline and key = 'proposal'),
          60000, 'QAR', 40, current_date + 20, v_ahmed, '[{"label":"Deposit","percent":50},{"label":"Launch","percent":50}]', v_ahmed)
  returning id into v_deal;
  insert into deal_products (deal_id, product_id, quantity, unit_price) values (v_deal, v_shop, 1, 60000);

  -- ===== Account 3: Weber GmbH — discovery =====
  insert into clients (name, company_name, email, country, industry, account_status, created_by, crm_stage)
  values ('Markus Weber', 'Weber GmbH', 'info@weber.test', 'Germany', 'Manufacturing', 'prospect', v_sara, 'call_booked')
  returning id into v_client;
  insert into deals (name, client_id, pipeline_id, stage_id, value, currency, probability, expected_close_date, assigned_to, payment_terms, created_by)
  values ('Weber — Dealer Portal', v_client, v_deal_pipeline, (select id from pipeline_stages where pipeline_id = v_deal_pipeline and key = 'discovery'),
          40000, 'EUR', 20, current_date + 45, v_sara, '[{"label":"Deposit","percent":40},{"label":"Delivery","percent":60}]', v_sara);

  -- ===== Account 4: Mansour Logistics — completed earlier project, upsell opportunity =====
  insert into clients (name, company_name, email, country, industry, account_manager_id, account_status, created_by, crm_stage)
  values ('Khaled Mansour', 'Mansour Logistics', 'ops@mansour-log.test', 'UAE', 'Logistics', v_am, 'active', v_ahmed, 'project')
  returning id into v_client;
  insert into contacts (client_id, full_name, position, email, is_decision_maker, created_by)
  values (v_client, 'Khaled Mansour', 'COO', 'khaled.contact@mansour-log.test', true, v_ahmed) returning id into v_contact;
  update clients set primary_contact_id = v_contact where id = v_client;
  insert into deals (name, client_id, contact_id, pipeline_id, stage_id, value, currency, probability, assigned_to, payment_terms, created_by, created_at)
  values ('Mansour — Fleet Tracking App', v_client, v_contact, v_deal_pipeline, (select id from pipeline_stages where pipeline_id = v_deal_pipeline and key = 'contract'),
          44000, 'AED', 80, v_ahmed, '[{"label":"Full payment","percent":100,"trigger":"on_signing"}]', v_ahmed, now() - interval '90 days')
  returning id into v_deal;
  v_project := bos_process_deal_won(v_deal, v_ahmed);
  select id into v_inv from invoices where deal_id = v_deal limit 1;
  update invoices set status = 'sent', sent_at = now() - interval '85 days' where id = v_inv;
  perform bos_record_payment(jsonb_build_object('invoice_id', v_inv, 'amount', 44000, 'currency', 'AED', 'method', 'bank_transfer',
                              'reference', 'MNS-001', 'idempotency_key', 'seed-mansour-1', 'payment_date', current_date - 80), v_fin);
  update tasks set status = 'completed', completed_at = now() - interval '30 days' where project_id = v_project;
  update milestones set status = 'completed', completed_at = now() - interval '30 days', progress = 100, approval_status = case when requires_client_approval then 'approved' else approval_status end where project_id = v_project;
  update projects set status = 'completed', completed_at = now() - interval '28 days', progress = 100, satisfaction_score = 9, support_until = current_date + 2 where id = v_project;
  perform bos_status('project', v_project, 'launch', 'completed', (select id from auth.users where email = 'omar@taysonsta.local'), null);
  insert into deals (name, client_id, contact_id, pipeline_id, stage_id, value, currency, probability, expected_close_date, assigned_to, is_upsell, previous_project_id, previous_deal_id, payment_terms, created_by)
  values ('Mansour — Driver App (upsell)', v_client, v_contact, v_deal_pipeline, (select id from pipeline_stages where pipeline_id = v_deal_pipeline and key = 'qualified'),
          22000, 'AED', 10, current_date + 60, v_am, true, v_project, v_deal, '[{"label":"Deposit","percent":50},{"label":"Launch","percent":50}]', v_am);

  -- Lost deal
  insert into deals (name, client_id, pipeline_id, stage_id, value, currency, probability, assigned_to, lost_at, lost_reason, created_by)
  values ('Saleh Motors — Showroom Site', (select id from clients where company_name = 'Weber GmbH'), v_deal_pipeline,
          (select id from pipeline_stages where pipeline_id = v_deal_pipeline and key = 'lost'), 50000, 'SAR', 0, v_ahmed, now() - interval '12 days', 'Chose a cheaper local agency', v_ahmed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Expenses, vendors, time entries, tickets
-- ---------------------------------------------------------------------------
insert into vendors (name, type, email, services) values
  ('CloudHost Co', 'Hosting', 'billing@cloudhost.test', 'Servers, CDN'),
  ('Freelance Studio', 'Freelancer', 'hi@freelancestudio.test', 'Illustrations')
on conflict do nothing;

insert into expenses (category_id, description, amount, currency, expense_date, vendor_id, project_id, approval_status, created_by, approved_by, approved_at)
select (select id from expense_categories where name = 'Hosting'), 'Staging server — Nabil Academy', 120, 'USD', current_date - 6,
       (select id from vendors where name = 'CloudHost Co'), p.id, 'approved', (select id from auth.users where email = 'omar@taysonsta.local'),
       (select id from auth.users where email = 'finance@taysonsta.local'), now() - interval '5 days'
from projects p where p.name like 'Nabil Academy%';
insert into expenses (category_id, description, amount, currency, expense_date, vendor_id, project_id, approval_status, created_by)
select (select id from expense_categories where name = 'Freelancers'), 'Course illustrations', 850, 'USD', current_date - 2,
       (select id from vendors where name = 'Freelance Studio'), p.id, 'pending', (select id from auth.users where email = 'omar@taysonsta.local')
from projects p where p.name like 'Nabil Academy%';

insert into time_entries (user_id, project_id, task_id, started_at, ended_at, description, source)
select u.id, t.project_id, t.id, now() - make_interval(days => d, hours => 6), now() - make_interval(days => d, hours => 2), 'Work on ' || t.title, 'manual'
from tasks t
join projects p on p.id = t.project_id and p.name like 'Nabil Academy%'
join auth.users u on u.id = t.assigned_to
cross join generate_series(1, 3) as d
where t.status in ('completed', 'in_progress');

insert into tickets (client_id, contact_id, project_id, category, priority, subject, description, source, created_by_user_id)
select p.client_id, c.primary_contact_id, p.id, 'bug', 'high', 'Tracking map not refreshing', 'Driver positions stop updating after ~10 minutes on Android.', 'internal',
       (select id from auth.users where email = 'support@taysonsta.local')
from projects p join clients c on c.id = p.client_id where p.name like 'Mansour%' and p.status = 'completed';

-- ---------------------------------------------------------------------------
-- Attendance: last 10 work days for everyone (real clock-in/out maths)
-- ---------------------------------------------------------------------------
do $$
declare
  v_e record;
  v_day date;
  v_record uuid;
  v_in time;
  v_out time;
  n integer := 0;
begin
  for v_e in select e.* from employees e join auth.users u on u.id = e.user_id where u.email like '%@taysonsta.local' loop
    for v_day in select d::date from generate_series(current_date - 14, current_date - 1, interval '1 day') d loop
      continue when extract(dow from v_day) in (5, 6);
      n := n + 1;
      continue when n % 17 = 0; -- occasional absence
      v_in := case when n % 7 = 0 then time '10:25' else time '09:55' + make_interval(mins => (n * 7) % 14) end;
      v_out := time '18:00' + make_interval(mins => (n * 11) % 40);
      insert into attendance_records (user_id, work_date, schedule_id, timezone, is_remote)
      values (v_e.user_id, v_day, v_e.work_schedule_id, 'Africa/Cairo', true)
      on conflict (user_id, work_date) do nothing
      returning id into v_record;
      continue when v_record is null;
      insert into attendance_sessions (record_id, user_id, clock_in_at, clock_out_at, source, closed_reason)
      values (v_record, v_e.user_id, (v_day + v_in) at time zone 'Africa/Cairo', (v_day + v_out) at time zone 'Africa/Cairo', 'web', 'clock_out');
      perform bos_recalc_attendance_day(v_record);
    end loop;
    perform bos_mark_absences(current_date - 1);
  end loop;
end;
$$;

-- Leave request pending for the manager queue
insert into leave_requests (user_id, leave_type_id, start_date, end_date, duration_days, reason, status)
select (select id from auth.users where email = 'ahmed@taysonsta.local'), (select id from leave_types where key = 'annual'),
       current_date + 10, current_date + 11, bos_leave_duration((select id from auth.users where email = 'ahmed@taysonsta.local'), current_date + 10, current_date + 11, false),
       'Family trip', 'pending';

-- Holidays
insert into holidays (date, name) values (make_date(extract(year from current_date)::int, 10, 6), 'Armed Forces Day') on conflict do nothing;

-- Knowledge: publish the policy pages so onboarding required reading works
update kb_articles set status = 'published', published_at = now(),
       content = 'Welcome to Taysonsta. This page introduces our mission, services and ways of working. (Replace with the official company introduction.)'
 where slug = 'company-introduction';

-- Change request awaiting assessment + an open project issue on the active project
insert into change_requests (project_id, client_id, title, description, reason, requested_by_user_id, additional_cost, currency, additional_days)
select p.id, p.client_id, 'Add Arabic/English language switcher', 'Client asked for a bilingual site with a language toggle in the header.', 'New market expansion',
       (select id from auth.users where email = 'am@taysonsta.local'), 0, p.currency, 0
from projects p where p.name like 'Nabil Academy%';

insert into issues (project_id, title, description, severity, assigned_to, reported_by)
select p.id, 'Waiting on client brand assets', 'Logo source files and brand guidelines not received yet; blocks the design milestone.', 'high',
       (select id from auth.users where email = 'omar@taysonsta.local'), (select id from auth.users where email = 'nour@taysonsta.local')
from projects p where p.name like 'Nabil Academy%';

-- IT & access: role-based access checklists for every staff member, BOS/email active
select bos_generate_access_checklist(e.id, null) from employees e where e.user_id is not null;
update access_grants g set status = 'active', granted_at = now() - interval '60 days'
  from external_apps a where a.id = g.app_id and a.key in ('bos','company_email','google_calendar','google_meet','slack');
update employees set mfa_status = 'enabled' where email in ('admin@taysonsta.local','exec@taysonsta.local','finance@taysonsta.local','hr@taysonsta.local');

insert into company_accounts (employee_id, app_id, account_type, provider, identifier, status, mfa_status, mfa_method, owner_user_id, recovery_owner_user_id, last_reviewed_at)
select e.id, (select id from external_apps where key = 'company_email'), 'email', 'Google Workspace', replace(e.email, '@taysonsta.local', '@taysonsta.com'),
       'active', case when e.mfa_status = 'enabled' then 'enabled'::mfa_status else 'required'::mfa_status end, case when e.mfa_status = 'enabled' then 'Authenticator App' end,
       (select id from auth.users where email = 'admin@taysonsta.local'), (select id from auth.users where email = 'hr@taysonsta.local'), now() - interval '20 days'
from employees e where e.user_id is not null;

-- Devices
insert into devices (asset_id, type, model, serial_number, os, purchase_date, warranty_until, condition, os_updated, encryption_enabled, screen_lock_enabled, antivirus_enabled, company_account_configured, last_security_check_at) values
  ('TS-MAC-001', 'laptop', 'MacBook Pro 14', 'C02XK1', 'macOS 15', current_date - 400, current_date + 330, 'good', true, true, true, true, true, now() - interval '10 days'),
  ('TS-MAC-002', 'laptop', 'MacBook Air 13', 'C02XK2', 'macOS 15', current_date - 200, current_date + 530, 'good', true, true, true, null, true, now() - interval '120 days'),
  ('TS-WIN-001', 'laptop', 'Dell XPS 15', 'DX15-77', 'Windows 11', current_date - 700, current_date - 5, 'fair', false, true, true, true, true, now() - interval '40 days'),
  ('TS-MON-001', 'monitor', 'LG 27UL850', 'LG27-01', null, current_date - 300, current_date + 60, 'good', null, null, null, null, null, null),
  ('TS-MAC-003', 'laptop', 'MacBook Pro 16', 'C02XK3', 'macOS 15', current_date - 20, current_date + 710, 'new', null, null, null, null, null, null);
with a as (
  select d.id as device_id, e.id as employee_id
  from (values ('TS-MAC-001','youssef.dev@taysonsta.local'), ('TS-MAC-002','nour@taysonsta.local'), ('TS-WIN-001','ahmed@taysonsta.local'), ('TS-MON-001','youssef.dev@taysonsta.local')) x(asset, email)
  join devices d on d.asset_id = x.asset join employees e on e.email = x.email
)
insert into device_assignments (device_id, employee_id, assigned_at, assigned_by, confirmed_by_employee_at, condition_out)
select device_id, employee_id, now() - interval '90 days', (select id from auth.users where email = 'admin@taysonsta.local'), now() - interval '89 days', 'good' from a;
update devices d set status = 'assigned', assigned_employee_id = da.employee_id, assigned_at = da.assigned_at
  from device_assignments da where da.device_id = d.id and da.returned_at is null;

-- A new hire in onboarding (no BOS login yet)
insert into employees (full_name, email, position, department_id, team_id, manager_id, start_date, employment_type, lifecycle_status, work_schedule_id, country, timezone)
select 'Mariam Designer', 'mariam@taysonsta.local', 'UI Designer', e.department_id, e.team_id,
       (select id from employees where email = 'omar@taysonsta.local'), current_date + 3, 'full_time', 'pending_onboarding',
       (select id from work_schedules where is_default), 'Egypt', 'Africa/Cairo'
from employees e where e.email = 'nour@taysonsta.local';
select bos_start_onboarding('employee', 'employee_onboarding', null, null, null, (select id from employees where email = 'mariam@taysonsta.local'), current_date + 17);

-- Access request pending (Nour → GitHub viewer)
insert into access_requests (employee_id, requested_by, app_id, access_level, reason)
select e.id, e.user_id, (select id from external_apps where key = 'github'), 'Viewer', 'Need to review design tokens in the frontend repo'
from employees e where e.email = 'nour@taysonsta.local';

-- Overtime request and a correction request (pending with manager)
insert into overtime_requests (user_id, work_date, minutes, reason)
select id, current_date - 3, 90, 'Client launch support' from auth.users where email = 'youssef.dev@taysonsta.local';

-- Approvals for the seeded requests (manager of the requester, else HR role)
insert into approvals (approval_type, entity_type, entity_id, title, step, total_steps, requested_by, approver_user_id, approver_role_id, payload)
select 'access_request', 'access_request', r.id, 'Nour Designer — GitHub (Viewer)', 1, 2, e.user_id,
       m.user_id, case when m.user_id is null then (select id from roles where key = 'hr') end,
       '{"steps":["manager","role:admin"]}'::jsonb
from access_requests r join employees e on e.id = r.employee_id left join employees m on m.id = e.manager_id
where r.status = 'pending';
insert into approvals (approval_type, entity_type, entity_id, title, requested_by, approver_user_id, approver_role_id, payload)
select 'overtime', 'overtime_request', o.id, 'Youssef Developer — overtime ' || o.work_date || ' (1.5h)', o.user_id,
       m.user_id, case when m.user_id is null then (select id from roles where key = 'hr') end, '{"steps":["manager"]}'::jsonb
from overtime_requests o join employees e on e.user_id = o.user_id left join employees m on m.id = e.manager_id
where o.status = 'pending';
update access_grants g set status = 'requested', request_id = r.id
  from access_requests r where r.employee_id = g.employee_id and r.app_id = g.app_id and r.status = 'pending';
insert into access_grants (employee_id, app_id, access_level, status, source, request_id, vault)
select r.employee_id, r.app_id, r.access_level, 'requested', 'request', r.id, a.password_vault
from access_requests r join external_apps a on a.id = r.app_id
where r.status = 'pending' and not exists (select 1 from access_grants g where g.employee_id = r.employee_id and g.app_id = r.app_id);

-- Knowledge: publish SOP skeletons and policies (onboarding required reading)
update kb_articles set status = 'published', published_at = now()
 where kind = 'sop' or slug in ('company-policies', 'security-guidelines', 'communication-guidelines');
update kb_articles set content = E'## Working hours\nCore hours follow your work schedule. Use **START WORK / END WORK** in the BOS.\n\n## Leave\nRequest leave in the BOS at least 7 days ahead.\n\n## Confidentiality\nClient data stays inside company systems.'
 where slug = 'company-policies' and content = '';
update kb_articles set content = E'## Accounts\n- Enable 2FA on the BOS and every company account.\n- Never share passwords; use the company password manager.\n\n## Devices\nKeep disk encryption and screen lock enabled.'
 where slug = 'security-guidelines' and content = '';
update kb_articles set content = E'## Channels\nUse project channels for project work and DMs for quick questions. Mention people with `@name`.\n\n## Clients\nClient-visible messages are marked explicitly; internal notes never reach the portal.'
 where slug = 'communication-guidelines' and content = '';
insert into kb_article_versions (article_id, version, title, content)
select id, version, title, content from kb_articles a
 where slug in ('company-policies','security-guidelines','communication-guidelines')
   and not exists (select 1 from kb_article_versions v where v.article_id = a.id and v.version = a.version)
on conflict (article_id, version) do update set content = excluded.content;
update kb_article_versions v set content = a.content from kb_articles a where v.article_id = a.id and v.version = a.version and a.slug in ('company-policies','security-guidelines','communication-guidelines');

-- Chat: company-wide channel, sales channel with members, a DM and messages
insert into channels (kind, name, description, is_private)
select 'team', 'General', 'Company-wide announcements', false where not exists (select 1 from channels where kind = 'team' and name = 'General');
insert into channels (kind, name, description, is_private)
select 'team', 'Sales', 'Sales team', false where not exists (select 1 from channels where kind = 'team' and name = 'Sales');
insert into channel_members (channel_id, user_id)
select c.id, u.id from channels c, auth.users u
 where c.name = 'Sales' and c.kind = 'team' and u.email in ('sales.manager@taysonsta.local','ahmed@taysonsta.local','sara@taysonsta.local','am@taysonsta.local')
on conflict do nothing;
insert into messages (channel_id, author_user_id, body, created_at)
select c.id, (select id from auth.users where email = 'exec@taysonsta.local'), 'Welcome to the Taysonsta BOS! Please complete your onboarding checklist and enable 2FA.', now() - interval '2 days'
from channels c where c.name = 'General' and c.kind = 'team';
insert into messages (channel_id, author_user_id, body, created_at)
select c.id, (select id from auth.users where email = 'sales.manager@taysonsta.local'), '@Ahmed please follow up with Nabil Academy about the change request today.', now() - interval '3 hours'
from channels c where c.name = 'Sales' and c.kind = 'team';
insert into message_mentions (message_id, user_id)
select m.id, (select id from auth.users where email = 'ahmed@taysonsta.local') from messages m where m.body like '@Ahmed please follow up%';
with dm as (
  insert into channels (kind, name, direct_key, is_private)
  select 'direct', 'DM', least(a.id::text, b.id::text) || ':' || greatest(a.id::text, b.id::text), true
  from auth.users a, auth.users b where a.email = 'omar@taysonsta.local' and b.email = 'nour@taysonsta.local'
  on conflict (direct_key) do nothing
  returning id
)
insert into channel_members (channel_id, user_id)
select dm.id, u.id from dm, auth.users u where u.email in ('omar@taysonsta.local','nour@taysonsta.local');
insert into messages (channel_id, author_user_id, body, created_at)
select c.id, (select id from auth.users where email = 'omar@taysonsta.local'), 'Hi Nour, can you share the homepage mockups before the client review?', now() - interval '1 hour'
from channels c join channel_members m1 on m1.channel_id = c.id join auth.users u on u.id = m1.user_id and u.email = 'nour@taysonsta.local'
where c.kind = 'direct';

-- Support: tickets (one overdue SLA), a bug from a ticket, a feature request
insert into tickets (client_id, contact_id, project_id, category, priority, subject, description, assigned_to, status, source, created_by_user_id, created_at)
select p.client_id, (select id from contacts where client_id = p.client_id order by created_at limit 1), p.id, 'technical', 'high',
       'Contact form not sending emails', 'Since yesterday the contact form on the landing page shows success but no email arrives.',
       (select id from auth.users where email = 'support@taysonsta.local'), 'open', 'internal', (select id from auth.users where email = 'support@taysonsta.local'), now() - interval '6 hours'
from projects p where p.status = 'completed' limit 1;
insert into tickets (client_id, contact_id, category, priority, subject, description, status, source, created_at)
select c.id, (select id from contacts where client_id = c.id order by created_at limit 1), 'billing', 'medium',
       'Question about the second invoice', 'Can you confirm the due date of the milestone invoice?', 'waiting_for_client', 'portal', now() - interval '2 days'
from clients c where c.company_name = 'Nabil Academy';
insert into comments (entity_type, entity_id, body, is_internal, author_user_id)
select 'ticket', t.id, 'Hi, the milestone invoice is due 7 days after the design approval.', false, (select id from auth.users where email = 'finance@taysonsta.local')
from tickets t where t.subject = 'Question about the second invoice';
update tickets set first_responded_at = now() - interval '1 day' where subject = 'Question about the second invoice';
insert into comments (entity_type, entity_id, body, is_internal, author_user_id)
select 'ticket', t.id, 'Checked SMTP logs — provider rejects the sender domain. Needs DNS fix.', true, (select id from auth.users where email = 'support@taysonsta.local')
from tickets t where t.subject = 'Contact form not sending emails';
insert into bugs (project_id, ticket_id, title, environment, severity, priority, description, steps_to_reproduce, expected_behavior, actual_behavior, assigned_to, reported_by_user_id, status)
select t.project_id, t.id, 'Contact form emails rejected by provider', 'production', 'major', 'high',
       'SPF record missing the email provider include.', E'1. Open landing page\n2. Submit contact form\n3. Check inbox', 'Email received', 'No email; provider bounce',
       (select id from auth.users where email = 'youssef.dev@taysonsta.local'), (select id from auth.users where email = 'support@taysonsta.local'), 'in_progress'
from tickets t where t.subject = 'Contact form not sending emails' and t.project_id is not null;
insert into feature_requests (client_id, project_id, title, description, business_value, priority, estimated_effort_hours, cost, currency, status, requested_by_user_id)
select p.client_id, p.id, 'Online booking for delivery slots', 'Let customers pick a delivery slot on the website.', 'Reduces calls to the dispatch team by ~30%.',
       'high', 40, 2400, 'USD', 'review', (select id from auth.users where email = 'am@taysonsta.local')
from projects p where p.status = 'completed' limit 1;

-- Client portal users (LOCAL demo only; password Taysonsta!2026):
--   nabil.client@example.test → Nabil Academy, mansour.client@example.test → Mansour Logistics
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x.email,
       crypt('Taysonsta!2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"client"}'::jsonb,
       jsonb_build_object('full_name', x.name), now(), now(), '', '', '', ''
from (values ('nabil.client@example.test', 'Nabil Client'), ('mansour.client@example.test', 'Mansour Client')) x(email, name)
where not exists (select 1 from auth.users u where u.email = x.email);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u where u.email in ('nabil.client@example.test', 'mansour.client@example.test')
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');
insert into contacts (client_id, full_name, email, position, is_decision_maker)
select c.id, x.name, x.email, 'Owner', true
from (values ('Nabil Academy', 'Nabil Client', 'nabil.client@example.test'), ('Mansour Logistics', 'Mansour Client', 'mansour.client@example.test')) x(company, name, email)
join clients c on c.company_name = x.company
where not exists (select 1 from contacts ct where lower(ct.email) = x.email);
insert into client_portal_users (user_id, client_id, contact_id, status, invited_by)
select u.id, ct.client_id, ct.id, 'active', (select id from auth.users where email = 'admin@taysonsta.local')
from auth.users u join contacts ct on lower(ct.email) = u.email
where u.email in ('nabil.client@example.test', 'mansour.client@example.test')
on conflict (user_id) do nothing;
-- A client-visible file and a pending client approval for Nabil Academy's project
insert into approvals (approval_type, entity_type, entity_id, title, requested_by, approver_contact_id, client_visible, payload)
select 'design', 'project', p.id, 'Homepage design approval', p.pm_id, ct.id, true, '{"steps":[]}'::jsonb
from projects p join contacts ct on ct.client_id = p.client_id and lower(ct.email) = 'nabil.client@example.test'
where p.name like 'Nabil Academy%'
  and not exists (select 1 from approvals a where a.entity_id = p.id and a.title = 'Homepage design approval');

commit;
