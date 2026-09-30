-- Owner decision (docs/bos/39 §1): bugs and feature requests are removed
-- from the system entirely — pages, services, permissions, events and data
-- (one demo row each in the local database at the time of removal).

CREATE OR REPLACE FUNCTION public.bos_project_completion_blockers(p_project uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_cfg jsonb := coalesce((select value from bos_settings where key = 'project_completion'), '{}'::jsonb);
  v_p projects%rowtype;
  v_blockers text[] := '{}';
begin
  select * into v_p from projects where id = p_project;

  if exists (select 1 from tasks where project_id = p_project and is_required and archived_at is null
             and parent_task_id is null and status not in ('completed','cancelled')) then
    v_blockers := v_blockers || 'required_tasks_incomplete';
  end if;


  if not coalesce((v_cfg->>'allow_complete_with_pending_approvals')::boolean, false) then
    if not exists (select 1 from approvals where entity_type = 'project' and entity_id = p_project
                   and approval_type = 'final_delivery' and status = 'approved') then
      v_blockers := v_blockers || 'final_approval_missing';
    end if;
    if exists (select 1 from approvals where status = 'pending' and (
                (entity_type = 'project' and entity_id = p_project) or
                (entity_type = 'milestone' and entity_id in (select id from milestones where project_id = p_project)) or
                (entity_type = 'change_request' and entity_id in (select id from change_requests where project_id = p_project)))) then
      v_blockers := v_blockers || 'pending_approvals';
    end if;
  end if;

  if not coalesce((v_cfg->>'allow_complete_with_pending_payment')::boolean, false) then
    if exists (select 1 from invoices where project_id = p_project and status not in ('paid','cancelled'))
       or (v_p.deal_id is not null and (select payment_status from deals where id = v_p.deal_id) <> 'paid') then
      v_blockers := v_blockers || 'final_payment_pending';
    end if;
  end if;

  return v_blockers;
end;
$function$;

CREATE OR REPLACE FUNCTION public.portal_owns_entity(p_type text, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_client uuid := portal_client_id();
begin
  if v_client is null or p_id is null then
    return false;
  end if;
  return case p_type
    when 'client' then p_id = v_client
    when 'project' then exists (select 1 from projects where id = p_id and client_id = v_client)
    when 'milestone' then exists (select 1 from milestones m join projects p on p.id = m.project_id where m.id = p_id and p.client_id = v_client)
    when 'task' then exists (select 1 from tasks where id = p_id and client_id = v_client)
    when 'change_request' then exists (select 1 from change_requests where id = p_id and client_id = v_client)
    when 'ticket' then exists (select 1 from tickets where id = p_id and client_id = v_client)
    when 'invoice' then exists (select 1 from invoices where id = p_id and client_id = v_client)
    when 'contract' then exists (select 1 from contracts where id = p_id and client_id = v_client)
    when 'proposal' then exists (select 1 from proposals where id = p_id and client_id = v_client)
    when 'deal' then exists (select 1 from deals where id = p_id and client_id = v_client)
    when 'approval' then exists (select 1 from approvals a where a.id = p_id and a.client_visible and portal_owns_entity(a.entity_type, a.entity_id))
    else false
  end;
end;
$function$;

delete from role_permissions where permission_id in (select id from permissions where module in ('bugs', 'feature_requests'));
delete from user_permission_overrides where permission_id in (select id from permissions where module in ('bugs', 'feature_requests'));
delete from permissions where module in ('bugs', 'feature_requests');
delete from notification_subscriptions where event_type like 'bug.%' or event_type like 'feature_request.%';
delete from notification_preferences where event_type like 'bug.%' or event_type like 'feature_request.%';

drop table if exists bugs cascade;
drop table if exists feature_requests cascade;
drop type if exists bug_status;
drop type if exists feature_request_status;
