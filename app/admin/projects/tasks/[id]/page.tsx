import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { ActionButton } from "@/components/bos/Dialog";
import { discussAction } from "@/app/admin/communication/chat/actions";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge, Tabs, UserChip } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { Comments } from "@/components/bos/Comments";
import { FileManager } from "@/components/bos/FileManager";
import { formatDate, formatDateTime, formatMinutes } from "@/lib/bos/format";
import { TaskStatusSelect } from "../../[id]/ProjectControls";
import { TaskForm } from "../TaskForm";
import { updateTaskAction } from "../../actions";
import { ArchiveTaskButton, Checklist, Dependencies, TimerControls } from "./TaskDetailControls";

const tabs = [
  { key: "details", label: "التفاصيل" },
  { key: "comments", label: "التعليقات" },
  { key: "files", label: "المرفقات" },
  { key: "time", label: "الوقت" },
  { key: "timeline", label: "السجل" },
  { key: "edit", label: "تعديل" },
];

export default async function TaskDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("tasks.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  if (!(await canAccessEntity(bos, "task", id))) notFound();
  const { data: t, error } = await db().from("tasks").select("*, projects(id, name), milestones(id, name), deals(id, name), clients(id, name), leads(id, name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!t) notFound();
  const canUpdate = can(bos, "tasks.update") && (await canAccessEntity(bos, "task", id, "update"));
  const tab = tabs.some((x) => x.key === sp.tab) && (sp.tab !== "edit" || canUpdate) ? sp.tab : "details";

  const [names, staff, { data: subtasks }, { data: checklist }, { data: deps }, { data: blocking }, { data: entries }, { data: running }, { data: parent }] = await Promise.all([
    userNameMap(),
    listActiveStaff(),
    db().from("tasks").select("id, title, status, assigned_to, due_date").eq("parent_task_id", id).is("archived_at", null).order("created_at"),
    db().from("task_checklist_items").select("id, label, is_done").eq("task_id", id).order("sort_order"),
    db().from("task_dependencies").select("depends_on_task_id, tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)").eq("task_id", id),
    db().from("task_dependencies").select("task_id, tasks!task_dependencies_task_id_fkey(id, title, status)").eq("depends_on_task_id", id),
    db().from("time_entries").select("*").eq("task_id", id).order("started_at", { ascending: false }).limit(100),
    db().from("time_entries").select("id, task_id").eq("user_id", bos.userId).is("ended_at", null).maybeSingle(),
    t.parent_task_id ? db().from("tasks").select("id, title").eq("id", t.parent_task_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const project = t.projects as unknown as { id: string; name: string } | null;
  const milestone = t.milestones as unknown as { id: string; name: string } | null;
  const deal = t.deals as unknown as { id: string; name: string } | null;
  const { data: ms } = project ? await db().from("milestones").select("id, name").eq("project_id", project.id).order("sort_order") : { data: [] };

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={<span className="bos-row" style={{ gap: 6 }}><StatusBadge map="task_status" value={t.status} /><StatusBadge map="priority" value={t.priority} />{t.is_required ? null : <StatusBadge tone="neutral" label="اختيارية" />}</span>}
        breadcrumbs={[{ label: "المهام", href: "/admin/projects/tasks" }, ...(project ? [{ label: project.name, href: `/admin/projects/${project.id}?tab=tasks` }] : []), { label: t.title }]}
        actions={
          <>
            {can(bos, "chat.create") ? <ActionButton label="مناقشة داخلية" className="admin-btn small secondary" action={discussAction.bind(null, "task", id)} /> : null}
            {can(bos, "timesheets.create") ? <TimerControls taskId={id} projectId={t.project_id} running={running?.task_id === id} /> : null}
            {can(bos, "tasks.create") ? <Link href={`/admin/projects/tasks/new?parentId=${id}${t.project_id ? `&projectId=${t.project_id}` : ""}`} className="admin-btn small secondary"><Tx>+ مهمة فرعية</Tx></Link> : null}
            {canUpdate ? <ArchiveTaskButton taskId={id} /> : null}
          </>
        }
      />
      <Summary
        items={[
          { label: "الحالة", value: canUpdate ? <TaskStatusSelect id={id} status={t.status} /> : <StatusBadge map="task_status" value={t.status} /> },
          { label: "المسؤول", value: <UserChip name={t.assigned_to ? names.get(t.assigned_to) : null} /> },
          { label: "الاستحقاق", value: formatDate(t.due_date) },
          { label: "المشروع", value: project ? <Link href={`/admin/projects/${project.id}`}>{project.name}</Link> : deal ? <Link href={`/admin/sales/deals/${deal.id}`}>{deal.name}</Link> : "—" },
          { label: "المرحلة", value: milestone?.name ?? "—" },
          { label: "الوقت (فعلي / مقدّر)", value: `${formatMinutes(t.actual_minutes)} / ${t.estimated_minutes ? formatMinutes(t.estimated_minutes) : "—"}` },
        ]}
      />
      <Tabs tabs={tabs.map((x) => ({ ...x, hidden: x.key === "edit" && !canUpdate }))} active={tab} baseHref={`/admin/projects/tasks/${id}`} />

      {tab === "details" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="الوصف">{t.description ? <div className="bos-prose"><Tx>{t.description}</Tx></div> : <div className="bos-faint"><Tx>لا يوجد وصف.</Tx></div>}</Card>
            <Card title={<Tx vars={{ subtasks_count: subtasks?.length ?? 0 }}>{"المهام الفرعية ({subtasks_count})"}</Tx>}>
              {parent ? <div style={{ marginBottom: 8, fontSize: 12.5 }}><Tx>المهمة الأم:</Tx> <Link className="bos-link" href={`/admin/projects/tasks/${parent.id}`}><Tx>{parent.title}</Tx></Link></div> : null}
              {subtasks?.length ? (
                <table className="bos-table responsive">
                  <tbody>
                    {subtasks.map((s) => (
                      <tr key={s.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="المهمة"><Link href={`/admin/projects/tasks/${s.id}`}><Tx>{s.title}</Tx></Link></td>
                        <td data-label="المسؤول">{s.assigned_to ? names.get(s.assigned_to) : "—"}</td>
                        <td data-label="الاستحقاق">{formatDate(s.due_date)}</td>
                        <td data-label="الحالة">{canUpdate ? <TaskStatusSelect id={s.id} status={s.status} /> : <StatusBadge map="task_status" value={s.status} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>لا توجد مهام فرعية.</Tx></div>
              )}
            </Card>
          </div>
          <div>
            <Card title="قائمة التحقق">
              <Checklist taskId={id} items={checklist ?? []} editable={canUpdate} />
            </Card>
            <Card title="تعتمد على">
              <Dependencies taskId={id} projectId={t.project_id} editable={canUpdate} deps={(deps ?? []).map((d) => d.tasks as unknown as { id: string; title: string; status: string })} />
            </Card>
            {blocking?.length ? (
              <Card title="تعيق هذه المهام">
                <ul style={{ listStyle: "none", fontSize: 13, lineHeight: 1.9 }}>
                  {blocking.map((b) => {
                    const bt = b.tasks as unknown as { id: string; title: string };
                    return <li key={bt.id}><Link className="bos-link" href={`/admin/projects/tasks/${bt.id}`}><Tx>{bt.title}</Tx></Link></li>;
                  })}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "comments" ? <Card title="التعليقات"><Comments entityType="task" entityId={id} viewerId={bos.userId} /></Card> : null}
      {tab === "files" ? <Card title="المرفقات"><FileManager entityType="task" entityId={id} canUpload={can(bos, "files.create")} /></Card> : null}
      {tab === "time" ? (
        <Card title="سجل الوقت">
          {entries?.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>البداية</Tx></th><th><Tx>المدة</Tx></th><th><Tx>الوصف</Tx></th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="الموظف">{names.get(e.user_id)}</td>
                    <td data-label="البداية">{formatDateTime(e.started_at)}</td>
                    <td data-label="المدة"><Tx>{e.ended_at ? formatMinutes(e.duration_minutes) : "يعمل الآن"}</Tx></td>
                    <td data-label="الوصف"><Tx>{e.description ?? "—"}</Tx></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="bos-faint"><Tx>لم يُسجل وقت على هذه المهمة.</Tx></div>
          )}
        </Card>
      ) : null}
      {tab === "timeline" ? <Card title="السجل"><ActivityTimeline entityType="task" entityId={id} limit={100} /></Card> : null}
      {tab === "edit" && canUpdate ? (
        <TaskForm
          action={updateTaskAction.bind(null, id)}
          staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
          milestonesByProject={project ? { [project.id]: (ms ?? []).map((m) => ({ value: m.id, label: m.name })) } : {}}
          initialProject={project ? { id: project.id, label: project.name } : null}
          initialDeal={deal ? { id: deal.id, label: deal.name } : null}
          hidden={{ parent_task_id: t.parent_task_id, client_id: t.client_id, lead_id: t.lead_id }}
          canAssign={can(bos, "tasks.assign") || can(bos, "projects.assign")}
          initial={{
            title: t.title,
            description: t.description,
            assigned_to: t.assigned_to,
            milestone_id: t.milestone_id,
            priority: t.priority,
            due_date: t.due_date,
            start_date: t.start_date,
            estimated_hours: t.estimated_minutes ? String(Math.round((t.estimated_minutes / 60) * 100) / 100) : "",
            is_required: t.is_required,
          }}
        />
      ) : null}
    </>
  );
}
