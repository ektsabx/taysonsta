-- Employee offboarding checklist (docs/bos/27 workflow 4 — INFERRED from IT
-- §1/§2 because the addendum was truncated after §16; confirm with the
-- product owner). An employee can now hold one onboarding and one
-- offboarding checklist at the same time, so uniqueness is per template.

drop index if exists onboarding_employee_active_idx;
create unique index onboarding_employee_active_idx on onboarding_checklists (employee_id, template_key)
  where subject = 'employee' and status <> 'cancelled';

create or replace function public.bos_start_onboarding(p_subject text, p_template_key text, p_client uuid, p_deal uuid, p_project uuid, p_employee uuid, p_due date default null)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_subject = 'client' then
    select id into v_id from onboarding_checklists where deal_id = p_deal;
  else
    select id into v_id from onboarding_checklists
     where employee_id = p_employee and subject = 'employee' and template_key = p_template_key and status <> 'cancelled';
  end if;
  if v_id is not null then
    return v_id;
  end if;

  insert into onboarding_checklists (subject, template_key, client_id, project_id, deal_id, employee_id, due_date)
  values (p_subject, p_template_key, p_client, p_project, p_deal, p_employee, p_due)
  returning id into v_id;

  insert into onboarding_items (checklist_id, section, label, auto_key, responsible, required, sort_order)
  select v_id, i->>'section', i->>'label', nullif(i->>'auto_key', ''), i->>'responsible',
         coalesce((i->>'required')::boolean, true), ord
  from checklist_templates t, jsonb_array_elements(t.items) with ordinality as x(i, ord)
  where t.key = p_template_key;

  return v_id;
end;
$$;

insert into checklist_templates (key, name, subject, items) values
('employee_offboarding', 'Employee offboarding (inferred — confirm)', 'employee', '[
  {"section":"Access","label":"Revoke every active external access grant","auto_key":"access_revoked","responsible":"admin"},
  {"section":"Access","label":"Suspend company-managed accounts","auto_key":"accounts_suspended","responsible":"admin"},
  {"section":"Access","label":"Disable BOS login","auto_key":"bos_disabled","responsible":"admin"},
  {"section":"Handover","label":"Transfer open leads and deals","auto_key":"sales_transferred","responsible":"manager"},
  {"section":"Handover","label":"Transfer assigned projects and tasks","auto_key":"work_transferred","responsible":"manager"},
  {"section":"Handover","label":"Transfer file and record ownership","responsible":"manager"},
  {"section":"Equipment","label":"Collect all assigned devices","auto_key":"devices_returned","responsible":"admin"},
  {"section":"Settlement","label":"Final attendance review","responsible":"hr"},
  {"section":"Settlement","label":"Leave balance settlement","responsible":"hr"},
  {"section":"Settlement","label":"Final commission settlement","responsible":"finance","required":false},
  {"section":"Completion","label":"Exit meeting","responsible":"manager"},
  {"section":"Completion","label":"HR confirms offboarding completion","auto_key":"confirm:hr","responsible":"hr"},
  {"section":"Completion","label":"Admin confirms access removal","auto_key":"confirm:admin","responsible":"admin"}
]'::jsonb)
on conflict (key) do nothing;
