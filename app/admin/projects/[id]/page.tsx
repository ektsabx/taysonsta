import { BosTable } from "@/components/bos/BosTable";
import { RecordDocuments } from "@/components/bos/RecordDocuments";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { DeploymentButton } from "@/components/bos/PortalExtraControls";
import { ActionButton } from "@/components/bos/Dialog";
import { discussAction } from "@/app/admin/communication/chat/actions";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { allowedTransitions, blockerLabels, completionBlockers, getProject, projectFinancials } from "@/services/bos/projects";
import { listActiveStaff, listCurrencies, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, KeyValues, StatusBadge, Money, Tabs, EmptyState, ProgressBar, UserChip } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { FileManager } from "@/components/bos/FileManager";
import { ApprovalPanel } from "@/components/bos/ApprovalPanel";
import { Comments } from "@/components/bos/Comments";
import { GanttTimeline } from "@/components/bos/GanttTimeline";
import { ActivityComposer } from "@/components/bos/ActivityComposer";
import { MeetingScheduler } from "@/components/bos/MeetingScheduler";
import { formatDate, formatDateTime, formatMinutes, todayIn } from "@/lib/bos/format";
import { ProjectForm } from "../ProjectForm";
import { updateProjectAction } from "../actions";
import {
  AddMemberButton,
  ChangeRequestButton,
  FinalApprovalButton,
  IssueFormButton,
  IssueStatusSelect,
  LogTimeForm,
  MilestoneFormButton,
  MilestoneStatusSelect,
  ProjectStatusControl,
  QuickTaskForm,
  RemoveMemberButton,
  SatisfactionForm,
  TaskStatusSelect,
} from "./ProjectControls";

