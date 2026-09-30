-- Branches (docs/bos/30 §3.2): inference of branch_id on insert, branch
-- schedule level, branch holidays, report branch filter.
-- Runs inside a transaction that is always rolled back.
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_hq uuid := bos_head_office();
  v_b uuid;
  v_emp uuid;
  v_client uuid;
  v_deal uuid;
  v_proj uuid;
  v_s uuid;
  v_stage record;
  r jsonb;
begin
  assert v_hq is not null, 'head office exists';
  insert into branches (code, name, timezone) values ('TSTDB', 'DB test branch', 'Asia/Dubai') returning id into v_b;
  insert into employees (full_name, timezone, lifecycle_status, country) values ('Branch DB Tester', 'Asia/Dubai', 'active', 'UAE') returning id into v_emp;
  assert (select branch_id from employees where id = v_emp) = v_hq, 'employee without branch → head office';
  update employees set branch_id = v_b where id = v_emp;

  insert into clients (name, email, branch_id) values ('Branch DB Client', 'branch-db@test.local', v_b) returning id into v_client;
  select id, pipeline_id into v_stage from pipeline_stages where category = 'open' limit 1;
  insert into deals (name, client_id, pipeline_id, stage_id, value, currency) values ('Branch DB Deal', v_client, v_stage.pipeline_id, v_stage.id, 500, 'USD') returning id into v_deal;
  assert (select branch_id from deals where id = v_deal) = v_b, 'deal inherits client branch';
  insert into projects (name, client_id, deal_id, currency) values ('Branch DB Project', v_client, v_deal, 'USD') returning id into v_proj;
  assert (select branch_id from projects where id = v_proj) = v_b, 'project inherits deal branch';

  -- Branch schedule sits between department and company.
  insert into work_schedules (name, work_days, start_time, end_time) values ('S branch', '{0,1,2,3,4}', '07:00', '15:00') returning id into v_s;
  insert into schedule_assignments (scope, branch_id, schedule_id, effective_from) values ('branch', v_b, v_s, '2020-01-01');
  assert bos_resolve_schedule_id(v_emp, '2026-10-05') = v_s, 'branch schedule applies';

  -- Branch holiday only for that branch.
  insert into holidays (date, name, branch_id) values ('2026-10-06', 'Branch day', v_b);
  assert bos_day_off_reason(v_emp, '2026-10-06') = 'holiday', 'branch holiday applies to its staff';

  -- Report filter.
  assert bos_branch_ok('{}'::jsonb, v_hq), 'no filter → everything';
  assert bos_branch_ok(jsonb_build_object('branch_ids', jsonb_build_array(v_b)), v_b);
  assert not bos_branch_ok(jsonb_build_object('branch_ids', jsonb_build_array(v_b)), v_hq), 'other branch excluded';
  r := bos_report_clients(jsonb_build_object('branch_ids', jsonb_build_array(v_hq)));
  assert not exists (select 1 from jsonb_array_elements(r->'clients') c where c->>'id' = v_client::text), 'HQ report hides branch client';
  r := bos_report_clients(jsonb_build_object('branch_ids', jsonb_build_array(v_b)));
  assert exists (select 1 from jsonb_array_elements(r->'clients') c where c->>'id' = v_client::text), 'branch report shows it';
end $$;

rollback;
