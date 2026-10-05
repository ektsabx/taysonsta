-- Final product spec (docs/14-final-spec-plan.md, phase 1): modules that are
-- not part of Yolias are removed from the database entirely — tables, links
-- from other tables, permissions and settings. Not hidden, removed.
--   cameras · IT & external apps · automation · social accounts · products &
--   services · projects (tasks, milestones, change requests, issues, time
--   tracking) · client portal · branches · WhatsApp/SMS messaging · multiple
--   currencies (Egypt → EGP, everyone else → USD).

-- ───────────── Links from kept tables ─────────────
alter table public.activities drop column if exists project_id;
alter table public.meetings drop column if exists project_id, drop column if exists follow_up_task_id;
alter table public.email_threads drop column if exists project_id;
alter table public.contracts drop column if exists project_id;
alter table public.payment_schedules drop column if exists project_id, drop column if exists milestone_id;
alter table public.invoices drop column if exists project_id, drop column if exists branch_id;
alter table public.payments drop column if exists project_id, drop column if exists branch_id;
alter table public.expenses drop column if exists project_id, drop column if exists branch_id;
alter table public.onboarding_checklists drop column if exists project_id;
alter table public.channels drop column if exists project_id, drop column if exists task_id;
alter table public.tickets drop column if exists project_id, drop column if exists branch_id;
alter table public.support_plans drop column if exists project_id;
alter table public.deals drop column if exists previous_project_id, drop column if exists branch_id;
alter table public.employee_locations drop column if exists task_id, drop column if exists branch_id;
alter table public.leads drop column if exists product_interest_id, drop column if exists branch_id;
alter table public.invoice_items drop column if exists product_id;
alter table public.commission_rules drop column if exists product_id;
alter table public.ads drop column if exists social_target_id;
alter table public.career_jobs drop column if exists branch_id;
alter table public.clients drop column if exists branch_id;
alter table public.departments drop column if exists branch_id;
alter table public.employees drop column if exists branch_id;
alter table public.holidays drop column if exists branch_id;
alter table public.devices drop column if exists branch_id;
alter table public.schedule_assignments drop column if exists branch_id;
alter table public.payroll_runs drop column if exists branch_id;
alter table public.conversations drop column if exists branch_id;
alter table public.support_widgets drop column if exists branch_id;
alter table public.content_items drop column if exists branch_id;
alter table public.asset_events drop column if exists to_branch_id, drop column if exists from_branch_id;

-- ───────────── Removed tables ─────────────
drop table if exists
  public.camera_events, public.cameras,
  public.access_grants, public.access_requests, public.role_app_requirements, public.company_accounts, public.external_apps,
  public.automation_runs, public.automation_rules,
  public.social_post_metrics, public.social_post_targets, public.social_posts, public.social_account_metrics, public.social_accounts,
  public.deal_products, public.products,
  public.time_entries, public.task_checklist_items, public.task_dependencies, public.tasks,
  public.milestone_dependencies, public.milestones, public.change_requests, public.issues,
  public.project_deployments, public.project_members, public.project_templates, public.projects,
  public.client_portal_users,
  public.user_branch_access, public.branches,
  public.whatsapp_widget_clicks, public.whatsapp_widgets, public.outbound_messages, public.message_templates, public.messaging_consents,
  public.exchange_rates
  cascade;

-- ───────────── Channels: no WhatsApp, SMS, voice/phone, portal ─────────────
delete from public.conversations where channel in ('whatsapp', 'sms', 'phone', 'portal');
alter table public.conversations drop constraint if exists conversations_channel_check;
alter table public.conversations add constraint conversations_channel_check
  check (channel in ('web_widget', 'email', 'manual', 'instagram', 'messenger', 'telegram'));

delete from public.notification_deliveries where channel in ('whatsapp', 'sms');
alter table public.notification_deliveries drop constraint if exists notification_deliveries_channel_check;
alter table public.notification_deliveries add constraint notification_deliveries_channel_check check (channel in ('email', 'push'));

-- Activities logged as WhatsApp become notes (the channel doesn't exist anymore).
alter table public.activities alter column type type text;
update public.activities set type = 'note' where type = 'whatsapp';
drop type if exists public.activity_type;
create type public.activity_type as enum ('call', 'email', 'linkedin', 'meeting', 'follow_up', 'task', 'note', 'internal', 'client_communication');
alter table public.activities alter column type type public.activity_type using type::public.activity_type;

-- ───────────── Currency: EGP for Egypt, USD for everyone else ─────────────
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, c.conname
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid = 'public.currencies'::regclass
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('update %s set %I = ''USD'' where %I is not null and %I not in (''EGP'', ''USD'')', r.tbl, r.col, r.col, r.col);
    execute format('alter table %s add constraint %I check (%I is null or %I in (''EGP'', ''USD''))', r.tbl, r.tbl::text || '_' || r.col || '_egp_usd', r.col, r.col);
  end loop;
end $$;
drop table if exists public.currencies cascade;

-- ───────────── Permissions & settings of removed modules ─────────────
delete from public.permissions where module in (
  'cameras', 'apps', 'access', 'automation', 'social', 'products', 'projects', 'milestones', 'tasks', 'change_requests',
  'issues', 'timesheets', 'portal', 'branches', 'messaging'
);
delete from public.bos_settings where key in ('delivery', 'project_completion', 'time_tracking');
-- Admin uses the Yolias design system only: no colour, font or theme customization (spec §44).
update public.bos_settings set value = value - 'base_currency' - 'brand_primary' - 'brand_accent' - 'brand_success' - 'brand_warning'
  - 'brand_danger' - 'brand_info' - 'brand_font_ar' - 'brand_font_en' - 'default_theme' where key = 'company';