const allTabs = [
  { key: "overview", label: "نظرة عامة" },
  { key: "timeline", label: "الجدول الزمني" },
  { key: "milestones", label: "المراحل" },
  { key: "tasks", label: "المهام" },
  { key: "team", label: "الفريق" },
  { key: "files", label: "الملفات" },
  { key: "client", label: "العميل" },
  { key: "approvals", label: "الموافقات" },
  { key: "issues", label: "المشكلات" },
  { key: "change_requests", label: "طلبات التغيير" },
  { key: "time", label: "الوقت" },
  { key: "finance", label: "المالية" },
  { key: "activity", label: "النشاط" },
  { key: "edit", label: "تعديل" },
];

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("projects.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  if (!(await canAccessEntity(bos, "project", id))) notFound();
  let project;
  try {
    project = await getProject(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const canUpdate = can(bos, "projects.update") && (await canAccessEntity(bos, "project", id, "update"));
  const sensitive = can(bos, "projects.view_sensitive");
  const canFinance = sensitive || can(bos, "invoices.read");
  const tabs = allTabs.map((t) => ({ ...t, hidden: (t.key === "finance" && !canFinance) || (t.key === "edit" && !canUpdate) }));
  const tab = tabs.some((t) => t.key === sp.tab && !t.hidden) ? sp.tab : "overview";

  const client = project.clients as unknown as { id: string; name: string; company_name: string | null; account_manager_id: string | null } | null;
  const contact = project.contacts as unknown as { id: string; full_name: string; email: string | null; phone: string | null } | null;
  const deal = project.deals as unknown as { id: string; name: string; deal_number: string; value: number; currency: string; payment_status: string; assigned_to: string | null } | null;
  const contract = project.contracts as unknown as { id: string; contract_number: string; status: string } | null;

  const [names, staff, blockers, { data: milestones }, { data: members }, fin] = await Promise.all([
    userNameMap(),
    listActiveStaff(),
    completionBlockers(id),
    db().from("milestones").select("*").eq("project_id", id).order("sort_order"),
    db().from("project_members").select("*").eq("project_id", id),
    sensitive || tab === "finance" || tab === "overview" ? projectFinancials(id) : Promise.resolve(null),
  ]);
  const staffOptions = staff.map((s) => ({ value: s.userId, label: s.name }));
  const milestoneOptions = (milestones ?? []).map((m) => ({ value: m.id, label: m.name }));
  const today = todayIn(bos.employee.timezone);

  const needsTasks = ["tasks", "overview", "time", "timeline"].includes(tab);
  const [{ data: tasks }, { data: issues }, { data: crs }, { data: timeEntries }, { data: invoices }, { data: schedules }, { data: expenses }, { data: deployments }, { data: onboarding }] = await Promise.all([
    needsTasks ? db().from("tasks").select("id, title, status, priority, due_date, assigned_to, milestone_id, estimated_minutes, actual_minutes, is_required, parent_task_id").eq("project_id", id).is("archived_at", null).order("sort_order") : Promise.resolve({ data: [] }),
    tab === "issues" || tab === "overview" ? db().from("issues").select("*").eq("project_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    tab === "change_requests" ? db().from("change_requests").select("*").eq("project_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    tab === "time" ? db().from("time_entries").select("*, tasks(title)").eq("project_id", id).order("started_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    tab === "finance" ? db().from("invoices").select("id, invoice_number, status, total, balance, currency, due_date").eq("project_id", id).order("issue_date") : Promise.resolve({ data: [] }),
    tab === "finance" ? db().from("payment_schedules").select("*").eq("project_id", id).order("sort_order") : Promise.resolve({ data: [] }),
    tab === "finance" && sensitive ? db().from("expenses").select("id, description, amount, currency, expense_date, approval_status, expense_categories(name)").eq("project_id", id).is("archived_at", null).order("expense_date", { ascending: false }) : Promise.resolve({ data: [] }),
    tab === "client" ? db().from("project_deployments").select("*").eq("project_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as { id: string; environment: string; version: string | null; url: string | null; status: string; scheduled_at: string | null; deployed_at: string | null; notes: string | null; client_visible: boolean }[] }),
    tab === "overview" || tab === "client" ? db().from("onboarding_checklists").select("id, status, onboarding_items(id, label, is_done, sort_order)").eq("project_id", id).eq("subject", "client").maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const openTasks = (tasks ?? []).filter((t) => !["completed", "cancelled"].includes(t.status));
  const nextMilestone = (milestones ?? []).find((m) => m.status !== "completed");
  const onboardingItems = ((onboarding as { onboarding_items?: { id: string; label: string; is_done: boolean; sort_order: number }[] } | null)?.onboarding_items ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const statusCount = (s: string) => (tasks ?? []).filter((t) => t.status === s).length;

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={
          <span className="bos-row" style={{ gap: 8 }}>
            <span>{project.project_number}</span>
            <StatusBadge map="project_status" value={project.status} />
            <StatusBadge map="project_health" value={project.health} />
            {project.health_reason ? <span className="bos-faint"><Tx>{project.health_reason}</Tx></span> : null}
          </span>
        }
       
        actions={
          <>
            {can(bos, "chat.create") ? <ActionButton label="مناقشة داخلية" className="admin-btn small secondary" action={discussAction.bind(null, "project", id)} /> : null}
            {can(bos, "tasks.create") ? <Link href={`/admin/projects/tasks/new?projectId=${id}`} className="admin-btn small secondary"><Tx>+ مهمة</Tx></Link> : null}
            {can(bos, "meetings.create") ? <MeetingScheduler related={{ project_id: id, client_id: project.client_id, contact_id: project.primary_contact_id }} staff={staffOptions} defaultTitle={`${project.name} — meeting`} /> : null}
            {can(bos, "activities.create") ? <ActivityComposer related={{ project_id: id, client_id: project.client_id }} staff={staffOptions} /> : null}
            {canUpdate && ["client_review", "launch"].includes(project.status) ? <FinalApprovalButton projectId={id} /> : null}
            {can(bos, "invoices.create") ? <Link href={`/admin/finance/invoices/new?projectId=${id}`} className="admin-btn small ghost"><Tx>+ فاتورة</Tx></Link> : null}
            {project.status === "completed" && can(bos, "deals.create") ? <Link href={`/admin/sales/deals/new?fromProject=${id}`} className="admin-btn small success"><Tx>فرصة بيع إضافي</Tx></Link> : null}
          </>
        }
      />

      <Summary
        items={[
          { label: "الحالة", value: canUpdate ? <ProjectStatusControl projectId={id} status={project.status} allowed={allowedTransitions(project.status)} blockers={blockers.map((b) => blockerLabels[b] ?? b)} canForce={can(bos, "projects.manage", "all")} /> : <StatusBadge map="project_status" value={project.status} /> },
          { label: "العميل", value: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—" },
          { label: "مدير المشروع", value: <UserChip name={project.pm_id ? names.get(project.pm_id) : null} /> },
          { label: "التقدم", value: <ProgressBar value={project.progress} /> },
          ...(sensitive
            ? [
                { label: "الميزانية", value: <Money value={project.budget} currency={project.currency} /> },
                { label: "الإيراد", value: fin ? <Money value={fin.revenue} currency={project.currency} /> : "—" },
                { label: "التكلفة", value: fin ? <Money value={fin.cost} currency={project.currency} /> : "—" },
                { label: "الهامش", value: fin?.margin !== null && fin ? `${fin.margin}%` : "—" },
              ]
            : []),
          { label: "الموعد النهائي", value: formatDate(project.deadline) },
        ]}
      />

      <Tabs tabs={tabs} active={tab} baseHref={`/admin/projects/${id}`} />

      {tab === "overview" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="ملخص">
              <KeyValues
                items={[
                  { label: "الصفقة", value: deal ? <Link className="bos-link" href={`/admin/sales/deals/${deal.id}`}>{deal.deal_number}</Link> : "مشروع داخلي" },
                  { label: "العقد", value: contract ? <Link className="bos-link" href={`/admin/sales/contracts/${contract.id}`}>{contract.contract_number}</Link> : null },
                  { label: "البداية", value: formatDate(project.start_date) },
                  { label: "المرحلة التالية", value: nextMilestone ? `${nextMilestone.name} · ${formatDate(nextMilestone.due_date)}` : "كل المراحل مكتملة" },
                  { label: "المهام المفتوحة", value: `${openTasks.length} (متأخرة ${statusCount("overdue")})` },
                  { label: "المشكلات المفتوحة", value: (issues ?? []).filter((i) => ["open", "in_progress"].includes(i.status)).length },
                  { label: "حالة الدفع", value: deal ? <StatusBadge map="deal_payment_status" value={deal.payment_status} /> : null },
                  { label: "فترة الدعم حتى", value: project.support_until ? formatDate(project.support_until) : null, hidden: !project.support_until },
                  { label: "رضا العميل", value: project.satisfaction_score ? `${project.satisfaction_score}/10` : null, hidden: !project.satisfaction_score },
                ]}
              />
            </Card>
            <Card title="النطاق">{project.scope ? <div className="bos-prose"><Tx>{project.scope}</Tx></div> : <div className="bos-faint"><Tx>لم يُحدد النطاق.</Tx></div>}</Card>
            {project.status === "completed" && !project.satisfaction_score && canUpdate ? (
              <Card title="تقييم رضا العميل">
                <SatisfactionForm projectId={id} />
              </Card>
            ) : null}
          </div>
          <div>
            <Card title="شروط الإكمال">
              {blockers.length ? (
                <ul style={{ paddingInlineStart: 18, fontSize: 13, lineHeight: 1.9 }}>
                  {blockers.map((b) => (
                    <li key={b} style={{ color: "var(--bos-danger)" }}><Tx>{blockerLabels[b] ?? b}</Tx></li>
                  ))}
                </ul>
              ) : (
                <div className="bos-form-success"><Tx>كل شروط الإكمال مستوفاة.</Tx></div>
              )}
            </Card>
            {onboardingItems.length ? (
              <Card title={<Tx vars={{ v: onboardingItems.filter((i) => i.is_done).length, onboardingItems_count: onboardingItems.length }}>{"تهيئة العميل ({v}/{onboardingItems_count})"}</Tx>}>
                <ul style={{ listStyle: "none", fontSize: 13, lineHeight: 1.9 }}>
                  {onboardingItems.map((i) => (
                    <li key={i.id} style={{ color: i.is_done ? "#4ade80" : undefined }}>{i.is_done ? "✓" : "○"} {i.label}</li>
                  ))}
                </ul>
                {client ? <Link href={`/admin/clients/${client.id}?tab=onboarding`} className="bos-link-muted" style={{ fontSize: 12 }}><Tx>إدارة التهيئة</Tx></Link> : null}
              </Card>
            ) : null}
            <Card title="آخر الأحداث">
              <ActivityTimeline entityType="project" entityId={id} limit={8} moreHref={`/admin/projects/${id}?tab=activity`} />
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "timeline" ? (
        <Card title="الجدول الزمني للمراحل">
          <GanttTimeline
            start={project.start_date}
            end={project.deadline}
            items={(milestones ?? []).map((m, i, arr) => ({ id: m.id, name: m.name, from: i === 0 ? project.start_date : arr[i - 1].due_date, to: m.due_date, status: m.status, progress: m.progress }))}
          />
        </Card>
      ) : null}

      {tab === "milestones" ? (
        <Card title="المراحل" actions={can(bos, "milestones.create") && canUpdate ? <MilestoneFormButton projectId={id} staff={staffOptions} /> : null}>
          {milestones?.length ? (
            <BosTable className="bos-table responsive">
              <thead>
                <tr><th><Tx>المرحلة</Tx></th><th><Tx>الاستحقاق</Tx></th><th><Tx>المسؤول</Tx></th><th><Tx>التقدم</Tx></th><th><Tx>موافقة العميل</Tx></th><th><Tx>الحالة</Tx></th><th /></tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="المرحلة">{m.name}{m.deliverables ? <span className="cell-sub"><Tx>{m.deliverables}</Tx></span> : null}</td>
                    <td data-label="الاستحقاق" style={m.status !== "completed" && m.due_date && m.due_date < today ? { color: "var(--bos-danger)" } : undefined}>{formatDate(m.due_date)}</td>
                    <td data-label="المسؤول">{m.owner_id ? names.get(m.owner_id) : "—"}</td>
                    <td data-label="التقدم" style={{ minWidth: 110 }}><ProgressBar value={m.progress} /></td>
                    <td data-label="موافقة العميل">{m.requires_client_approval ? <StatusBadge map="simple_approval" value={m.approval_status === "not_required" ? "pending" : m.approval_status} /> : "—"}</td>
                    <td data-label="الحالة">{canUpdate ? <MilestoneStatusSelect id={m.id} status={m.status} requiresApproval={m.requires_client_approval} approvalStatus={m.approval_status} /> : <StatusBadge map="milestone_status" value={m.status} />}</td>
                    <td className="col-actions">{canUpdate ? <MilestoneFormButton projectId={id} staff={staffOptions} milestone={m} label="تعديل" /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : (
            <EmptyState title="لا توجد مراحل" />
          )}
        </Card>
      ) : null}

      {tab === "tasks" ? (
        <Card title={<Tx vars={{ openTasks_count: openTasks.length }}>{"المهام ({openTasks_count} مفتوحة)"}</Tx>} actions={<Link href={`/admin/projects/tasks?project=${id}&view=all`} className="admin-btn small ghost"><Tx>مركز المهام</Tx></Link>}>
          {can(bos, "tasks.create") ? <QuickTaskForm projectId={id} milestones={milestoneOptions} staff={staffOptions} /> : null}
          {(milestones ?? []).concat([{ id: "none", name: "بدون مرحلة" } as never]).map((m: { id: string; name: string }) => {
            const list = (tasks ?? []).filter((t) => (m.id === "none" ? !t.milestone_id : t.milestone_id === m.id) && !t.parent_task_id);
            if (!list.length) return null;
            return (
              <div key={m.id} style={{ marginTop: 14 }}>
                <div className="bos-faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{m.name}</div>
                <BosTable className="bos-table responsive">
                  <tbody>
                    {list.map((t) => (
                      <tr key={t.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="المهمة"><Link href={`/admin/projects/tasks/${t.id}`}><Tx>{t.title}</Tx></Link>{t.is_required ? null : <span className="cell-sub"><Tx>اختيارية</Tx></span>}</td>
                        <td data-label="المسؤول">{t.assigned_to ? names.get(t.assigned_to) : <span className="bos-faint"><Tx>غير معيّن</Tx></span>}</td>
                        <td data-label="الاستحقاق" style={t.status === "overdue" ? { color: "var(--bos-danger)" } : undefined}>{formatDate(t.due_date)}</td>
                        <td data-label="الوقت" className="bos-num">{formatMinutes(t.actual_minutes)} / {t.estimated_minutes ? formatMinutes(t.estimated_minutes) : "—"}</td>
                        <td data-label="الأولوية"><StatusBadge map="priority" value={t.priority} /></td>
                        <td data-label="الحالة">{can(bos, "tasks.update") ? <TaskStatusSelect id={t.id} status={t.status} /> : <StatusBadge map="task_status" value={t.status} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              </div>
            );
          })}
          {!tasks?.length ? <EmptyState title="لا توجد مهام بعد" /> : null}
        </Card>
      ) : null}

      {tab === "team" ? (
        <Card title="الفريق" actions={can(bos, "projects.manage") && canUpdate ? <AddMemberButton projectId={id} staff={staffOptions} /> : null}>
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>العضو</Tx></th><th><Tx>الدور</Tx></th><th><Tx>التخصيص</Tx></th><th><Tx>المهام المفتوحة</Tx></th><th /></tr></thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.user_id}>
                  <td className="cell-primary cell-primary-mobile" data-label="العضو"><UserChip name={names.get(m.user_id)} /></td>
                  <td data-label="الدور">{m.user_id === project.pm_id ? "Project Manager" : m.role_label ?? "—"}</td>
                  <td data-label="التخصيص">{m.allocation_percent !== null ? `${m.allocation_percent}%` : "—"}</td>
                  <td data-label="المهام">{openTasks.filter((t) => t.assigned_to === m.user_id).length}</td>
                  <td className="col-actions">{can(bos, "projects.manage") && canUpdate && m.user_id !== project.pm_id ? <RemoveMemberButton projectId={id} userId={m.user_id} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        </Card>
      ) : null}

      {tab === "files" ? (
        <Card title="ملفات المشروع">
          <FileManager entityType="project" entityId={id} canUpload={can(bos, "files.create")} allowClientVisible />
        </Card>
      ) : null}

      {tab === "client" ? (
        <Card title="النشر (يظهر للعميل في البوابة)" actions={canUpdate ? <DeploymentButton projectId={id} /> : null}>
          {(deployments ?? []).length ? (
            <BosTable className="bos-table">
              <thead><tr><th><Tx>البيئة</Tx></th><th><Tx>الإصدار</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>للعميل</Tx></th><th /></tr></thead>
              <tbody>{(deployments ?? []).map((d) => <tr key={d.id}><td>{d.environment}</td><td dir="ltr">{d.version ?? "—"}{d.url ? <> · <a href={d.url} target="_blank" rel="noreferrer">↗</a></> : null}</td><td><Tx>{({ planned: "مخطط", in_progress: "جارٍ النشر", deployed: "منشور", failed: "فشل", rolled_back: "تم التراجع" } as Record<string, string>)[d.status] ?? d.status}</Tx></td><td>{formatDateTime(d.deployed_at ?? d.scheduled_at)}</td><td>{d.client_visible ? "✓" : "—"}</td><td>{canUpdate ? <DeploymentButton projectId={id} dep={d} /> : null}</td></tr>)}</tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد عمليات نشر" />}
        </Card>
      ) : null}
      {tab === "client" ? (
        <div className="bos-grid cols-2">
          <Card title="العميل">
            <KeyValues
              items={[
                { label: "الحساب", value: client ? <Link className="bos-link" href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : null },
                { label: "مدير الحساب", value: client?.account_manager_id ? names.get(client.account_manager_id) : null },
                { label: "جهة الاتصال الأساسية", value: contact ? <Link className="bos-link" href={`/admin/contacts/${contact.id}`}>{contact.full_name}</Link> : null },
                { label: "البريد", value: contact?.email },
                { label: "الهاتف", value: contact?.phone },
              ]}
            />
          </Card>
          <Card title="ملاحظات مرئية للعميل">
            <Comments entityType="project" entityId={id} viewerId={bos.userId} allowClientVisible />
          </Card>
        </div>
      ) : null}

      {tab === "approvals" ? (
        <div className="bos-grid cols-2">
          <Card title="موافقات المشروع">
            <ApprovalPanel entityType="project" entityId={id} bos={bos} />
          </Card>
          <Card title="موافقات المراحل">
            {(milestones ?? []).filter((m) => m.requires_client_approval).length ? (
              await Promise.all(
                (milestones ?? []).filter((m) => m.requires_client_approval).map(async (m) => (
                  <div key={m.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{m.name}</div>
                    <ApprovalPanel entityType="milestone" entityId={m.id} bos={bos} />
                  </div>
                )),
              )
            ) : (
              <div className="bos-faint"><Tx>لا توجد مراحل تتطلب موافقة العميل.</Tx></div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "issues" ? (
        <Card title="المشكلات" actions={can(bos, "issues.create") ? <IssueFormButton projectId={id} staff={staffOptions} /> : null}>
          {issues?.length ? (
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>المشكلة</Tx></th><th><Tx>الخطورة</Tx></th><th><Tx>المسؤول</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="المشكلة"><Link href={`/admin/projects/issues/${i.id}`}><Tx>{i.title}</Tx></Link></td>
                    <td data-label="الخطورة"><StatusBadge map="severity" value={i.severity} /></td>
                    <td data-label="المسؤول">{i.assigned_to ? names.get(i.assigned_to) : "—"}</td>
                    <td data-label="التاريخ">{formatDate(i.created_at)}</td>
                    <td data-label="الحالة">{can(bos, "issues.update") ? <IssueStatusSelect id={i.id} status={i.status} /> : <StatusBadge map="issue_status" value={i.status} />}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : (
            <EmptyState title="لا توجد مشكلات" />
          )}
        </Card>
      ) : null}

      {tab === "change_requests" ? (
        <Card title="طلبات التغيير" actions={can(bos, "change_requests.create") ? <ChangeRequestButton projectId={id} currencies={await listCurrencies()} defaultCurrency={project.currency} contacts={contact ? [{ value: contact.id, label: contact.full_name }] : []} /> : null}>
          {crs?.length ? (
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الطلب</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>أيام</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
              <tbody>
                {crs.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="الطلب"><Link href={`/admin/projects/change-requests/${c.id}`}>{c.cr_number} — {c.title}</Link></td>
                    <td data-label="التكلفة"><Money value={c.additional_cost} currency={c.currency} /></td>
                    <td data-label="أيام"><Tx>{c.additional_days}</Tx></td>
                    <td data-label="الحالة"><StatusBadge map="change_request_status" value={c.status} /></td>
                    <td data-label="التاريخ">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : (
            <EmptyState title="لا توجد طلبات تغيير" description="أي عمل خارج النطاق الأصلي يُسجل كطلب تغيير ليُحدّث الميزانية والجدول عند الموافقة." />
          )}
        </Card>
      ) : null}

      {tab === "time" ? (
        <div className="bos-grid main-side">
          <Card title="سجل الوقت">
            {timeEntries?.length ? (
              <BosTable className="bos-table responsive">
                <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>المهمة</Tx></th><th><Tx>البداية</Tx></th><th><Tx>المدة</Tx></th>{sensitive ? <th><Tx>التكلفة</Tx></th> : null}</tr></thead>
                <tbody>
                  {timeEntries.map((t) => (
                    <tr key={t.id}>
                      <td className="cell-primary cell-primary-mobile" data-label="الموظف">{names.get(t.user_id)}</td>
                      <td data-label="المهمة">{(t.tasks as unknown as { title: string } | null)?.title ?? t.description ?? "—"}</td>
                      <td data-label="البداية">{formatDateTime(t.started_at)}</td>
                      <td data-label="المدة"><Tx>{t.ended_at ? formatMinutes(t.duration_minutes) : "يعمل الآن"}</Tx></td>
                      {sensitive ? <td data-label="التكلفة">{t.cost_amount ? <Money value={t.cost_amount} currency={t.cost_currency} /> : "—"}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </BosTable>
            ) : (
              <EmptyState title="لا يوجد وقت مسجل" />
            )}
          </Card>
          <div>
            <Card title="المخطط مقابل الفعلي">
              <KeyValues
                items={[
                  { label: "المخطط", value: formatMinutes((tasks ?? []).reduce((s, t) => s + (t.estimated_minutes ?? 0), 0)) },
                  { label: "الفعلي", value: formatMinutes((tasks ?? []).reduce((s, t) => s + (t.actual_minutes ?? 0), 0)) },
                ]}
              />
            </Card>
            {can(bos, "timesheets.create") ? (
              <Card title="تسجيل وقت">
                <LogTimeForm projectId={id} today={today} tasks={openTasks.map((t) => ({ value: t.id, label: t.title }))} />
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "finance" && canFinance ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="جدول الدفعات">
              {schedules?.length ? (
                <BosTable className="bos-table responsive">
                  <thead><tr><th><Tx>الدفعة</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الاستحقاق</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
                  <tbody>
                    {schedules.map((s) => (
                      <tr key={s.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="الدفعة">{s.label} ({s.percent}%)</td>
                        <td data-label="المبلغ"><Money value={s.amount} currency={s.currency} /></td>
                        <td data-label="الاستحقاق">{formatDate(s.due_date)}</td>
                        <td data-label="الحالة"><StatusBadge map="schedule_status" value={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              ) : (
                <div className="bos-faint"><Tx>لا يوجد جدول دفعات.</Tx></div>
              )}
            </Card>
            <Card title="الفواتير">
              {invoices?.length ? (
                <BosTable className="bos-table responsive">
                  <thead><tr><th><Tx>الفاتورة</Tx></th><th><Tx>الإجمالي</Tx></th><th><Tx>المتبقي</Tx></th><th><Tx>الاستحقاق</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="الفاتورة"><Link href={`/admin/finance/invoices/${i.id}`}>{i.invoice_number}</Link></td>
                        <td data-label="الإجمالي"><Money value={i.total} currency={i.currency} /></td>
                        <td data-label="المتبقي"><Money value={i.balance} currency={i.currency} /></td>
                        <td data-label="الاستحقاق">{formatDate(i.due_date)}</td>
                        <td data-label="الحالة"><StatusBadge map="invoice_status" value={i.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              ) : (
                <div className="bos-faint"><Tx>لا توجد فواتير.</Tx></div>
              )}
            </Card>
            {sensitive ? (
              <Card title="المصروفات" actions={can(bos, "expenses.create") ? <Link href={`/admin/finance/expenses/new?projectId=${id}`} className="admin-btn small ghost"><Tx>+ مصروف</Tx></Link> : null}>
                {expenses?.length ? (
                  <BosTable className="bos-table responsive">
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id}>
                          <td className="cell-primary cell-primary-mobile" data-label="المصروف"><Link href={`/admin/finance/expenses/${e.id}`}><Tx>{e.description}</Tx></Link></td>
                          <td data-label="الفئة">{(e.expense_categories as unknown as { name: string } | null)?.name}</td>
                          <td data-label="المبلغ"><Money value={e.amount} currency={e.currency} /></td>
                          <td data-label="الحالة"><StatusBadge map="simple_approval" value={e.approval_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </BosTable>
                ) : (
                  <div className="bos-faint"><Tx>لا توجد مصروفات.</Tx></div>
                )}
              </Card>
            ) : null}
          </div>
          {sensitive && fin ? (
            <Card title="ربحية المشروع">
              <BosTable className="bos-table">
                <tbody>
                  <tr><td>الإيراد ({fin.revenue_basis === "invoiced" ? "مفوتر" : "محصّل"})</td><td className="bos-num" style={{ textAlign: "end" }}><Money value={fin.revenue} currency={project.currency} /></td></tr>
                  <tr><td><Tx vars={{ v: String(fin.hours) }}>{"− تكلفة الموظفين ({v} ساعة)"}</Tx></td><td style={{ textAlign: "end" }}><Money value={fin.employee_cost} currency={project.currency} /></td></tr>
                  <tr><td><Tx>− المستقلون</Tx></td><td style={{ textAlign: "end" }}><Money value={fin.freelancer_cost} currency={project.currency} /></td></tr>
                  <tr><td><Tx>− الموردون</Tx></td><td style={{ textAlign: "end" }}><Money value={fin.vendor_cost} currency={project.currency} /></td></tr>
                  <tr><td><Tx>− البنية التحتية</Tx></td><td style={{ textAlign: "end" }}><Money value={fin.infrastructure_cost} currency={project.currency} /></td></tr>
                  <tr><td><Tx>− خدمات الطرف الثالث</Tx></td><td style={{ textAlign: "end" }}><Money value={fin.third_party_cost} currency={project.currency} /></td></tr>
                  <tr><td><Tx>− مصروفات أخرى</Tx></td><td style={{ textAlign: "end" }}><Money value={fin.other_cost} currency={project.currency} /></td></tr>
                  <tr><td style={{ fontWeight: 800 }}><Tx>= إجمالي ربح المشروع</Tx></td><td style={{ textAlign: "end", fontWeight: 800 }}><Money value={fin.profit} currency={project.currency} /></td></tr>
                  <tr><td><Tx>هامش الربح</Tx></td><td style={{ textAlign: "end" }}>{fin.margin === null ? "—" : `${fin.margin}%`}</td></tr>
                </tbody>
              </BosTable>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "activity" ? (
        <Card title="النشاط">
          <ActivityTimeline entityType="project" entityId={id} limit={200} />
        </Card>
      ) : null}

      {tab === "edit" && canUpdate ? (
        <ProjectForm
          action={updateProjectAction.bind(null, id)}
          currencies={await listCurrencies()}
          staff={staffOptions}
          canEditBudget={sensitive}
          canAssign={can(bos, "projects.assign")}
          initialClient={client ? { id: client.id, label: client.company_name ?? client.name } : null}
          initialContact={contact ? { id: contact.id, label: contact.full_name } : null}
          initial={{ name: project.name, budget: String(project.budget), currency: project.currency, scope: project.scope, start_date: project.start_date, deadline: project.deadline, pm_id: project.pm_id }}
        />
      ) : null}
      {tab === "overview" ? <RecordDocuments bos={bos} entityType="project" entityId={id} /> : null}
    </>
  );
}
