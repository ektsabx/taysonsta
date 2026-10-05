-- Core lifecycle integration test (docs/bos/25-testing.md, §106 steps 7–14).
-- Runs inside a transaction that is always rolled back.
\set ON_ERROR_STOP on
begin;

-- Test users -----------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bd@test.local', '{"role":"staff"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin@test.local', '{"role":"staff"}', '{}', now(), now());

insert into employees (user_id, full_name, email, lifecycle_status, work_schedule_id)
select id, split_part(email, '@', 1), email, 'active', (select id from work_schedules where is_default) from auth.users where email like '%@test.local';

insert into user_roles (user_id, role_id) select '00000000-0000-0000-0000-0000000000b1', id from roles where key = 'business_development';
insert into user_roles (user_id, role_id) select '00000000-0000-0000-0000-0000000000f1', id from roles where key = 'finance';

-- Account, contact, deal ($25,000, 40/30/30) --------------------------------
do $$
declare
  v_client uuid;
  v_contact uuid;
  v_deal uuid;
  v_ret uuid;
  v_ret2 uuid;
  v_inv uuid;
  v_pay uuid;
  v_pay2 uuid;
  v_n integer;
  v_sum numeric;
  v_status text;
  v_amount numeric;
begin
  insert into clients (name, email, country) values ('Acme Test', 'owner@acme.test', 'Saudi Arabia') returning id into v_client;
  insert into contacts (client_id, full_name, email) values (v_client, 'Owner Acme', 'owner-contact@acme.test') returning id into v_contact;

  insert into deals (name, client_id, contact_id, pipeline_id, stage_id, value, currency, assigned_to, payment_terms, scope)
  select 'Acme Platform', v_client, v_contact, p.id, s.id, 25000, 'USD', '00000000-0000-0000-0000-0000000000b1',
         '[{"label":"Deposit","percent":40},{"label":"Milestone","percent":30},{"label":"Final","percent":30}]', 'Build platform'
  from pipelines p join pipeline_stages s on s.pipeline_id = p.id and s.key = 'negotiation'
  where p.entity = 'deal' and p.is_default
  returning id into v_deal;

  -- Deal Won twice ⇒ processed once (no projects: final spec D-121)
  v_ret := bos_process_deal_won(v_deal, '00000000-0000-0000-0000-0000000000b1');
  v_ret2 := bos_process_deal_won(v_deal, '00000000-0000-0000-0000-0000000000b1');
  assert v_ret = v_deal and v_ret2 = v_deal, 'deal won returns the deal and is idempotent';
  assert (select account_status from clients where id = v_client) = 'active', 'account active';

  select count(*), sum(amount) into v_n, v_sum from payment_schedules where deal_id = v_deal;
  assert v_n = 3 and v_sum = 25000, 'schedule 3 rows summing to deal value';
  assert (select amount from payment_schedules where deal_id = v_deal and sort_order = 1) = 10000, 'deposit 40% = 10,000';
  assert (select amount from payment_schedules where deal_id = v_deal and sort_order = 2) = 7500, '30% = 7,500';

  select count(*) into v_n from invoices where deal_id = v_deal;
  assert v_n = 1, 'one invoice for first installment';
  select id into v_inv from invoices where deal_id = v_deal;
  assert (select total from invoices where id = v_inv) = 10000, 'invoice total 10,000';

  assert (select count(*) from commissions where deal_id = v_deal) = 1, 'commission row created';
  assert (select amount from commissions where deal_id = v_deal) = 2500, '10% of 25,000';
  assert (select status from commissions where deal_id = v_deal) = 'pending', 'commission pending until payment';

  assert (select count(*) from onboarding_checklists where deal_id = v_deal) = 1, 'client onboarding started';
  assert (select count(*) from onboarding_items i join onboarding_checklists c on c.id = i.checklist_id where c.deal_id = v_deal and i.auto_key in ('project_created', 'team_assigned')) = 0, 'no project onboarding items';

  assert (select count(*) from activity_events where event_type = 'deal.won' and entity_id = v_deal) = 1, 'deal.won event once';
  assert exists (select 1 from activity_event_links l join activity_events e on e.id = l.event_id
                 where e.event_type = 'deal.won' and l.entity_type = 'client' and l.entity_id = v_client), 'deal.won on client timeline';
  assert exists (select 1 from audit_logs where action = 'deal.won' and entity_id = v_deal), 'deal won audited';

  -- Client pays $10,000 (double submission with same idempotency key)
  v_pay := bos_record_payment(jsonb_build_object('invoice_id', v_inv, 'amount', 10000, 'currency', 'USD', 'method', 'bank_transfer',
                              'reference', 'TRX-1', 'idempotency_key', 'k-1'), '00000000-0000-0000-0000-0000000000f1');
  v_pay2 := bos_record_payment(jsonb_build_object('invoice_id', v_inv, 'amount', 10000, 'currency', 'USD', 'method', 'bank_transfer',
                              'reference', 'TRX-1', 'idempotency_key', 'k-1'), '00000000-0000-0000-0000-0000000000f1');
  assert v_pay = v_pay2, 'payment idempotent';
  assert (select count(*) from payments where deal_id = v_deal) = 1, 'one payment';
  assert (select status from invoices where id = v_inv) = 'paid', 'invoice paid';
  assert (select balance from invoices where id = v_inv) = 0, 'invoice outstanding 0';
  assert (select payment_status from deals where id = v_deal) = 'partially_paid', 'deal partially paid';
  select 25000 - coalesce(sum(deal_amount), 0) into v_sum from payments where deal_id = v_deal and status = 'completed';
  assert v_sum = 15000, 'deal outstanding 15,000';

  select status, eligible_amount into v_status, v_amount from commissions where deal_id = v_deal;
  assert v_status = 'eligible' and v_amount = 1000, 'commission eligible proportional to collected (10% × 10,000)';

  -- A payment in another currency is refused (no conversion, D-120)
  begin
    perform bos_record_payment(jsonb_build_object('invoice_id', v_inv, 'amount', 5, 'currency', 'EGP'), '00000000-0000-0000-0000-0000000000f1');
    assert false, 'cross-currency payment should fail';
  exception when sqlstate '22023' then null;
  end;

  -- Overpayment rejected
  begin
    perform bos_record_payment(jsonb_build_object('invoice_id', v_inv, 'amount', 5, 'currency', 'USD'), '00000000-0000-0000-0000-0000000000f1');
    assert false, 'overpayment should fail';
  exception when sqlstate '22023' then null;
  end;

  -- Partial refund reverses effects proportionally
  perform bos_refund_payment(v_pay, 4000, 'Client dispute', '00000000-0000-0000-0000-0000000000f1');
  assert (select status from invoices where id = v_inv) in ('partially_paid','overdue'), 'invoice back to partially paid';
  assert (select balance from invoices where id = v_inv) = 4000, 'invoice balance 4,000 after refund';
  assert (select eligible_amount from commissions where deal_id = v_deal) = 600, 'commission eligible reduced to 600';

  -- Audit log is immutable
  begin
    update audit_logs set action = 'tampered' where id = (select max(id) from audit_logs);
    assert false, 'audit update should fail';
  exception when raise_exception then null;
  end;

  raise notice 'lifecycle: OK';
end;
$$;

-- Attendance ----------------------------------------------------------------
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-0000000000b1';
  v_session uuid;
  v_rec attendance_records%rowtype;
  v_date date;
begin
  v_session := bos_clock_in(v_user, 'web', 'Africa/Cairo');

  begin
    perform bos_clock_in(v_user, 'web', null);
    assert false, 'double clock-in should fail';
  exception when unique_violation then null;
  end;

  -- Move the session to a known Sunday: clock in 10:02, clock out 18:11 Cairo.
  v_date := date '2026-09-27';
  update attendance_records set work_date = v_date where id = (select record_id from attendance_sessions where id = v_session);
  update attendance_sessions set clock_in_at = (v_date + time '10:02') at time zone 'Africa/Cairo' where id = v_session;
  perform bos_clock_out(v_user);
  update attendance_sessions set clock_out_at = (v_date + time '18:11') at time zone 'Africa/Cairo' where id = v_session;
  perform bos_recalc_attendance_day((select record_id from attendance_sessions where id = v_session));

  select * into v_rec from attendance_records where id = (select record_id from attendance_sessions where id = v_session);
  assert v_rec.worked_minutes = 489, format('worked 8h09m, got %s', v_rec.worked_minutes);
  assert v_rec.expected_minutes = 480, format('expected 8h, got %s', v_rec.expected_minutes);
  -- Default basis (docs/bos/28 §11): clock-out 18:11 after the 18:00 end → 11 min.
  assert v_rec.overtime_minutes = 11, format('overtime 11m after schedule end, got %s', v_rec.overtime_minutes);
  -- Alternative basis: total worked beyond expected → 489 − 480 = 9 min.
  update bos_settings set value = value || '{"overtime_basis":"worked_beyond_expected"}'::jsonb where key = 'attendance_policy';
  perform bos_recalc_attendance_day(v_rec.id);
  select * into v_rec from attendance_records where id = v_rec.id;
  assert v_rec.overtime_minutes = 9, format('overtime 9m beyond expected, got %s', v_rec.overtime_minutes);
  assert v_rec.late_minutes = 0, 'within grace ⇒ not late';

  -- Late: 10:25 clock-in with 15 min grace
  update attendance_sessions set clock_in_at = (v_date + time '10:25') at time zone 'Africa/Cairo' where id = v_session;
  perform bos_recalc_attendance_day(v_rec.id);
  select * into v_rec from attendance_records where id = v_rec.id;
  assert v_rec.status = 'late' and v_rec.late_minutes = 25, format('late 25, got %s/%s', v_rec.status, v_rec.late_minutes);

  raise notice 'attendance: OK';
end;
$$;

rollback;
