import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listTasks } from "@/services/bos/delivery";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate, formatMinutes } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { TaskStatusSelect } from "../[id]/ProjectControls";

const views = [
  { key: "my", label: "مهامي" },
  { key: "today", label: "اليوم" },
  { key: "overdue", label: "المتأخرة" },
  { key: "upcoming", label: "القادمة" },
  { key: "team", label: "مهام الفريق" },
  { key: "completed", label: "المكتملة" },
  { key: "all", label: "الكل" },
];

const columns: DataColumn[] = [
  { key: "title", label: "المهمة", primary: true, alwaysVisible: true },
  { key: "related", label: "مرتبطة بـ" },
  { key: "assignee", label: "المسؤول" },
  { key: "due", label: "الاستحقاق" },
  { key: "priority", label: "الأولوية" },
  { key: "time", label: "الوقت", defaultHidden: true },
  { key: "status", label: "الحالة" },
];

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("tasks.read");
  const params = await readParams(searchParams);
  const view = views.some((v) => v.key === params.view) ? params.view : "my";
  const [result, names, staff] = await Promise.all([listTasks(bos, scope, { ...params, view, page: pageOf(params) }), userNameMap(), listActiveStaff()]);
  const canUpdate = can(bos, "tasks.update");

  return (
    <>
      <PageHeader title="المهام" actions={can(bos, "tasks.create") ? <Link href="/admin/projects/tasks/new" className="admin-btn small"><Tx>+ مهمة</Tx></Link> : null} />
      <Tabs tabs={views.map((v) => ({ ...v, hidden: v.key === "team" && scope === "own" }))} active={view} baseHref="/admin/projects/tasks" param="view" />
      <FilterBar
        searchPlaceholder="بحث في المهام..."
        filters={[
          { key: "priority", label: "الأولوية", type: "select", options: statusOptions("priority") },
          { key: "status", label: "الحالة", type: "select", options: statusOptions("task_status") },
          ...(view !== "my" ? [{ key: "assigned", label: "المسؤول", type: "select" as const, options: staff.map((s) => ({ value: s.userId, label: s.name })) }] : []),
        ]}
      />
      <DataTable
        tableId="tasks"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "tasks.export") ? "/api/bos/export/tasks" : undefined}
        empty={<EmptyState title={view === "overdue" ? "لا توجد مهام متأخرة" : view === "today" ? "لا مهام مستحقة اليوم" : "لا توجد مهام"} actions={can(bos, "tasks.create") ? <Link href="/admin/projects/tasks/new" className="admin-btn small"><Tx>مهمة جديدة</Tx></Link> : null} />}
        rows={result.rows.map((t) => {
          const project = t.projects as unknown as { name: string } | null;
          const deal = t.deals as unknown as { name: string } | null;
          const client = t.clients as unknown as { name: string } | null;
          return {
            id: t.id,
            cells: {
              title: <Link href={`/admin/projects/tasks/${t.id}`}>{t.title}{t.parent_task_id ? <span className="cell-sub"><Tx>مهمة فرعية</Tx></span> : null}</Link>,
              related: project ? <Link href={`/admin/projects/${t.project_id}?tab=tasks`}>{project.name}</Link> : deal ? <Link href={`/admin/sales/deals/${t.deal_id}`}>{deal.name}</Link> : client?.name ?? "—",
              assignee: t.assigned_to ? names.get(t.assigned_to) ?? "—" : <span className="bos-faint"><Tx>غير معيّن</Tx></span>,
              due: <span style={t.status === "overdue" ? { color: "var(--bos-danger)" } : undefined}>{formatDate(t.due_date)}</span>,
              priority: <StatusBadge map="priority" value={t.priority} />,
              time: `${formatMinutes(t.actual_minutes)} / ${t.estimated_minutes ? formatMinutes(t.estimated_minutes) : "—"}`,
              status: canUpdate ? <TaskStatusSelect id={t.id} status={t.status} /> : <StatusBadge map="task_status" value={t.status} />,
            },
          };
        })}
      />
    </>
  );
}
